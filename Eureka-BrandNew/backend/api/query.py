"""
POST /api/query — unified chat; keyword-routes to flash_pipeline or query_agent
without invoking the root LLM router (saves ~3s per request).
"""
import json
import re
import time
import uuid
from datetime import date
from fastapi import APIRouter
from pydantic import BaseModel

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part

from agents.query_agent import query_agent
from agents.flash_agent import flash_agent
from db.models import Session as DBSession, Message
from db.database import AsyncSessionLocal
from sqlalchemy import select

router = APIRouter()


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
    for m in reversed(list(re.finditer(r"\{[\s\S]+\}", clean or text))):
        try:
            result = json.loads(m.group())
            if isinstance(result, dict):
                return result
        except (json.JSONDecodeError, ValueError):
            continue
    return None


# Keywords that indicate the user wants to CAPTURE something (flash note).
# Anything else is treated as a retrieval / Q&A query.
# Intentionally conservative — ambiguous phrases fall through to query_agent.
_CAPTURE_RE = re.compile(
    r"记得|提醒|花了|花费|消费|买了|联系|想到|记一下|刚才|"
    r"报销|支出|吃了|喝了|新建|创建|添加|帮我记|帮我创|帮我新建|"
    r"remind me|add a\b|create a\b|note:|note down",
    re.IGNORECASE,
)

# Question/analysis sentences always route to query_agent, even if they contain
# capture keywords like "花了" or "支出".
_QUESTION_RE = re.compile(
    r"多少|几[个块元]|什么时候|为什么|怎么|哪[个些]|谁|"
    r"是多少|有哪些|有几|有什么|查一下|查查|帮我查|"
    r"分析|统计|总结|汇总|查看|看看|看一下|概览|报告|排行|趋势|"
    r"[？?]$|吗$|呢$|吧$",
    re.IGNORECASE,
)

def _is_capture(text: str) -> bool:
    if _QUESTION_RE.search(text):
        return False
    return bool(_CAPTURE_RE.search(text))

_session_service = InMemorySessionService()
APP_NAME = "eureka-chat"


class HistoryItem(BaseModel):
    role: str   # "user" | "agent"
    text: str


class QueryRequest(BaseModel):
    question: str
    session_id: str = ""  # empty = create new session; provided = reuse existing
    history: list[HistoryItem] = []  # last N turns for multi-turn context


class QueryResponse(BaseModel):
    ok: bool
    answer: str = ""
    cards: list = []
    summary: str = ""
    session_id: str = ""
    error: str = ""
    elapsed_ms: int = 0
    input_tokens: int = 0
    output_tokens: int = 0


async def _create_agent_chat_session(user_id: str) -> str:
    """Always create a fresh agent_chat session for a new conversation."""
    import datetime as _dt
    now = _dt.datetime.now()
    today = date.today()
    async with AsyncSessionLocal() as db:
        sess = DBSession(
            user_id=user_id,
            session_type="agent_chat",
            title=f"对话 · {now.strftime('%m-%d %H:%M')}",
            date=today,
        )
        db.add(sess)
        await db.commit()
        return str(sess.id)


async def _run_agent_query(
    agent,
    enriched_text: str,
    user_id: str,
) -> tuple[str, int, int]:
    """Run a single agent and return (final_text, input_tokens, output_tokens)."""
    adk_session_id = str(uuid.uuid4())
    await _session_service.create_session(
        app_name=APP_NAME, user_id=user_id, session_id=adk_session_id,
    )
    runner = Runner(agent=agent, app_name=APP_NAME, session_service=_session_service)
    user_msg = Content(role="user", parts=[Part(text=enriched_text)])

    final_text = ""
    input_tokens = output_tokens = 0
    async for event in runner.run_async(
        user_id=user_id, session_id=adk_session_id, new_message=user_msg,
    ):
        if hasattr(event, "usage_metadata") and event.usage_metadata:
            um = event.usage_metadata
            input_tokens  = max(input_tokens,  getattr(um, "prompt_token_count",     0) or 0)
            output_tokens = max(output_tokens, getattr(um, "candidates_token_count", 0) or 0)
        if event.is_final_response() and event.content:
            final_text = event.content.parts[0].text if event.content.parts else ""
    return final_text, input_tokens, output_tokens


async def _update_session_title(session_id: str, question: str) -> None:
    """Set session title to first user message (truncated). Called only on new sessions."""
    title = question[:24] + ("…" if len(question) > 24 else "")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(DBSession).where(DBSession.id == uuid.UUID(session_id)))
        sess = result.scalar_one_or_none()
        if sess:
            sess.title = title
            await db.commit()


async def _save_messages(
    session_id: str,
    user_id: str,
    question: str,
    answer: str,
    cards: list,
    elapsed_ms: int,
) -> None:
    """Persist user question and agent response to messages table."""
    async with AsyncSessionLocal() as db:
        db.add(Message(
            session_id=uuid.UUID(session_id),
            user_id=user_id,
            role="user",
            text=question,
            cards=[],
        ))
        db.add(Message(
            session_id=uuid.UUID(session_id),
            user_id=user_id,
            role="agent",
            text=answer,
            cards=cards,
            elapsed_ms=elapsed_ms,
        ))
        await db.commit()


@router.post("/query", response_model=QueryResponse)
async def query_endpoint(req: QueryRequest):
    user_id = "default"
    today_str = date.today().strftime("%Y年%m月%d日")
    t0 = time.monotonic()
    is_new_session = not req.session_id
    db_session_id = req.session_id or await _create_agent_chat_session(user_id)

    # Choose agent based on keyword routing — skips root_agent LLM call (~3s saved)
    agent = flash_agent if _is_capture(req.question) else query_agent

    # Build conversation history block (last 10 messages = 5 turns)
    history_block = ""
    if req.history:
        lines = []
        for h in req.history[-10:]:
            role_label = "用户" if h.role == "user" else "助手"
            lines.append(f"{role_label}：{h.text}")
        history_block = "【对话历史】\n" + "\n".join(lines) + "\n\n"

    enriched = (
        f"今天是 {today_str}。\n"
        f"{history_block}"
        f"session_id: {db_session_id}\n"
        f"input_id: {str(uuid.uuid4())}\n"
        f"user_text: {req.question}"
    )

    try:
        final_text, input_tokens, output_tokens = await _run_agent_query(agent, enriched, user_id)
    except Exception as e:
        return QueryResponse(ok=False, error=str(e), elapsed_ms=int((time.monotonic()-t0)*1000))

    # Update session title with first message content so drawer is readable
    if is_new_session:
        await _update_session_title(db_session_id, req.question)

    elapsed_ms = int((time.monotonic() - t0) * 1000)

    # flash_agent returns JSON with "cards"; query_agent returns plain text.
    # Use robust parser to handle preamble text / markdown fences from the LLM.
    result = _parse_json(final_text)
    if result and "cards" in result:
        summary = result.get("summary", "")
        cards = result.get("cards", [])
        await _save_messages(db_session_id, user_id, req.question, summary, cards, elapsed_ms)
        return QueryResponse(
            ok=True,
            session_id=result.get("session_id", db_session_id),
            summary=summary,
            cards=cards,
            elapsed_ms=elapsed_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

    await _save_messages(db_session_id, user_id, req.question, final_text, [], elapsed_ms)
    return QueryResponse(
        ok=True,
        answer=final_text,
        session_id=db_session_id,
        elapsed_ms=elapsed_ms,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
