"""
GET  /api/sessions         — list sessions (optionally filtered by date)
POST /api/sessions         — create a session manually
GET  /api/sessions/{id}    — session detail with asset summary
"""
from datetime import date
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select, func

from db.models import Session as DBSession, Asset, Message
from db.database import AsyncSessionLocal
import uuid

router = APIRouter()


class CreateSessionRequest(BaseModel):
    session_type: str = "daily"
    title: str = ""
    date: Optional[str] = None


@router.get("/sessions")
async def list_sessions(
    date_str: Optional[str] = Query(None, alias="date", description="YYYY-MM-DD"),
    session_type: Optional[str] = Query(None),
    limit: int = Query(30, le=100),
):
    async with AsyncSessionLocal() as db:
        stmt = select(DBSession).where(DBSession.user_id == "default")
        if date_str:
            try:
                d = date.fromisoformat(date_str)
                stmt = stmt.where(DBSession.date == d)
            except ValueError:
                pass
        if session_type:
            stmt = stmt.where(DBSession.session_type == session_type)
        stmt = stmt.order_by(DBSession.created_at.desc()).limit(limit)
        result = await db.execute(stmt)
        sessions = result.scalars().all()

    return {
        "ok": True,
        "sessions": [
            {
                "id": str(s.id),
                "session_type": s.session_type,
                "title": s.title,
                "date": s.date.isoformat() if s.date else None,
                "created_at": s.created_at.isoformat(),
            }
            for s in sessions
        ],
    }


@router.post("/sessions")
async def create_session(req: CreateSessionRequest):
    async with AsyncSessionLocal() as db:
        sess = DBSession(
            user_id="default",
            session_type=req.session_type,
            title=req.title or None,
            date=date.fromisoformat(req.date) if req.date else date.today(),
        )
        db.add(sess)
        await db.commit()
    return {"ok": True, "session_id": str(sess.id)}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(DBSession).where(
                DBSession.id == uuid.UUID(session_id),
                DBSession.user_id == "default",
            )
        )
        sess = result.scalar_one_or_none()
        if not sess:
            raise HTTPException(status_code=404, detail="Session not found")

        # Count assets
        count_result = await db.execute(
            select(func.count(Asset.id)).where(Asset.session_id == sess.id)
        )
        asset_count = count_result.scalar() or 0

        # Fetch assets
        assets_result = await db.execute(
            select(Asset).where(Asset.session_id == sess.id)
            .order_by(Asset.created_at.asc())
        )
        assets = assets_result.scalars().all()

    return {
        "ok": True,
        "session": {
            "id": str(sess.id),
            "session_type": sess.session_type,
            "title": sess.title,
            "date": sess.date.isoformat() if sess.date else None,
            "created_at": sess.created_at.isoformat(),
            "asset_count": asset_count,
            "assets": [
                {"id": str(a.id), "payload": a.payload, "created_at": a.created_at.isoformat()}
                for a in assets
            ],
        }
    }


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str):
    """Return messages for a session, oldest first."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Message)
            .where(Message.session_id == uuid.UUID(session_id))
            .order_by(Message.created_at.asc())
        )
        messages = result.scalars().all()

    return {
        "ok": True,
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "text": m.text,
                "cards": m.cards or [],
                "elapsed_ms": m.elapsed_ms,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ]
    }
