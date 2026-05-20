from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine
from contextlib import asynccontextmanager
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://eureka:eureka@localhost:5432/eureka")

# Async engine for FastAPI request handlers
ASYNC_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
async_engine = create_async_engine(ASYNC_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False)

# Sync engine for Alembic migrations and seed scripts
sync_engine = create_engine(DATABASE_URL, echo=False)


@asynccontextmanager
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
