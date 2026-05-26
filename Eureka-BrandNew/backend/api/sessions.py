"""
Session listing / detail / message log — Phase B Step 5 rewrite.

GET  /api/sessions                       — list sessions (filter by date / type)
POST /api/sessions                       — create a session manually (rare; usually auto-created)
GET  /api/sessions/{id}                  — session detail + asset summary
GET  /api/sessions/{id}/messages         — message log (chat history)
GET  /api/sessions/{id}/input-turns      — input_turns for this session (NEW in Step 5)

Default session_type for manual create is now 'manual' (per Phase B v1.3).
"""
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func

from core.auth import get_current_user_id
from db.database import AsyncSessionLocal
from db.models import (
    Session as DBSession, Asset, GlobalSkill, InputTurn, Message, UserSkill,
    Contact, Event, File,
)

router = APIRouter()


class CreateSessionRequest(BaseModel):
    session_type: str = "manual"   # flash | chat | meeting | manual
    title: str = ""
    date: Optional[str] = None     # YYYY-MM-DD
    # M2.2: assets to attach as contextual input. Typically populated when
    # the user clicks 「在 chat 里讨论」 on an asset in Library / chat history.
    # The Assistant prompt loads + injects these as 「本 session 上下文资产」.
    context_asset_ids: Optional[list[str]] = None


# ── GET /api/sessions ──────────────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(
    date_str: Optional[str]      = Query(None, alias="date", description="YYYY-MM-DD"),
    session_type: Optional[str]  = Query(None, description="flash | chat | meeting | manual"),
    limit: int                   = Query(30, le=100),
    user_id: str                 = Depends(get_current_user_id),
):
    async with AsyncSessionLocal() as db:
        stmt = select(DBSession).where(DBSession.user_id == user_id)
        if date_str:
            try:
                stmt = stmt.where(DBSession.date == date.fromisoformat(date_str))
            except ValueError:
                pass
        if session_type:
            stmt = stmt.where(DBSession.session_type == session_type)
        stmt = stmt.order_by(DBSession.created_at.desc()).limit(limit)
        sessions = (await db.execute(stmt)).scalars().all()

    return {
        "ok": True,
        "sessions": [
            {
                "id":           str(s.id),
                "session_type": s.session_type,
                "title":        s.title,
                "date":         s.date.isoformat() if s.date else None,
                "created_at":   s.created_at.isoformat(),
            }
            for s in sessions
        ],
    }


# ── POST /api/sessions (manual create — rare) ─────────────────────────────────

@router.post("/sessions")
async def create_session(
    req: CreateSessionRequest,
    user_id: str = Depends(get_current_user_id),
):
    if req.session_type not in {"flash", "chat", "meeting", "manual"}:
        raise HTTPException(status_code=400, detail=f"invalid session_type: {req.session_type}")

    sess_date = None
    if req.date:
        try:
            sess_date = date.fromisoformat(req.date)
        except ValueError:
            raise HTTPException(status_code=400, detail="invalid date format (use YYYY-MM-DD)")

    # Parse + validate context_asset_ids → UUIDs
    ctx_ids: list = []
    if req.context_asset_ids:
        for s in req.context_asset_ids:
            try:
                ctx_ids.append(uuid.UUID(s))
            except ValueError:
                raise HTTPException(status_code=400, detail=f"invalid asset id: {s}")

    async with AsyncSessionLocal() as db:
        sess = DBSession(
            user_id=user_id,
            session_type=req.session_type,
            title=req.title or None,
            date=sess_date,
            context_asset_ids=ctx_ids,
        )
        db.add(sess)
        await db.commit()
        await db.refresh(sess)

    return {
        "ok": True,
        "session_id": str(sess.id),
        "context_asset_ids": [str(i) for i in (sess.context_asset_ids or [])],
    }


# ── GET /api/sessions/{id} ────────────────────────────────────────────────────

@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid session id")

    async with AsyncSessionLocal() as db:
        sess = (await db.execute(
            select(DBSession).where(DBSession.id == sid, DBSession.user_id == user_id)
        )).scalar_one_or_none()
        if not sess:
            raise HTTPException(status_code=404, detail="session not found")

        asset_count = (await db.execute(
            select(func.count(Asset.id)).where(Asset.session_id == sid)
        )).scalar() or 0

        turn_count = (await db.execute(
            select(func.count(InputTurn.id)).where(InputTurn.session_id == sid)
        )).scalar() or 0

        assets = (await db.execute(
            select(Asset).where(Asset.session_id == sid).order_by(Asset.created_at.asc())
        )).scalars().all()

    return {
        "ok": True,
        "session": {
            "id":           str(sess.id),
            "session_type": sess.session_type,
            "title":        sess.title,
            "date":         sess.date.isoformat() if sess.date else None,
            "created_at":   sess.created_at.isoformat(),
            "context_asset_ids": [str(i) for i in (sess.context_asset_ids or [])],
            # M2.3: subject FKs — exactly one is non-null for home sessions
            "event_id":         str(sess.event_id) if sess.event_id else None,
            "contact_id":       str(sess.contact_id) if sess.contact_id else None,
            "file_id":          str(sess.file_id) if sess.file_id else None,
            "subject_asset_id": str(sess.subject_asset_id) if sess.subject_asset_id else None,
            "asset_count":  asset_count,
            "turn_count":   turn_count,
            "assets": [
                {
                    "id":         str(a.id),
                    "payload":    a.payload,
                    "created_at": a.created_at.isoformat(),
                }
                for a in assets
            ],
        },
    }


# ── GET /api/sessions/{id}/messages ───────────────────────────────────────────

@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Return messages for a session, oldest first. Includes tool_call / tool_result."""
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid session id")

    async with AsyncSessionLocal() as db:
        messages = (await db.execute(
            select(Message)
            .where(Message.session_id == sid, Message.user_id == user_id)
            .order_by(Message.created_at.asc())
        )).scalars().all()

    return {
        "ok": True,
        "messages": [
            {
                "id":          str(m.id),
                "role":        m.role,
                "text":        m.text,
                "tool_call":   m.tool_call,
                "tool_result": m.tool_result,
                "cards":       m.cards or [],
                "elapsed_ms":  m.elapsed_ms,
                "created_at":  m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


# ── GET /api/sessions/{id}/input-turns ────────────────────────────────────────

@router.get("/sessions/{session_id}/input-turns")
async def get_session_input_turns(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """
    Return all input_turns for a session, ordered by index (so they replay
    in capture order). Used by:
    - Flash session UI: list today's flashes
    - SessionTurnCard (design §7.2): show siblings of an asset's source turn
    """
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid session id")

    async with AsyncSessionLocal() as db:
        turns = (await db.execute(
            select(InputTurn)
            .where(InputTurn.session_id == sid, InputTurn.user_id == user_id)
            .order_by(InputTurn.index.asc())
        )).scalars().all()

    return {
        "ok": True,
        "input_turns": [
            {
                "id":                  str(t.id),
                "index":               t.index,
                "source":              t.source,
                "text":                t.text,
                "file_id":             str(t.file_id) if t.file_id else None,
                "source_file_offset":  t.source_file_offset,
                "created_at":          t.created_at.isoformat(),
            }
            for t in turns
        ],
    }


# ── POST /api/sessions/for-subject  ─────────────────────────────────────────
# Get-or-create the home discussion session for a given asset / entity.
# Called by the frontend's「在 chat 里讨论」 button.
#
# Subject types and their FK columns:
#   contact → sessions.contact_id
#   event   → sessions.event_id
#   file    → sessions.file_id
#   asset   → sessions.subject_asset_id  (any asset-skill row)
#
# Title auto-derived from the subject's name/title field. Each user gets at
# most ONE chat session per subject — repeated clicks reuse the existing one.

class SessionForSubjectRequest(BaseModel):
    subject_type: str           # "contact" | "event" | "file" | "asset"
    subject_id:   str


SUBJECT_FK_COLUMN = {
    "contact": "contact_id",
    "event":   "event_id",
    "file":    "file_id",
    "asset":   "subject_asset_id",
}


@router.post("/sessions/for-subject")
async def get_or_create_subject_session(
    req: SessionForSubjectRequest,
    user_id: str = Depends(get_current_user_id),
):
    fk = SUBJECT_FK_COLUMN.get(req.subject_type)
    if not fk:
        raise HTTPException(
            status_code=400,
            detail=f"invalid subject_type: {req.subject_type}",
        )
    try:
        sid = uuid.UUID(req.subject_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid subject_id")

    async with AsyncSessionLocal() as db:
        # Look for existing home session
        stmt = select(DBSession).where(
            DBSession.user_id == user_id,
            getattr(DBSession, fk) == sid,
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            return {
                "ok": True,
                "session_id": str(existing.id),
                "subject_type": req.subject_type,
                "subject_id": req.subject_id,
                "created": False,
            }

        # None found → create new home session with a derived title
        title = await _derive_subject_title(db, req.subject_type, sid)
        sess_kwargs: dict = {
            "user_id":      user_id,
            "session_type": "chat",
            "title":        title,
            fk:             sid,
        }
        sess = DBSession(**sess_kwargs)
        db.add(sess)
        await db.commit()
        await db.refresh(sess)

        return {
            "ok": True,
            "session_id": str(sess.id),
            "subject_type": req.subject_type,
            "subject_id": req.subject_id,
            "created": True,
        }


async def _derive_subject_title(db, subject_type: str, subject_id) -> str:
    """Best-effort short title for a freshly-created home session."""
    if subject_type == "contact":
        c = (await db.execute(select(Contact).where(Contact.id == subject_id))).scalar_one_or_none()
        return f"{c.name} 的对话" if c and c.name else "联系人对话"
    if subject_type == "event":
        e = (await db.execute(select(Event).where(Event.id == subject_id))).scalar_one_or_none()
        return f"{e.title}" if e and e.title else "事件对话"
    if subject_type == "file":
        f = (await db.execute(select(File).where(File.id == subject_id))).scalar_one_or_none()
        return f"文件 · {(f.file_type or '?') if f else '?'}"
    if subject_type == "asset":
        a = (await db.execute(select(Asset).where(Asset.id == subject_id))).scalar_one_or_none()
        if a and a.payload:
            p = a.payload
            t = p.get("content") or p.get("title") or p.get("name") or p.get("description")
            if t:
                return f"讨论:{str(t)[:24]}"
        return "资产对话"
    return "对话"


# ── PATCH /api/sessions/{id}/context  ───────────────────────────────────────
# Add or remove assets from sessions.context_asset_ids (M2.2). Used by
# ContextChipRail's「+ 添加资产」 picker and chip-remove × button.

class PatchContextRequest(BaseModel):
    add:    Optional[list[str]] = None   # asset ids to add (dedup against existing)
    remove: Optional[list[str]] = None   # asset ids to remove


@router.patch("/sessions/{session_id}/context")
async def patch_session_context(
    session_id: str,
    req: PatchContextRequest,
    user_id: str = Depends(get_current_user_id),
):
    try:
        sid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid session id")

    add_uuids    = _parse_uuid_list(req.add)
    remove_uuids = _parse_uuid_list(req.remove)

    async with AsyncSessionLocal() as db:
        sess = (await db.execute(
            select(DBSession).where(DBSession.id == sid, DBSession.user_id == user_id)
        )).scalar_one_or_none()
        if not sess:
            raise HTTPException(status_code=404, detail="session not found")

        current = list(sess.context_asset_ids or [])
        # Add (dedup)
        for u in add_uuids:
            if u not in current:
                current.append(u)
        # Remove
        if remove_uuids:
            remove_set = set(remove_uuids)
            current = [u for u in current if u not in remove_set]
        sess.context_asset_ids = current
        await db.commit()
        await db.refresh(sess)

    return {
        "ok": True,
        "session_id": session_id,
        "context_asset_ids": [str(u) for u in (sess.context_asset_ids or [])],
    }


def _parse_uuid_list(raw: Optional[list[str]]) -> list:
    if not raw:
        return []
    out = []
    for s in raw:
        try:
            out.append(uuid.UUID(s))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"invalid uuid: {s}")
    return out
