"""
POST /api/query — global knowledge Q&A via ADK query_agent
"""
import uuid
from fastapi import APIRouter
from pydantic import BaseModel

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part

from agents.query_agent import query_agent

router = APIRouter()

_session_service = InMemorySessionService()
APP_NAME = "eureka-query"


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    ok: bool
    answer: str = ""
    assets: list = []
    error: str = ""


@router.post("/query", response_model=QueryResponse)
async def query_endpoint(req: QueryRequest):
    user_id = "default"
    adk_session_id = str(uuid.uuid4())

    await _session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=adk_session_id,
    )

    runner = Runner(
        agent=query_agent,
        app_name=APP_NAME,
        session_service=_session_service,
    )

    user_msg = Content(role="user", parts=[Part(text=req.question)])

    answer = ""
    try:
        async for event in runner.run_async(
            user_id=user_id,
            session_id=adk_session_id,
            new_message=user_msg,
        ):
            if event.is_final_response() and event.content:
                answer = event.content.parts[0].text if event.content.parts else ""
    except Exception as e:
        return QueryResponse(ok=False, error=str(e))

    return QueryResponse(ok=True, answer=answer)
