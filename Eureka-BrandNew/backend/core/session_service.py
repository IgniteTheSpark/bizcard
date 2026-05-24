"""
Chat session persistence — Phase B Step 3 (decision #4).

Bridges our `sessions` + `messages` tables with ADK's session machinery.

Pattern (per /api/chat request, wired up in Step 5 api/chat.py):
1. Resolve / create the DB session row (`sessions` table, type='chat')
2. Create one `input_turn` for this turn (source='chat', text=user_text)
   — provenance: agent-created assets in this turn will reference this input_turn_id
3. Load last N=20 messages from `messages` table as conversation history
4. Spin up ADK Runner with an InMemorySessionService pre-loaded with that history
5. Stream agent run; collect new events
6. Persist user message + agent reply (+ tool calls) back to `messages`

This module provides the DB-level building blocks. The ADK history-replay
mapping (Message rows → ADK Events) lives near the API endpoint that
owns the request lifecycle.

Per decision #3: fixed N=20 message window. Long input_turn content (meeting
transcripts) is referenced via system prompt + tool calls (get_input_turn) on
demand — NEVER auto-included in chat context.
"""
import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Message, Session as DBSession, InputTurn


# Decision #3: fixed window size for in-context history
CHAT_HISTORY_WINDOW = 20


# ── Session lifecycle ──────────────────────────────────────────────────────────

async def get_or_create_chat_session(
    db: AsyncSession,
    user_id: str,
    session_id: Optional[str] = None,
    title_hint: Optional[str] = None,
) -> DBSession:
    """
    Resolve or create a chat session row.

    - If session_id is provided: load it (raises ValueError if not found).
    - If empty: create a new sessions row with session_type='chat'. The title
      is derived from title_hint (first user message, truncated to 24 chars).
    """
    if session_id:
        result = await db.execute(
            select(DBSession).where(
                DBSession.id == uuid.UUID(session_id),
                DBSession.user_id == user_id,
            )
        )
        sess = result.scalar_one_or_none()
        if not sess:
            raise ValueError(f"chat session not found: {session_id}")
        return sess

    title = ""
    if title_hint:
        title = title_hint[:24] + ("…" if len(title_hint) > 24 else "")

    sess = DBSession(
        user_id=user_id,
        session_type="chat",
        title=title,
    )
    db.add(sess)
    await db.commit()
    await db.refresh(sess)
    return sess


# ── Input turn lifecycle ──────────────────────────────────────────────────────

async def create_input_turn_for_message(
    db: AsyncSession,
    session_id: str,
    user_id: str,
    text: str,
    source: str = "chat",
) -> InputTurn:
    """
    Create an input_turn row for this user message — the source of provenance
    for any asset the agent creates in this turn.

    Auto-assigns `index` as the next position within the session. For chat,
    source='chat' and no file_id; flash and meeting paths use this helper
    with their own source/file_id arguments via the API layer.
    """
    # Determine next index within session
    result = await db.execute(
        select(InputTurn)
        .where(InputTurn.session_id == uuid.UUID(session_id))
        .order_by(InputTurn.index.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    next_index = (last.index + 1) if last else 0

    turn = InputTurn(
        user_id=user_id,
        session_id=uuid.UUID(session_id),
        index=next_index,
        text=text,
        source=source,
    )
    db.add(turn)
    await db.commit()
    await db.refresh(turn)
    return turn


# ── Message history ────────────────────────────────────────────────────────────

async def load_recent_messages(
    db: AsyncSession,
    session_id: str,
    limit: int = CHAT_HISTORY_WINDOW,
) -> List[Message]:
    """
    Load the most recent `limit` messages for a session, returned oldest-first
    so they can be replayed into the ADK runner in chronological order.
    """
    result = await db.execute(
        select(Message)
        .where(Message.session_id == uuid.UUID(session_id))
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    msgs = list(result.scalars().all())
    msgs.reverse()
    return msgs


async def persist_chat_turn(
    db: AsyncSession,
    session_id: str,
    user_id: str,
    user_text: str,
    agent_text: str,
    tool_call: Optional[dict] = None,
    tool_result: Optional[dict] = None,
    cards: Optional[list] = None,
    elapsed_ms: Optional[int] = None,
) -> tuple:
    """
    Persist a single chat turn:
    - 1 user message (role='user', text=user_text)
    - 1 agent message (role='agent', text=agent_text, optional tool_call/result/cards)

    Returns (user_msg, agent_msg) Message rows.
    """
    user_msg = Message(
        session_id=uuid.UUID(session_id),
        user_id=user_id,
        role="user",
        text=user_text,
    )
    agent_msg = Message(
        session_id=uuid.UUID(session_id),
        user_id=user_id,
        role="agent",
        text=agent_text,
        tool_call=tool_call,
        tool_result=tool_result,
        cards=cards or [],
        elapsed_ms=elapsed_ms,
    )
    db.add(user_msg)
    db.add(agent_msg)
    await db.commit()
    await db.refresh(user_msg)
    await db.refresh(agent_msg)
    return user_msg, agent_msg
