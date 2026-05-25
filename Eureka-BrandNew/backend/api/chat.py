"""
POST /api/chat — Unified Assistant via SSE (Phase B Step 5, decision #6).

Per-request lifecycle:
1. Resolve / create chat session (sessions table, type=chat)
2. Create input_turn(source=typed) for this turn — provenance for any assets
   the agent creates in this turn
3. Load recent N=20 messages from messages table (decision #3 window)
4. Build the Assistant agent with this turn's session_id + input_turn_id
   woven into the prompt
5. Run ADK Runner; stream events out as SSE; collect for persistence
6. After the run, persist user message + agent message (with tool_call/result)
   to messages table

The "刚刚那个" cross-turn CRUD reference (Phase B v1.3) works because:
- Step 3 loads prior messages including tool_call+tool_result rows
- Those are formatted into the assistant's prompt context
- Assistant identifies the referenced asset_id from prior tool_call history
"""
import json
import time
import uuid
from typing import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part

from agents.assistant import make_assistant_agent
from core.auth import get_current_user_id
from core.event_mapper import (
    event_role, event_text, event_tool_call, event_tool_result,
    is_streamable_token,
)
from core.session_service import (
    get_or_create_chat_session,
    create_input_turn_for_message,
    load_recent_messages,
    persist_chat_turn,
)
from core.streaming import sse_event, with_heartbeats
from db.database import AsyncSessionLocal
from db.models import Message

router = APIRouter()


# ── Request / response ─────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    user_text: str
    session_id: str = ""   # empty = create new chat session
    event_id:   str = ""   # v1.4: anchor this chat to an event (event detail page → ask agent)


# ── History formatting ────────────────────────────────────────────────────────

def _format_history(messages: list[Message]) -> str:
    """
    Format recent messages as a text block to prefix to the new user input.

    Demo-grade approach: stringify the conversation. Cleaner alternative is
    to pre-populate ADK session events with typed objects, but that requires
    deeper ADK API binding. Text prefix gives the agent enough context to
    resolve "刚刚那个" references (it can see prior tool_calls + their results)
    and is robust to ADK API drift.
    """
    if not messages:
        return ""
    lines = ["【最近对话历史】"]
    for m in messages:
        if m.role == "user":
            lines.append(f"用户: {m.text}")
        elif m.role == "agent":
            if m.text:
                lines.append(f"助手: {m.text}")
            if m.tool_call:
                name = m.tool_call.get("name", "?")
                args = json.dumps(m.tool_call.get("args", {}), ensure_ascii=False)
                lines.append(f"[助手调用工具 {name} args={args}]")
        elif m.role == "tool":
            if m.tool_result:
                resp = json.dumps(m.tool_result.get("response", m.tool_result), ensure_ascii=False)
                lines.append(f"[工具返回: {resp}]")
    return "\n".join(lines) + "\n\n"


# ── ADK runner helper ─────────────────────────────────────────────────────────

_adk_session_service = InMemorySessionService()
APP_NAME = "eureka-chat"


async def _stream_assistant(
    user_text: str,
    history_text: str,
    session_id: str,
    input_turn_id: str,
    user_id: str,
    event_id: str = "",
) -> AsyncIterator[tuple[str, dict]]:
    """
    Run the Assistant agent and yield (event_type, payload) tuples that the
    SSE wrapper can format. Also accumulates state for post-run persistence.
    """
    agent = make_assistant_agent(session_id, input_turn_id, event_id=event_id)

    # Fresh ADK in-memory session per request — persistence is our concern
    adk_sid = str(uuid.uuid4())
    await _adk_session_service.create_session(
        app_name=APP_NAME, user_id=user_id, session_id=adk_sid,
    )
    runner = Runner(
        agent=agent, app_name=APP_NAME, session_service=_adk_session_service,
    )

    enriched = history_text + f"用户: {user_text}"
    new_message = Content(role="user", parts=[Part(text=enriched)])

    async for event in runner.run_async(
        user_id=user_id, session_id=adk_sid, new_message=new_message,
    ):
        # Tool call → emit SSE 'tool_call' event
        tc = event_tool_call(event)
        if tc:
            yield ("tool_call", tc)
            continue

        # Tool result → emit SSE 'tool_result' event
        tr = event_tool_result(event)
        if tr:
            yield ("tool_result", tr)
            continue

        # Final response → emit 'token' (whole reply)
        if hasattr(event, "is_final_response") and event.is_final_response():
            text = event_text(event)
            if text:
                yield ("token", {"text": text})


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(req: ChatRequest, user_id: str = Depends(get_current_user_id)):
    """
    Unified Assistant chat (SSE).

    Streams events:
      meta         → {session_id, input_turn_id}
      token        → {text} (currently emitted as one chunk per agent step;
                     true per-token streaming is a Phase D polish item)
      tool_call    → {name, args}
      tool_result  → {name, response}
      done         → {elapsed_ms, message_id}
    """
    t0 = time.monotonic()

    async def stream() -> AsyncIterator[str]:
        # Phase 1 — session / input_turn setup
        async with AsyncSessionLocal() as db:
            session = await get_or_create_chat_session(
                db, user_id,
                session_id=req.session_id or None,
                title_hint=req.user_text,
                event_id=req.event_id or None,   # v1.4: anchor to event if provided
            )
            session_id = str(session.id)
            input_turn = await create_input_turn_for_message(
                db, session_id, user_id, req.user_text, source="typed",
            )
            input_turn_id = str(input_turn.id)
            recent = await load_recent_messages(db, session_id)

        yield sse_event("meta", {
            "session_id": session_id,
            "input_turn_id": input_turn_id,
        })

        # Phase 2 — stream agent run, collect state for persistence
        history_text = _format_history(recent)
        agent_text_parts: list[str] = []
        first_tool_call: dict | None = None
        first_tool_result: dict | None = None

        try:
            async for evt_type, payload in _stream_assistant(
                req.user_text, history_text, session_id, input_turn_id, user_id,
                event_id=req.event_id or "",
            ):
                yield sse_event(evt_type, payload)
                if evt_type == "token":
                    agent_text_parts.append(payload.get("text", ""))
                elif evt_type == "tool_call" and first_tool_call is None:
                    first_tool_call = payload
                elif evt_type == "tool_result" and first_tool_result is None:
                    first_tool_result = payload
        except Exception as e:
            yield sse_event("error", {"message": str(e)[:200]})

        # Phase 3 — persist user + agent messages
        agent_text = "".join(agent_text_parts).strip()
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        try:
            async with AsyncSessionLocal() as db:
                _, agent_msg = await persist_chat_turn(
                    db, session_id, user_id,
                    user_text=req.user_text,
                    agent_text=agent_text,
                    tool_call=first_tool_call,
                    tool_result=first_tool_result,
                    elapsed_ms=elapsed_ms,
                )
                msg_id = str(agent_msg.id)
        except Exception:
            msg_id = ""

        yield sse_event("done", {"elapsed_ms": elapsed_ms, "message_id": msg_id})

    return StreamingResponse(
        with_heartbeats(stream()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering if behind proxy
        },
    )
