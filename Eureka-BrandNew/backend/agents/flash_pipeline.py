"""
Multi-step flash pipeline.

  Step 1 — Dispatcher:   1 LLM call → intent list + source_text slices
  Step 2 — Sub-agents:   parallel LLM calls, one per intent → results list
  Step 3 — Session writer: 1 LLM call → {summary, cards, has_pending}

All sub-agents use async tool wrappers so DB writes work correctly inside
FastAPI's running event loop (no run_until_complete needed).
"""
import asyncio
import json
import re
import uuid
from pathlib import Path

from google.adk.agents import LlmAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import FunctionTool
from google.genai.types import Content, Part

from agents.model_config import FLASH_MODEL
from mcp.tools import (
    create_asset, query_asset,
    create_contact, query_contact, update_contact,
)

# ── Skill file loader ──────────────────────────────────────────────────────────

SKILLS_DIR = Path(__file__).parent.parent / "skills"

def _skill(relative_path: str) -> str:
    return (SKILLS_DIR / relative_path).read_text(encoding="utf-8")


# ── Async tool wrappers ────────────────────────────────────────────────────────
# ADK FunctionTool natively awaits async functions — no event loop gymnastics.

async def tool_create_asset(asset_type: str, payload: str,
                            session_id: str = "", input_id: str = "") -> str:
    result = await create_asset(asset_type, payload, session_id, input_id)
    return json.dumps(result, ensure_ascii=False)

async def tool_query_asset(asset_type: str = "", contains: str = "") -> str:
    result = await query_asset(asset_type, contains)
    return json.dumps(result, ensure_ascii=False)

async def tool_create_contact(payload: str) -> str:
    """
    Create a contact. payload must be a JSON string with fields:
      name (required), phone, company, title, email, notes
    Example: '{"name": "张三", "company": "A公司", "phone": "13812345678"}'
    """
    try:
        data = json.loads(payload) if isinstance(payload, str) else payload
    except (json.JSONDecodeError, TypeError):
        return json.dumps({"ok": False, "error": "invalid payload JSON"}, ensure_ascii=False)
    result = await create_contact(
        name=data.get("name", ""),
        phone=data.get("phone", ""),
        company=data.get("company", ""),
        title=data.get("title", ""),
        email=data.get("email", ""),
        notes=data.get("notes", ""),
    )
    return json.dumps(result, ensure_ascii=False)

async def tool_query_contact(name_query: str = "") -> str:
    result = await query_contact(name_query)
    return json.dumps(result, ensure_ascii=False)

async def tool_update_contact(contact_id: str, field: str, value: str) -> str:
    result = await update_contact(contact_id, field, value)
    return json.dumps(result, ensure_ascii=False)


# ── ADK runner helper ──────────────────────────────────────────────────────────

_session_service = InMemorySessionService()
APP_NAME = "eureka-flash-pipeline"


async def _run_agent(agent: LlmAgent, message: str) -> str:
    """Spin up a one-shot ADK runner for a single agent, return its final text."""
    sid = str(uuid.uuid4())
    await _session_service.create_session(
        app_name=APP_NAME, user_id="default", session_id=sid,
    )
    runner = Runner(agent=agent, app_name=APP_NAME, session_service=_session_service)
    user_msg = Content(role="user", parts=[Part(text=message)])
    final = ""
    async for event in runner.run_async(
        user_id="default", session_id=sid, new_message=user_msg
    ):
        if event.is_final_response() and event.content:
            final = event.content.parts[0].text if event.content.parts else ""
    return final


# ── JSON parser ────────────────────────────────────────────────────────────────

def _parse_json(text: str) -> dict | None:
    """Extract a JSON dict from agent output, tolerating markdown fences + preamble."""
    clean = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()
    for candidate in (clean, text.strip()):
        try:
            result = json.loads(candidate)
            if isinstance(result, dict):
                return result
        except (json.JSONDecodeError, ValueError):
            pass
    # Last-resort: find the outermost {...} block
    for m in reversed(list(re.finditer(r"\{[\s\S]+\}", clean or text))):
        try:
            result = json.loads(m.group())
            if isinstance(result, dict):
                return result
        except (json.JSONDecodeError, ValueError):
            continue
    return None


# ── Step 1: Dispatcher ─────────────────────────────────────────────────────────

async def _dispatch(user_text: str, today_str: str) -> list[dict]:
    """
    Identify all intents in user_text and slice each to a source_text fragment.
    Returns a list like: [{"type": "todo", "source_text": "..."}, ...]
    """
    agent = LlmAgent(
        name="flash_dispatcher",
        model=FLASH_MODEL,
        instruction=_skill("flash-dispatcher/SKILL.md"),
    )
    msg = f"今天是 {today_str}。\nuser_text: {user_text}"
    raw = await _run_agent(agent, msg)
    parsed = _parse_json(raw)
    if parsed and isinstance(parsed.get("intents"), list):
        return parsed["intents"]
    # Fallback: treat whole input as a general note
    return [{"type": "note", "source_text": user_text}]


# ── Step 2: Sub-skill agents ───────────────────────────────────────────────────

def _make_agent(intent_type: str) -> LlmAgent:
    skill_map = {
        "todo":    ("flash-todo-skill/SKILL.md",    [FunctionTool(tool_create_asset)]),
        "expense": ("flash-expense-skill/SKILL.md", [FunctionTool(tool_create_asset)]),
        "idea":    ("flash-idea-skill/SKILL.md",    [FunctionTool(tool_create_asset)]),
        "note":    ("flash-idea-skill/SKILL.md",    [FunctionTool(tool_create_asset)]),
        "contact": ("flash-contact-skill/SKILL.md", [
            FunctionTool(tool_query_contact),
            FunctionTool(tool_create_contact),
            FunctionTool(tool_update_contact),
        ]),
        "qa": ("flash-qa-skill/SKILL.md", [FunctionTool(tool_query_asset)]),
    }
    skill_path, tools = skill_map.get(intent_type, skill_map["note"])
    return LlmAgent(
        name=f"{intent_type}_agent",
        model=FLASH_MODEL,
        instruction=_skill(skill_path),
        tools=tools,
    )


async def _run_intent(
    intent: dict,
    user_text: str,
    session_id: str,
    input_id: str,
    today_str: str,
) -> dict:
    """Run one sub-skill agent for a single intent, return its result dict."""
    itype = intent.get("type", "note")
    source = intent.get("source_text", user_text)

    agent = _make_agent(itype)
    msg = (
        f"source_text: {source}\n"
        f"user_text: {user_text}\n"
        f"session_id: {session_id}\n"
        f"input_id: {input_id}\n"
        f"今天是 {today_str}。"
    )
    raw = await _run_agent(agent, msg)
    result = _parse_json(raw) or {"ok": False, "raw": raw[:200]}
    result["skill"] = f"{itype}-skill"
    result["source_text"] = source
    return result


# ── Step 3: Python aggregator (no LLM call) ───────────────────────────────────

def _fmt_due(due: str) -> str:
    """Format ISO due_date → '5月22日 15:00' or '5月22日截止'."""
    if not due:
        return ""
    try:
        from datetime import datetime as _dt
        d = _dt.fromisoformat(due.replace("Z", "+00:00"))
        if d.hour or d.minute:
            return f"{d.month}月{d.day}日 {d.strftime('%H:%M')}"
        return f"{d.month}月{d.day}日截止"
    except (ValueError, AttributeError):
        return due


def _make_card(r: dict) -> dict:
    skill = r.get("skill", "")
    ok = r.get("ok", False)
    status = r.get("status", "success")
    payload = r.get("payload") or {}
    asset_id = r.get("asset_id")

    _LABELS = {"todo-skill": "待办", "contact-skill": "联系人",
               "idea-skill": "想法", "expense-skill": "消费", "qa-skill": "问答"}

    if not ok and status != "pending_confirmation":
        return {
            "card_type": "error",
            "title": _LABELS.get(skill, "未知"),
            "subtitle": (r.get("message") or r.get("error") or "处理失败")[:50],
            "action": None,
        }

    if skill == "todo-skill":
        title = payload.get("content") or payload.get("title") or "待办"
        subtitle = _fmt_due(payload.get("due_date", "")) or "无截止时间"
        return {"card_type": "todo", "title": title, "subtitle": subtitle,
                "asset_id": asset_id,
                "action": {"type": "navigate", "route": f"/todos/{asset_id}"} if asset_id else None}

    if skill == "expense-skill":
        amt = payload.get("amount", "")
        parts = [p for p in [payload.get("category", ""), payload.get("description", "")] if p]
        return {"card_type": "expense", "title": f"¥{amt}" if amt else "消费",
                "subtitle": " · ".join(parts),
                "asset_id": asset_id,
                "action": {"type": "navigate", "route": f"/expenses/{asset_id}"} if asset_id else None}

    if skill == "idea-skill":
        title = payload.get("title") or "想法"
        content = payload.get("content", "")
        return {"card_type": "idea", "title": title,
                "subtitle": content[:30] + ("…" if len(content) > 30 else ""),
                "asset_id": asset_id,
                "action": {"type": "navigate", "route": f"/ideas/{asset_id}"} if asset_id else None}

    if skill == "contact-skill":
        if status == "pending_confirmation":
            candidates = r.get("pending_candidates", [])
            name = r.get("source_text", "联系人")[:20]
            return {"card_type": "pending_contact", "title": name,
                    "subtitle": f"找到 {len(candidates)} 个同名联系人，请确认",
                    "action": {"type": "disambiguate", "candidates": candidates,
                               "extracted_update": r.get("extracted_update", {})}}
        cid = r.get("contact_id")
        name = r.get("name") or payload.get("name", "联系人")
        company = r.get("company") or payload.get("company", "")
        action_type = r.get("contact_action", "created")
        subtitle = (f"已新建 · {company}" if company else "已新建") if action_type == "created" else "已更新"
        return {"card_type": "contact", "title": name, "subtitle": subtitle,
                "asset_id": cid,
                "action": {"type": "navigate", "route": f"/contacts/{cid}"} if cid else None}

    if skill == "qa-skill":
        ans = r.get("answer", "")
        return {"card_type": "qa", "title": "回答",
                "subtitle": ans[:40] + ("…" if len(ans) > 40 else ""),
                "action": {"type": "expand", "full_text": ans}}

    return {"card_type": "error", "title": _LABELS.get(skill, "未知"),
            "subtitle": "未识别的技能类型", "action": None}


def _build_summary(results: list[dict], cards: list[dict]) -> str:
    ok_results = [r for r in results if r.get("ok")]
    qa_only = ok_results and all(r.get("skill") == "qa-skill" for r in ok_results)
    if qa_only:
        ans = ok_results[0].get("answer", "")
        return ans[:50] + ("…" if len(ans) > 50 else "")

    ok_count = sum(1 for r in results
                   if r.get("ok") and r.get("status") != "pending_confirmation")
    has_pending = any(r.get("status") == "pending_confirmation" for r in results)
    pending_names = [r.get("source_text", "联系人")[:10]
                     for r in results if r.get("status") == "pending_confirmation"]

    if ok_count == 0 and not has_pending:
        return "本次闪念未识别到可保存的内容。"
    summary = f"已记录 {ok_count} 项内容。" if ok_count != 1 else "已记录 1 项内容。"
    if pending_names:
        summary += f"…联系人「{'、'.join(pending_names)}」需要确认。"
    return summary


def _aggregate(results: list[dict], session_id: str, input_id: str) -> dict:
    cards = [_make_card(r) for r in results]
    return {
        "ok": True,
        "session_id": session_id,
        "input_id": input_id,
        "summary": _build_summary(results, cards),
        "cards": cards,
        "has_pending": any(r.get("status") == "pending_confirmation" for r in results),
    }


# ── Public entry point ─────────────────────────────────────────────────────────

async def run_flash_pipeline(
    user_text: str,
    session_id: str,
    input_id: str,
    today_str: str,
) -> dict:
    """
    Full flash pipeline. Returns a dict compatible with FlashResponse:
      {ok, session_id, summary, cards, has_pending}
    """
    # Step 1: Identify intents
    intents = await _dispatch(user_text, today_str)

    # Step 2: Run sub-agents in parallel
    results = list(
        await asyncio.gather(*[
            _run_intent(i, user_text, session_id, input_id, today_str)
            for i in intents
        ])
    )

    # Step 3: Aggregate results in Python (no LLM call — saves ~3s)
    return _aggregate(results, session_id, input_id)
