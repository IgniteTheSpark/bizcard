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

from db.models import (
    Message, Session as DBSession, InputTurn,
    Asset, UserSkill, GlobalSkill, Event,
)


# Decision #3: fixed window size for in-context history
CHAT_HISTORY_WINDOW = 20


# ── Session lifecycle ──────────────────────────────────────────────────────────

async def get_or_create_chat_session(
    db: AsyncSession,
    user_id: str,
    session_id: Optional[str] = None,
    title_hint: Optional[str] = None,
    event_id: Optional[str] = None,
) -> DBSession:
    """
    Resolve or create a chat session row.

    - If session_id is provided: load it (raises ValueError if not found).
    - If empty: create a new sessions row with session_type='chat'.
      - title is derived from title_hint (first user message, truncated to 24 chars).
      - if event_id provided (v1.4 chat-from-event flow), anchor session to it.
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
        event_id=uuid.UUID(event_id) if event_id else None,
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
    source: str = "typed",
) -> InputTurn:
    """
    Create an input_turn row for this user message — the source of provenance
    for any asset the agent creates in this turn.

    Auto-assigns `index` as the next position within the session.

    source values are MODALITY (Phase B v1.3), independent of session_type:
      voice | typed | imported

    Default 'typed' fits the typed-message path; voice paths pass source='voice'
    explicitly and usually a file_id too. Mixed modalities within one session
    are supported — a flash session can have both voice and typed input_turns.
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


async def load_session_assets_hint(
    db: AsyncSession,
    session_id: str,
    user_id: str,
    limit: int = 10,
) -> str:
    """
    Build a human-readable, model-friendly bullet list of assets / events
    created in this session — used by the Assistant prompt as the「刚刚那个」
    candidate pool.

    Why this exists: Flash Pipeline creates assets but does NOT write to the
    messages table (it's a parallel intent-fan-out runner, not a chat turn).
    When the user follows up via /api/chat with「把刚刚那个改成…」, the
    chat history loaded by load_recent_messages is empty — the agent has no
    way to find the asset_id of the thing the user just spoke into Flash.

    This helper closes that gap by querying the asset / event tables
    directly, scoped to the same session_id.

    Format:
      - todo  (asset_id=fc00aaaf...): 「明天下午五点饭局」 due 2026-05-26 17:00
      - event (event_id=abcd1234...): 「跟客户开会」 2026-05-27 14:00–15:00
    """
    lines: list[str] = []

    # ── Assets in this session (joined to skill name) ──
    stmt = (
        select(Asset, GlobalSkill.name.label("skill_name"))
        .join(UserSkill, Asset.user_skill_id == UserSkill.id)
        .join(GlobalSkill, UserSkill.skill_id == GlobalSkill.id)
        .where(
            Asset.user_id == user_id,
            Asset.session_id == uuid.UUID(session_id),
        )
        .order_by(Asset.created_at.desc())
        .limit(limit)
    )
    asset_rows = (await db.execute(stmt)).all()
    for asset, skill_name in asset_rows:
        p = asset.payload or {}
        title = (
            p.get("content") or p.get("title") or p.get("name") or
            (f"¥{p.get('amount')}" if p.get("amount") else None) or
            f"[{skill_name}]"
        )
        extras: list[str] = []
        if skill_name == "todo" and p.get("due_date"):
            extras.append(f"due {p['due_date']}")
        if skill_name == "todo" and p.get("status"):
            extras.append(f"status={p['status']}")
        if skill_name == "expense":
            if p.get("amount"):
                extras.append(f"¥{p['amount']}")
            if p.get("at"):
                extras.append(f"at {p['at']}")
            elif p.get("date"):
                extras.append(f"date {p['date']}")
        suffix = (" " + " ".join(extras)) if extras else ""
        lines.append(
            f"- {skill_name} (asset_id={asset.id}): 「{str(title)[:60]}」{suffix}"
        )

    # ── Events whose source_input_turn belongs to this session ──
    # Event has no direct session_id column — go via source_input_turn_id.
    stmt = (
        select(Event)
        .join(InputTurn, Event.source_input_turn_id == InputTurn.id)
        .where(
            Event.user_id == user_id,
            InputTurn.session_id == uuid.UUID(session_id),
        )
        .order_by(Event.created_at.desc())
        .limit(limit)
    )
    events = (await db.execute(stmt)).scalars().all()
    for ev in events:
        time_range = ev.start_at.isoformat() if ev.start_at else "?"
        if ev.end_at:
            time_range += f" – {ev.end_at.isoformat()}"
        lines.append(
            f"- event (event_id={ev.id}): 「{ev.title[:60]}」 {time_range}"
            + (f" @ {ev.location}" if ev.location else "")
        )

    if not lines:
        return ""
    return "\n".join(lines)


async def load_session_context_hint(
    db: AsyncSession,
    session_id: str,
    user_id: str,
) -> str:
    """
    Build a bullet list of assets the user **explicitly attached** as context
    to this chat session (M2.2). Different from `load_session_assets_hint`,
    which lists assets created IN this session — that hint is for resolving
    「刚刚那个」 references. This one is for "the user wants the agent to
    actively use these assets to do something."

    The agent should treat these as primary subject matter:
      - "combine these 3 ideas into a product spec"
      - "make a master todo from these subtasks"
      - "summarize what you know about Kevin" (single contact context)

    Returns empty string if the session has no context.
    """
    # Read session.context_asset_ids
    sess = (await db.execute(
        select(DBSession).where(
            DBSession.id == uuid.UUID(session_id),
            DBSession.user_id == user_id,
        )
    )).scalar_one_or_none()
    if not sess or not sess.context_asset_ids:
        return ""

    # Join assets to their skill name for readable output
    stmt = (
        select(Asset, GlobalSkill.name.label("skill_name"))
        .join(UserSkill, Asset.user_skill_id == UserSkill.id)
        .join(GlobalSkill, UserSkill.skill_id == GlobalSkill.id)
        .where(
            Asset.user_id == user_id,
            Asset.id.in_(sess.context_asset_ids),
        )
    )
    rows = (await db.execute(stmt)).all()

    lines: list[str] = []
    for asset, skill_name in rows:
        p = asset.payload or {}
        title = (
            p.get("content") or p.get("title") or p.get("name") or
            (f"¥{p.get('amount')}" if p.get("amount") else None) or
            f"[{skill_name}]"
        )
        # Inline a few signal fields per skill so agent has structured info
        extras: list[str] = []
        if skill_name == "todo" and p.get("due_date"):
            extras.append(f"due {p['due_date']}")
        if skill_name == "idea" and p.get("content"):
            extras.append(f'"{str(p["content"])[:80]}"')
        if skill_name == "notes" and p.get("content"):
            extras.append(f'"{str(p["content"])[:80]}"')
        suffix = (" " + " ".join(extras)) if extras else ""
        lines.append(
            f"- {skill_name} (asset_id={asset.id}): 「{str(title)[:60]}」{suffix}"
        )

    if not lines:
        return ""
    return "\n".join(lines)


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
