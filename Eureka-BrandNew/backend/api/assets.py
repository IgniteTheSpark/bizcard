"""
GET  /api/assets          — list assets (with optional structured filters)
GET  /api/assets/{id}     — single asset detail
POST /api/assets          — manually create asset
"""
import json
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional

from mcp.tools import create_asset, delete_asset
from db.queries import query_assets_structured
from db.database import AsyncSessionLocal
from db.models import Asset
from sqlalchemy import select
import uuid

router = APIRouter()


class CreateAssetRequest(BaseModel):
    asset_type: str
    payload: dict
    session_id: str = ""


@router.get("/assets")
async def list_assets(
    type: Optional[str]   = Query(None, description="Asset type filter"),
    field: Optional[str]  = Query(None, description="Field name for structured filter"),
    op: Optional[str]     = Query("eq", description="eq|gt|gte|lt|lte"),
    value: Optional[str]  = Query(None, description="Filter value"),
    contains: Optional[str] = Query(None, description="Keyword search in payload"),
    limit: int            = Query(50, le=200),
):
    """
    Structured filter example:
      GET /api/assets?type=expense&field=amount&op=eq&value=150
    Simple keyword:
      GET /api/assets?type=todo&contains=刘洋
    """
    filters = []
    if field and value is not None:
        filters.append({"field": field, "op": op or "eq", "value": value})

    if filters:
        async with AsyncSessionLocal() as db:
            assets = await query_assets_structured(db, "default", type, filters, limit)
        return {"ok": True, "assets": assets}

    # Fallback: keyword search via MCP tool
    from mcp.tools import query_asset
    result = await query_asset(asset_type=type or "", contains=contains or "")
    return result


@router.get("/assets/{asset_id}")
async def get_asset(asset_id: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Asset).where(Asset.id == uuid.UUID(asset_id), Asset.user_id == "default")
        )
        asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return {
        "ok": True,
        "asset": {
            "id": str(asset.id),
            "payload": asset.payload,
            "session_id": str(asset.session_id) if asset.session_id else None,
            "created_at": asset.created_at.isoformat(),
        }
    }


@router.post("/assets")
async def manual_create_asset(req: CreateAssetRequest):
    result = await create_asset(
        asset_type=req.asset_type,
        payload=json.dumps(req.payload, ensure_ascii=False),
        session_id=req.session_id,
    )
    return result
