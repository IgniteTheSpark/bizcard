"""
POST /api/flash
Accepts a flash note text input, runs it through the multi-step flash pipeline,
and returns session_id + summary + cards for the UI.

Pipeline:
  1. Dispatcher  → identifies intents (todo / expense / contact / idea / note / qa)
  2. Sub-agents  → run in parallel per intent, create assets or answer questions
  3. Session writer → composes final {summary, cards, has_pending}

Voice flashes (is_voice=True) return immediately after the flash card is created;
the pipeline runs in a daemon thread with its own event loop so the uvicorn
event loop is never blocked and the HTTP response is delivered right away.
"""
import asyncio
import datetime
import json
import uuid
from datetime import date
from fastapi import APIRouter
from pydantic import BaseModel

from agents.flash_pipeline import run_flash_pipeline
from mcp.tools import create_asset, update_asset
from db.models import Session as DBSession, Asset as DBAsset
from db.database import AsyncSessionLocal
from sqlalchemy import select, func

router = APIRouter()


class FlashRequest(BaseModel):
    text: str
    session_id: str = ""
    is_followup: bool = False
    is_voice: bool = False


class FlashResponse(BaseModel):
    ok: bool
    session_id: str
    summary: str = ""
    cards: list = []
    has_pending: bool = False
    elapsed_ms: int = 0
    error: str = ""


async def _get_or_create_daily_session(user_id: str) -> str:
    """Return today's daily session ID, creating one if needed."""
    today = date.today()
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(DBSession).where(
                DBSession.user_id == user_id,
                DBSession.session_type == "daily",
                DBSession.date == today,
            )
        )
        sess = result.scalar_one_or_none()
        if not sess:
            sess = DBSession(
                user_id=user_id,
                session_type="daily",
                title=f"今日闪念 · {today.strftime('%Y-%m-%d')}",
                date=today,
            )
            db.add(sess)
            await db.commit()
        return str(sess.id)


async def _run_pipeline_background(
    text: str,
    db_session_id: str,
    flash_input_id: str,
    flash_asset_id: str,
    today_str: str,
    job_start: datetime.datetime,
) -> None:
    """Pipeline execution for voice flashes — called inside a daemon thread's event loop."""
    try:
        result = await run_flash_pipeline(
            user_text=text,
            session_id=db_session_id,
            input_id=flash_input_id,
            today_str=today_str,
        )
    except Exception:
        return

    # Tag any derived assets that are missing input_id; correct summary from DB
    try:
        async with AsyncSessionLocal() as db:
            rows = await db.execute(
                select(DBAsset).where(
                    DBAsset.session_id == uuid.UUID(db_session_id),
                    DBAsset.created_at >= job_start,
                )
            )
            assets_created = rows.scalars().all()
            changed = False
            non_flash = []
            for asset in assets_created:
                if asset.payload.get("asset_type") != "flash":
                    non_flash.append(asset)
                    if not asset.payload.get("input_id"):
                        asset.payload = {**asset.payload, "input_id": flash_input_id}
                        changed = True
            if changed:
                await db.commit()

        pipeline_summary = result.get("summary", "")
        if non_flash and (not pipeline_summary or "未识别" in pipeline_summary):
            n = len(non_flash)
            pipeline_summary = f"已记录 {n} 项内容。" if n > 1 else "已记录 1 项内容。"
        result["summary"] = pipeline_summary
    except Exception:
        pass

    # Write agent summary back into the flash card
    summary = result.get("summary", "")
    if flash_asset_id and summary:
        try:
            await update_asset(
                flash_asset_id,
                json.dumps({"agent_summary": summary}, ensure_ascii=False),
            )
        except Exception:
            pass


def _spawn_pipeline_thread(
    text: str,
    db_session_id: str,
    flash_input_id: str,
    flash_asset_id: str,
    today_str: str,
    job_start: datetime.datetime,
) -> None:
    """Schedule the flash pipeline as a fire-and-forget task in the running event loop.

    asyncio.ensure_future runs the coroutine in the SAME event loop as the DB pool,
    which avoids asyncpg "Future attached to a different loop" errors. The HTTP
    response is already returned by the time this task starts executing, so the
    30-second LLM wait does not delay the caller.
    """
    asyncio.ensure_future(_run_pipeline_background(
        text, db_session_id, flash_input_id, flash_asset_id, today_str, job_start,
    ))


@router.post("/flash", response_model=FlashResponse)
async def flash_endpoint(req: FlashRequest):
    user_id = "default"

    # Resolve or create today's daily session
    db_session_id = req.session_id or await _get_or_create_daily_session(user_id)

    # Generate a stable input_id that ties the raw flash card to its derived assets
    flash_input_id = str(uuid.uuid4())

    # ── Create raw flash card immediately ─────────────────────────────────────
    raw_payload = json.dumps({
        "content": req.text,
        "is_flash": True,
        "input_id": flash_input_id,
        "is_followup": req.is_followup,
        "is_voice": req.is_voice,
    }, ensure_ascii=False)
    flash_asset_result = await create_asset(
        asset_type="flash",
        payload=raw_payload,
        session_id=db_session_id,
        user_id=user_id,
    )
    flash_asset_id = flash_asset_result.get("asset_id", "")

    today_str = date.today().strftime("%Y年%m月%d日")
    job_start = datetime.datetime.now(datetime.timezone.utc)

    # ── Voice flash: fire-and-forget in a daemon thread, return immediately ──
    if req.is_voice:
        _spawn_pipeline_thread(
            req.text, db_session_id, flash_input_id, flash_asset_id, today_str, job_start,
        )
        return FlashResponse(ok=True, session_id=db_session_id, summary="语音已保存，正在处理…")

    # ── Text flash: run pipeline synchronously ────────────────────────────────
    try:
        result = await run_flash_pipeline(
            user_text=req.text,
            session_id=db_session_id,
            input_id=flash_input_id,
            today_str=today_str,
        )
    except Exception as e:
        return FlashResponse(ok=False, session_id=db_session_id, error=str(e))

    # ── Retroactively tag derived assets and correct summary from DB ──────────
    try:
        async with AsyncSessionLocal() as db:
            rows = await db.execute(
                select(DBAsset).where(
                    DBAsset.session_id == uuid.UUID(db_session_id),
                    DBAsset.created_at >= job_start,
                )
            )
            assets_created = rows.scalars().all()
            changed = False
            non_flash = []
            for asset in assets_created:
                if asset.payload.get("asset_type") != "flash":
                    non_flash.append(asset)
                    if not asset.payload.get("input_id"):
                        asset.payload = {**asset.payload, "input_id": flash_input_id}
                        changed = True
            if changed:
                await db.commit()

        # If pipeline summary says nothing was found but assets actually exist in DB,
        # correct the summary (Gemini sometimes outputs Chinese text instead of JSON).
        pipeline_summary = result.get("summary", "")
        if non_flash and (not pipeline_summary or "未识别" in pipeline_summary):
            n = len(non_flash)
            pipeline_summary = f"已记录 {n} 项内容。" if n > 1 else "已记录 1 项内容。"
        summary = pipeline_summary
    except Exception:
        summary = result.get("summary", "")

    # ── Store agent summary back into the flash card ──────────────────────────
    if flash_asset_id and summary:
        try:
            await update_asset(
                flash_asset_id,
                json.dumps({"agent_summary": summary}, ensure_ascii=False),
            )
        except Exception:
            pass

    elapsed_ms = int((datetime.datetime.now(datetime.timezone.utc) - job_start).total_seconds() * 1000)

    return FlashResponse(
        ok=result.get("ok", True),
        session_id=result.get("session_id", db_session_id),
        summary=summary,
        cards=result.get("cards", []),
        has_pending=result.get("has_pending", False),
        elapsed_ms=elapsed_ms,
    )
