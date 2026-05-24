"""
Flash Pipeline — Phase B Step 4 rewrite (decision #4).

Three-step Python orchestration:
  Step 1 — Dispatcher:     1 LLM call → intent list (per skill type)
  Step 2 — Sub-skill agents: parallel LLM calls (one per intent) via asyncio.gather
  Step 3 — Python aggregator: build summary + cards (NO LLM)

Triggered by voice input_turns in flash sessions (per §三.4 routing).
Called from api/flash.py (Step 5).

Each sub-skill agent's create_asset includes source_input_turn_id pointing
back to the triggering input_turn — provenance kept end-to-end.

This is a rewrite of the previous flash_pipeline.py, with these changes:
- Uses agents/skill_factory.py + shared MCPToolset (no per-file tool duplication)
- Output mentions input_turn_id (was input_id)
- Aggregator includes 'event' card_type
- Cleaner _aggregate output for API consumption (derived_assets list)
"""
import asyncio
import json
import re
import uuid
from typing import Optional

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part

from agents.skill_factory import make_dispatcher_agent, make_skill_agent


_session_service = InMemorySessionService()
APP_NAME = "eureka-flash-pipeline"


# ── Utilities ──────────────────────────────────────────────────────────────────

def _parse_json(text: str) -> Optional[dict]:
    """Extract a JSON dict from agent output, tolerating markdown fences + preamble."""
    clean = re.sub(r"```(?:json)?\s*", "", text).replace("```", "").strip()
    for candidate in (clean, text.strip()):
        try:
            result = json.loads(candidate)
            if isinstance(result, dict):
                return result
        except (json.JSONDecodeError, ValueError):
            pass
    for m in reversed(list(re.finditer(r"\{[\s\S]+\}", clean or text))):
        try:
            result = json.loads(m.group())
            if isinstance(result, dict):
                return result
        except (json.JSONDecodeError, ValueError):
            continue
    return None


async def _run_agent(agent, message: str, user_id: str) -> str:
    """Spin a one-shot ADK Runner for a single agent invocation; return final text."""
    sid = str(uuid.uuid4())
    await _session_service.create_session(
        app_name=APP_NAME, user_id=user_id, session_id=sid,
    )
    runner = Runner(agent=agent, app_name=APP_NAME, session_service=_session_service)
    user_msg = Content(role="user", parts=[Part(text=message)])
    final = ""
    async for event in runner.run_async(
        user_id=user_id, session_id=sid, new_message=user_msg,
    ):
        if event.is_final_response() and event.content:
            parts = event.content.parts or []
            if parts:
                final = parts[0].text or ""
    return final


# ── Step 1: Dispatcher ─────────────────────────────────────────────────────────

async def _dispatch(user_text: str, today_str: str, user_id: str) -> list:
    """
    Classify a user's free-text input into a list of intents.
    Returns [{"type": "todo|event|expense|idea|contact|qa|note", "source_text": "..."}].
    """
    agent = make_dispatcher_agent()
    msg = f"今天是 {today_str}。\nuser_text: {user_text}"
    raw = await _run_agent(agent, msg, user_id)
    parsed = _parse_json(raw)
    if parsed and isinstance(parsed.get("intents"), list):
        return parsed["intents"]
    return [{"type": "note", "source_text": user_text}]


# ── Step 2: Sub-skill agents (parallel) ───────────────────────────────────────

async def _run_intent(
    intent: dict,
    user_text: str,
    session_id: str,
    source_input_turn_id: str,
    today_str: str,
    user_id: str,
) -> dict:
    """Dispatch one intent to its skill agent. Returns the skill's result dict."""
    itype = intent.get("type", "note")

    # 'note' has no dedicated skill — route to idea
    if itype == "note":
        itype = "idea"

    # 'misc' is recognized but not actioned
    if itype == "misc":
        return {
            "ok": False,
            "skill": "misc-skill",
            "source_text": intent.get("source_text", ""),
            "error": "misc intent not routed",
        }

    source = intent.get("source_text", user_text)
    agent = make_skill_agent(itype)
    msg = (
        f"source_text: {source}\n"
        f"user_text: {user_text}\n"
        f"session_id: {session_id}\n"
        f"source_input_turn_id: {source_input_turn_id}\n"
        f"今天是 {today_str}。"
    )
    raw = await _run_agent(agent, msg, user_id)
    result = _parse_json(raw) or {"ok": False, "raw": raw[:200]}
    result["skill"] = f"{itype}-skill"
    result["source_text"] = source
    return result


# ── Step 3: Python aggregator (no LLM) ────────────────────────────────────────

def _fmt_dt(dt_str: str) -> str:
    """Format ISO datetime → '5月22日 15:00' or '5月22日截止'."""
    if not dt_str:
        return ""
    try:
        from datetime import datetime as _dt
        d = _dt.fromisoformat(dt_str.replace("Z", "+00:00"))
        if d.hour or d.minute:
            return f"{d.month}月{d.day}日 {d.strftime('%H:%M')}"
        return f"{d.month}月{d.day}日截止"
    except (ValueError, AttributeError):
        return dt_str


_SKILL_LABELS = {
    "todo-skill":    "待办",
    "event-skill":   "事件",
    "contact-skill": "联系人",
    "idea-skill":    "想法",
    "expense-skill": "消费",
    "qa-skill":      "问答",
}


def _make_card(r: dict) -> dict:
    skill = r.get("skill", "")
    ok = r.get("ok", False)
    status = r.get("status", "success")
    payload = r.get("payload") or {}
    asset_id = r.get("asset_id")

    if not ok and status != "pending_confirmation":
        return {
            "card_type": "error",
            "title": _SKILL_LABELS.get(skill, "未知"),
            "subtitle": (r.get("message") or r.get("error") or "处理失败")[:50],
            "asset_id": None,
        }

    if skill == "todo-skill":
        return {
            "card_type": "todo",
            "title":     payload.get("content") or "待办",
            "subtitle":  _fmt_dt(payload.get("due_date", "")) or "无截止时间",
            "asset_id":  asset_id,
        }

    if skill == "event-skill":
        return {
            "card_type": "event",
            "title":     payload.get("title") or "事件",
            "subtitle":  _fmt_dt(payload.get("start_at", "")),
            "asset_id":  asset_id,
        }

    if skill == "expense-skill":
        amt = payload.get("amount", "")
        parts = [p for p in [payload.get("category", ""), payload.get("description", "")] if p]
        return {
            "card_type": "expense",
            "title":     f"¥{amt}" if amt else "消费",
            "subtitle":  " · ".join(parts),
            "asset_id":  asset_id,
        }

    if skill == "idea-skill":
        content = payload.get("content", "")
        return {
            "card_type": "idea",
            "title":     payload.get("title") or "想法",
            "subtitle":  content[:30] + ("…" if len(content) > 30 else ""),
            "asset_id":  asset_id,
        }

    if skill == "contact-skill":
        if status == "pending_confirmation":
            candidates = r.get("pending_candidates", [])
            name = (r.get("source_text") or "联系人")[:20]
            return {
                "card_type": "pending_contact",
                "title":     name,
                "subtitle":  f"找到 {len(candidates)} 个同名联系人,请确认",
                "asset_id":  None,
                "candidates": candidates,
            }
        name    = r.get("name") or payload.get("name", "联系人")
        company = r.get("company") or payload.get("company", "")
        action  = r.get("contact_action", "created")
        subtitle = (f"已新建 · {company}" if company else "已新建") if action == "created" else "已更新"
        return {
            "card_type": "contact",
            "title":     name,
            "subtitle":  subtitle,
            "asset_id":  r.get("contact_id"),
        }

    if skill == "qa-skill":
        ans = r.get("answer", "")
        return {
            "card_type": "qa",
            "title":     "回答",
            "subtitle":  ans[:40] + ("…" if len(ans) > 40 else ""),
            "asset_id":  None,
            "full_text": ans,
        }

    return {
        "card_type": "error",
        "title":     _SKILL_LABELS.get(skill, "未知"),
        "subtitle":  "未识别的技能类型",
        "asset_id":  None,
    }


def _build_summary(results: list) -> str:
    ok_results = [r for r in results if r.get("ok")]
    qa_only = ok_results and all(r.get("skill") == "qa-skill" for r in ok_results)
    if qa_only:
        ans = ok_results[0].get("answer", "")
        return ans[:50] + ("…" if len(ans) > 50 else "")

    ok_count = sum(
        1 for r in results
        if r.get("ok") and r.get("status") != "pending_confirmation"
    )
    pending_names = [
        (r.get("source_text") or "联系人")[:10]
        for r in results if r.get("status") == "pending_confirmation"
    ]

    if ok_count == 0 and not pending_names:
        return "本次闪念未识别到可保存的内容。"

    summary = f"已记录 {ok_count} 项内容。" if ok_count != 1 else "已记录 1 项内容。"
    if pending_names:
        summary += f"…联系人「{'、'.join(pending_names)}」需要确认。"
    return summary


def _aggregate(results: list, session_id: str, input_turn_id: str) -> dict:
    cards = [_make_card(r) for r in results]
    return {
        "ok":              True,
        "session_id":      session_id,
        "input_turn_id":   input_turn_id,
        "summary":         _build_summary(results),
        "cards":           cards,
        "derived_assets":  [
            {"asset_id": c["asset_id"], "card": c}
            for c in cards if c.get("asset_id")
        ],
        "has_pending":     any(r.get("status") == "pending_confirmation" for r in results),
    }


# ── Public entry point ────────────────────────────────────────────────────────

async def run_flash_pipeline(
    user_text: str,
    session_id: str,
    input_turn_id: str,
    today_str: str,
    user_id: str = "default",
) -> dict:
    """
    Full flash pipeline. Returns a dict shaped for /api/flash response:
      {ok, session_id, input_turn_id, summary, cards, derived_assets, has_pending}

    Sub-skill agents create assets with source_input_turn_id=input_turn_id —
    provenance preserved so Phase D's SessionTurnCard can render it.
    """
    intents = await _dispatch(user_text, today_str, user_id)
    results = list(
        await asyncio.gather(*[
            _run_intent(i, user_text, session_id, input_turn_id, today_str, user_id)
            for i in intents
        ])
    )
    return _aggregate(results, session_id, input_turn_id)
