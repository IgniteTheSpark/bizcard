"""
POST /api/flash/audio
Accepts a multipart audio file upload, transcribes with OpenAI Whisper,
then runs the same flash_agent pipeline as POST /api/flash.

The resulting flash asset includes audio_url (for playback) and transcript.
"""
import json
import os
import re
import uuid
from datetime import date
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part

from agents.flash_agent import flash_agent
from mcp.tools import create_asset
from db.models import Session as DBSession
from db.database import AsyncSessionLocal
from sqlalchemy import select

router = APIRouter()

_session_service = InMemorySessionService()
APP_NAME = "eureka-flash-audio"

# Directory for uploaded audio files — served as static files by main.py
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


class FlashAudioResponse(BaseModel):
    ok: bool
    session_id: str = ""
    summary: str = ""
    cards: list = []
    has_pending: bool = False
    transcript: str = ""
    audio_url: str = ""
    error: str = ""


async def _get_or_create_daily_session(user_id: str) -> str:
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


async def _transcribe_audio(file_content: bytes, filename: str) -> str:
    """Transcribe audio using OpenAI Whisper. Returns transcript text."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY is not set. Add it to .env to enable audio transcription."
        )

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    # Determine MIME type from extension
    ext = Path(filename).suffix.lower()
    mime_map = {
        ".m4a": "audio/mp4",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".webm": "audio/webm",
        ".mp4": "audio/mp4",
    }
    mime = mime_map.get(ext, "audio/mpeg")

    response = await client.audio.transcriptions.create(
        model="whisper-1",
        file=(filename, file_content, mime),
        language="zh",
        response_format="text",
    )
    return str(response).strip()


@router.post("/flash/audio", response_model=FlashAudioResponse)
async def flash_audio_endpoint(
    audio: UploadFile = File(...),
    session_id: str = Form(""),
):
    user_id = "default"
    db_session_id = session_id or await _get_or_create_daily_session(user_id)

    # ── 1. Save audio file ────────────────────────────────────────────────────
    raw_filename = audio.filename or "recording.m4a"
    ext = Path(raw_filename).suffix or ".m4a"
    file_id = str(uuid.uuid4())
    stored_filename = f"{file_id}{ext}"
    file_content = await audio.read()
    (UPLOAD_DIR / stored_filename).write_bytes(file_content)
    audio_url = f"/api/uploads/{stored_filename}"

    # ── 2. Transcribe ─────────────────────────────────────────────────────────
    try:
        transcript = await _transcribe_audio(file_content, stored_filename)
    except Exception as e:
        return FlashAudioResponse(
            ok=False,
            session_id=db_session_id,
            error=f"转录失败: {e}",
        )

    if not transcript:
        return FlashAudioResponse(
            ok=False,
            session_id=db_session_id,
            error="转录结果为空，请检查音频文件",
        )

    # ── 3. Create raw flash card (with audio_url + transcript) ────────────────
    flash_input_id = str(uuid.uuid4())
    raw_payload = json.dumps(
        {
            "content": transcript,
            "is_flash": True,
            "input_id": flash_input_id,
            "audio_url": audio_url,
            "original_filename": raw_filename,
        },
        ensure_ascii=False,
    )
    await create_asset(
        asset_type="flash",
        payload=raw_payload,
        session_id=db_session_id,
        user_id=user_id,
    )

    # ── 4. Run flash agent with transcript ────────────────────────────────────
    adk_session_id = str(uuid.uuid4())
    await _session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=adk_session_id,
    )

    runner = Runner(
        agent=flash_agent,
        app_name=APP_NAME,
        session_service=_session_service,
    )

    today_str = date.today().strftime("%Y年%m月%d日")
    enriched_text = (
        f"今天是 {today_str}。\n"
        f"session_id: {db_session_id}\n"
        f"input_id: {flash_input_id}\n"
        f"user_text: {transcript}"
    )
    user_msg = Content(role="user", parts=[Part(text=enriched_text)])

    final_text = ""
    try:
        async for event in runner.run_async(
            user_id=user_id,
            session_id=adk_session_id,
            new_message=user_msg,
        ):
            if event.is_final_response() and event.content:
                final_text = event.content.parts[0].text if event.content.parts else ""
    except Exception as e:
        return FlashAudioResponse(
            ok=False,
            session_id=db_session_id,
            transcript=transcript,
            audio_url=audio_url,
            error=str(e),
        )

    # ── 5. Parse agent JSON output ────────────────────────────────────────────
    result = None
    if final_text:
        try:
            result = json.loads(final_text.strip())
        except (json.JSONDecodeError, ValueError):
            pass

        if result is None:
            for m in re.finditer(r'\{[^{}]*"cards"[^{}]*\[.*?\][^{}]*\}', final_text, re.DOTALL):
                try:
                    result = json.loads(m.group())
                    break
                except (json.JSONDecodeError, ValueError):
                    continue

        if result is None:
            matches = list(re.finditer(r'\{[\s\S]+\}', final_text))
            for m in reversed(matches):
                try:
                    candidate = json.loads(m.group())
                    if isinstance(candidate, dict) and ("cards" in candidate or "summary" in candidate):
                        result = candidate
                        break
                except (json.JSONDecodeError, ValueError):
                    continue

    if result and isinstance(result, dict):
        return FlashAudioResponse(
            ok=True,
            session_id=result.get("session_id", db_session_id),
            summary=result.get("summary", ""),
            cards=result.get("cards", []),
            has_pending=result.get("has_pending", False),
            transcript=transcript,
            audio_url=audio_url,
        )

    return FlashAudioResponse(
        ok=True,
        session_id=db_session_id,
        summary=transcript[:120] if transcript else "已处理",
        transcript=transcript,
        audio_url=audio_url,
    )
