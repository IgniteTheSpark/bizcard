"""
POST /api/flash — Voice flash ingest → Flash Pipeline (Phase B Step 5).

Per-request lifecycle:
1. Resolve / create today's flash session (get-or-create by user + date)
   — Phase B v1.3 折中:flash session 按天聚合,每次闪念是 session 内一个 input_turn
2. Create input_turn(source='voice', or 'typed' if explicitly typed in
   the flash UI) — provenance for derived assets
3. Run Flash Pipeline (3-step Python orchestration) — fans out to
   parallel skill agents; each create_asset writes source_input_turn_id
4. Return derived assets + summary + cards as sync JSON
5. Persist a single agent Message to messages table so the chat-like
   surface in Phase D can replay the flash result

Sync (not SSE) for demo simplicity — Phase D shows progress via UI animation
(60ms stagger per card per design §3.5). Easy to upgrade to SSE later if
real-time intermediate events become a product requirement.
"""
import datetime
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from agents.flash_pipeline import run_flash_pipeline
from core.auth import get_current_user_id
from core.session_service import (
    create_input_turn_for_message,
    persist_chat_turn,
)
from db.database import AsyncSessionLocal
from db.models import Session as DBSession

router = APIRouter()


# ── Request / response ─────────────────────────────────────────────────────────

class FlashRequest(BaseModel):
    text: str
    session_id: str = ""     # empty = get-or-create today's flash session
    source: str = "voice"    # voice | typed (per Phase B v1.3 modality)
    file_id: str = ""        # optional, when real audio upload exists (future)


class FlashResponse(BaseModel):
    ok:            bool
    session_id:    str
    input_turn_id: str
    summary:       str = ""
    cards:         list = []
    derived_assets: list = []
    has_pending:   bool = False
    elapsed_ms:    int = 0
    error:         str = ""


# ── Today's flash-session resolver ────────────────────────────────────────────

async def _get_or_create_flash_session_today(db, user_id: str) -> DBSession:
    """
    Flash sessions aggregate by natural day. Same user + same date → reuse;
    otherwise create. Title is set to 「M月D日 闪念」 on creation.
    """
    today = datetime.date.today()
    result = await db.execute(
        select(DBSession).where(
            DBSession.user_id == user_id,
            DBSession.session_type == "flash",
            DBSession.date == today,
        )
    )
    sess = result.scalar_one_or_none()
    if sess:
        return sess

    sess = DBSession(
        user_id=user_id,
        session_type="flash",
        title=f"{today.month}月{today.day}日 闪念",
        date=today,
    )
    db.add(sess)
    await db.commit()
    await db.refresh(sess)
    return sess


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/flash", response_model=FlashResponse)
async def flash(req: FlashRequest, user_id: str = Depends(get_current_user_id)):
    t0 = time.monotonic()
    today_str = datetime.date.today().strftime("%Y年%m月%d日")

    # Phase 1 — resolve session + create input_turn
    try:
        async with AsyncSessionLocal() as db:
            if req.session_id:
                # Caller specified a session (e.g. retry / explicit). Trust it.
                result = await db.execute(
                    select(DBSession).where(
                        DBSession.id == uuid.UUID(req.session_id),
                        DBSession.user_id == user_id,
                    )
                )
                session = result.scalar_one_or_none()
                if not session:
                    raise HTTPException(status_code=404, detail="session not found")
            else:
                session = await _get_or_create_flash_session_today(db, user_id)

            session_id = str(session.id)

            # Always 'voice' for flash unless explicitly overridden to 'typed'.
            # 'imported' would come from a future bulk import flow.
            input_source = req.source if req.source in {"voice", "typed", "imported"} else "voice"
            turn = await create_input_turn_for_message(
                db, session_id, user_id, req.text, source=input_source,
            )
            input_turn_id = str(turn.id)
    except HTTPException:
        raise
    except Exception as e:
        return FlashResponse(ok=False, session_id="", input_turn_id="", error=str(e)[:200])

    # Phase 2 — run Flash Pipeline (dispatcher → parallel sub-skills → aggregate)
    try:
        result = await run_flash_pipeline(
            user_text=req.text,
            session_id=session_id,
            input_turn_id=input_turn_id,
            today_str=today_str,
            user_id=user_id,
        )
    except Exception as e:
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        return FlashResponse(
            ok=False, session_id=session_id, input_turn_id=input_turn_id,
            error=str(e)[:200], elapsed_ms=elapsed_ms,
        )

    # Phase 3 — persist an agent Message so the chat surface can replay
    summary = result.get("summary", "")
    cards   = result.get("cards", [])
    elapsed_ms = int((time.monotonic() - t0) * 1000)

    try:
        async with AsyncSessionLocal() as db:
            await persist_chat_turn(
                db, session_id, user_id,
                user_text=req.text,
                agent_text=summary,
                cards=cards,
                elapsed_ms=elapsed_ms,
            )
    except Exception:
        # Persistence failure is non-fatal for the immediate response —
        # the derived assets are already in the DB via run_flash_pipeline.
        pass

    return FlashResponse(
        ok=result.get("ok", True),
        session_id=session_id,
        input_turn_id=input_turn_id,
        summary=summary,
        cards=cards,
        derived_assets=result.get("derived_assets", []),
        has_pending=result.get("has_pending", False),
        elapsed_ms=elapsed_ms,
    )
