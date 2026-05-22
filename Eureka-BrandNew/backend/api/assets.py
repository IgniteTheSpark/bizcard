"""
GET    /api/assets          — list assets (with optional structured filters)
GET    /api/assets/{id}     — single asset detail
POST   /api/assets          — manually create asset
PUT    /api/assets/{id}     — update asset (merges payload + resyncs asset_fields)
"""
import json
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional, Any

from mcp.tools import create_asset, delete_asset
from db.queries import query_assets_structured
from db.database import AsyncSessionLocal
from db.models import Asset, AssetField, UserSkill
from sqlalchemy import select, delete, Text
import uuid

router = APIRouter()


class CreateAssetRequest(BaseModel):
    asset_type: str
    payload: dict
    session_id: str = ""


class UpdateAssetRequest(BaseModel):
    payload_patch: dict  # fields to merge into existing payload


# ── helpers ────────────────────────────────────────────────────────────────────

def _cast_field(value: Any, index_type: str) -> tuple[str | None, Decimal | None, datetime | None]:
    """
    Return (value_text, value_number, value_date) based on index_type.

    Accepted aliases:
      number  | numeric          → value_number (Decimal)
      date    | datetime         → value_date   (datetime with tz)
      text    | enum  | <other>  → value_text   (str)
    """
    vt = vn = vd = None
    if index_type in ("number", "numeric"):
        try:
            vn = Decimal(str(value))
        except (InvalidOperation, TypeError):
            pass
    elif index_type in ("date", "datetime"):
        try:
            if isinstance(value, str):
                # Accept YYYY-MM-DD or full ISO
                raw = value.strip().replace("Z", "+00:00")
                if len(raw) == 10:          # YYYY-MM-DD — attach midnight UTC
                    raw += "T00:00:00+00:00"
                vd = datetime.fromisoformat(raw)
            elif isinstance(value, datetime):
                vd = value
        except (ValueError, TypeError):
            pass
    else:  # "text", "enum", or anything unrecognised
        vt = str(value) if value is not None else None
    return vt, vn, vd


async def _resync_asset_fields(db, asset: Asset, new_payload: dict) -> None:
    """
    Delete all asset_fields rows for this asset then re-insert based on the
    queryable_fields declared in the associated UserSkill.
    """
    asset_uuid = asset.id

    # Delete existing index rows
    await db.execute(
        delete(AssetField).where(AssetField.asset_id == asset_uuid)
    )

    # Nothing to index if no skill is attached
    if not asset.user_skill_id:
        return

    skill_result = await db.execute(
        select(UserSkill).where(UserSkill.id == asset.user_skill_id)
    )
    skill = skill_result.scalar_one_or_none()
    if not skill or not skill.queryable_fields:
        return

    for qf in skill.queryable_fields:
        field_name = qf.get("field")
        index_type = qf.get("index_type", "text")
        val = new_payload.get(field_name)
        if val is None:
            continue
        vt, vn, vd = _cast_field(val, index_type)
        af = AssetField(
            asset_id=asset_uuid,
            user_id=asset.user_id,
            field_name=field_name,
            value_text=vt,
            value_number=vn,
            value_date=vd,
        )
        db.add(af)


@router.get("/assets")
async def list_assets(
    type: Optional[str]       = Query(None, description="Asset type filter"),
    session_id: Optional[str] = Query(None, description="Filter by session UUID"),
    field: Optional[str]      = Query(None, description="Field name for structured filter"),
    op: Optional[str]         = Query("eq", description="eq|gt|gte|lt|lte"),
    value: Optional[str]      = Query(None, description="Filter value"),
    contains: Optional[str]   = Query(None, description="Keyword search in payload"),
    limit: int                = Query(50, le=500),
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

    if filters or session_id:
        async with AsyncSessionLocal() as db:
            if filters:
                assets = await query_assets_structured(db, "default", type, filters, limit)
                if session_id:
                    assets = [a for a in assets if str(a.get("session_id") or "") == session_id]
                return {"ok": True, "assets": assets}

            stmt = select(Asset).where(Asset.user_id == "default")
            if type:
                stmt = stmt.where(Asset.payload["asset_type"].astext == type)
            if session_id:
                stmt = stmt.where(Asset.session_id == uuid.UUID(session_id))
            stmt = stmt.order_by(Asset.created_at.desc()).limit(limit)
            result = await db.execute(stmt)
            rows = result.scalars().all()
        return {"ok": True, "assets": [
            {"id": str(a.id), "payload": a.payload,
             "session_id": str(a.session_id) if a.session_id else None,
             "created_at": a.created_at.isoformat()}
            for a in rows
        ]}

    # General query: direct DB with proper limit (avoids MCP's hardcoded limit=100)
    async with AsyncSessionLocal() as db:
        stmt = select(Asset).where(Asset.user_id == "default")
        if type:
            stmt = stmt.where(Asset.payload["asset_type"].astext == type)
        if contains:
            stmt = stmt.where(Asset.payload.cast(Text).ilike(f"%{contains}%"))
        stmt = stmt.order_by(Asset.created_at.desc()).limit(limit)
        result = await db.execute(stmt)
        rows = result.scalars().all()
    return {"ok": True, "assets": [
        {
            "id": str(a.id),
            "asset_type": a.payload.get("asset_type", ""),
            "payload": a.payload,
            "session_id": str(a.session_id) if a.session_id else None,
            "created_at": a.created_at.isoformat(),
        }
        for a in rows
    ]}


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


@router.put("/assets/{asset_id}")
async def update_asset(asset_id: str, req: UpdateAssetRequest):
    """
    Merge payload_patch into the asset's payload, then resync asset_fields so
    MCP queryable-field lookups stay in sync with the new values.
    """
    try:
        aid = uuid.UUID(asset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid asset ID")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Asset).where(Asset.id == aid, Asset.user_id == "default")
        )
        asset = result.scalar_one_or_none()
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")

        # Merge patch into existing payload (patch wins on conflict)
        new_payload = {**asset.payload, **req.payload_patch}
        asset.payload = new_payload

        # Resync queryable-field index
        await _resync_asset_fields(db, asset, new_payload)

        await db.commit()
        await db.refresh(asset)

    return {
        "ok": True,
        "asset": {
            "id": str(asset.id),
            "payload": asset.payload,
            "session_id": str(asset.session_id) if asset.session_id else None,
            "created_at": asset.created_at.isoformat(),
        },
    }


@router.post("/assets")
async def manual_create_asset(req: CreateAssetRequest):
    result = await create_asset(
        asset_type=req.asset_type,
        payload=json.dumps(req.payload, ensure_ascii=False),
        session_id=req.session_id,
    )
    return result
