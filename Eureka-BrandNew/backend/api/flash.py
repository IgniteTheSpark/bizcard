"""
POST /api/flash
Accepts a flash note text input, runs it through the ADK flash_agent pipeline,
and returns session_id + structured cards for the UI.
"""
import json
import uuid
from datetime import date
from fastapi import APIRouter
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
APP_NAME = "eureka-flash"


class FlashRequest(BaseModel):
    text: str
    session_id: str = ""


class FlashResponse(BaseModel):
    ok: bool
    session_id: str
    summary: str = ""
    cards: list = []
    has_pending: bool = False
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


@router.post("/flash", response_model=FlashResponse)
async def flash_endpoint(req: FlashRequest):
    user_id = "default"

    # Resolve or create today's daily session
    db_session_id = req.session_id or await _get_or_create_daily_session(user_id)

    # Create ADK session
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

    # Inject session context into the message
    enriched_text = (
        f"session_id: {db_session_id}\n"
        f"input_id: {str(uuid.uuid4())}\n"
        f"user_text: {req.text}"
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
        return FlashResponse(ok=False, session_id=db_session_id, error=str(e))

    # Parse session writer output (JSON) if present
    try:
        result = json.loads(final_text)
        return FlashResponse(
            ok=True,
            session_id=result.get("session_id", db_session_id),
            summary=result.get("summary", ""),
            cards=result.get("cards", []),
            has_pending=result.get("has_pending", False),
        )
    except (json.JSONDecodeError, AttributeError):
        # Agent returned plain text — wrap as a single qa card
        return FlashResponse(
            ok=True,
            session_id=db_session_id,
            summary=final_text[:80] if final_text else "已处理",
            cards=[{"type": "qa", "title": "回答", "subtitle": final_text}],
        )
