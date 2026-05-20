from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.flash import router as flash_router
from api.assets import router as assets_router
from api.sessions import router as sessions_router
from api.query import router as query_router

app = FastAPI(title="Eureka API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(flash_router,    prefix="/api", tags=["flash"])
app.include_router(assets_router,   prefix="/api", tags=["assets"])
app.include_router(sessions_router, prefix="/api", tags=["sessions"])
app.include_router(query_router,    prefix="/api", tags=["query"])


@app.get("/health")
async def health():
    return {"status": "ok"}
