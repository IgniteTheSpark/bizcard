"""
Eureka FastAPI app — Phase B Step 5 (v1.3).

Wires up 8 routers + lifecycle hooks:
- core.llm.configure_llm_env() at startup (sets OPENROUTER_API_KEY env)
- agents.mcp_toolset.close_mcp_toolset() at shutdown (closes stdio subprocess)

NOTE on nest_asyncio:
Kept for now. Step 7 diagnoses the root cause (likely LiteLLM internal
sync→async pattern or Google genai SDK call site) and removes this hack.

Dropped from previous version:
- api/query.py     → merged into api/chat.py (unified Assistant via SSE)
- api/flash_audio  → audio upload path deferred per Phase A
- StaticFiles mount for uploads/  → no audio files in demo
"""
import nest_asyncio  # TODO Step 7: diagnose root cause + remove
nest_asyncio.apply()

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configure LLM env BEFORE importing routers (which import agents → instantiate models)
from core.llm import configure_llm_env
configure_llm_env()

from agents.mcp_toolset import close_mcp_toolset
from api.chat import router as chat_router
from api.flash import router as flash_router
from api.skills import router as skills_router
from api.input_turns import router as input_turns_router
from api.files import router as files_router
from api.assets import router as assets_router
from api.sessions import router as sessions_router
from api.contacts import router as contacts_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """App lifecycle: startup is implicit; shutdown closes the MCP subprocess."""
    yield
    await close_mcp_toolset()


app = FastAPI(title="Eureka API", version="1.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router,        prefix="/api", tags=["chat"])
app.include_router(flash_router,       prefix="/api", tags=["flash"])
app.include_router(skills_router,      prefix="/api", tags=["skills"])
app.include_router(input_turns_router, prefix="/api", tags=["input-turns"])
app.include_router(files_router,       prefix="/api", tags=["files"])
app.include_router(assets_router,      prefix="/api", tags=["assets"])
app.include_router(sessions_router,    prefix="/api", tags=["sessions"])
app.include_router(contacts_router,    prefix="/api", tags=["contacts"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "phase-b-v1.3"}
