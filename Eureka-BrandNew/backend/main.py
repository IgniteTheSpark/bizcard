import os
from pathlib import Path
import nest_asyncio
nest_asyncio.apply()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
os.environ.setdefault("OPENROUTER_API_KEY", settings.openrouter_api_key)
if settings.openai_api_key:
    os.environ.setdefault("OPENAI_API_KEY", settings.openai_api_key)

from api.flash import router as flash_router
from api.flash_audio import router as flash_audio_router
from api.assets import router as assets_router
from api.sessions import router as sessions_router
from api.query import router as query_router
from api.contacts import router as contacts_router

app = FastAPI(title="Eureka API", version="1.0.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded audio files
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.include_router(flash_router,       prefix="/api", tags=["flash"])
app.include_router(flash_audio_router, prefix="/api", tags=["flash-audio"])
app.include_router(assets_router,      prefix="/api", tags=["assets"])
app.include_router(sessions_router,    prefix="/api", tags=["sessions"])
app.include_router(query_router,       prefix="/api", tags=["query"])
app.include_router(contacts_router,    prefix="/api", tags=["contacts"])


@app.get("/health")
async def health():
    return {"status": "ok"}
