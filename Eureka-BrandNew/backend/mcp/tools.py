"""
MCP tool implementations backed by PostgreSQL.
Tool signatures are intentionally identical to the original mcp-server/server.py
so existing SKILL.md prompts work without changes.
"""
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import Session as SyncSession

from db.models import Asset, AssetField, Contact, UserSkill, GlobalSkill
from db.queries import index_asset_fields, query_assets_structured
from db.database import AsyncSessionLocal

# ── Helpers ────────────────────────────────────────────────────────────────────

VALID_ASSET_TYPES = {"todo", "idea", "note", "expense", "transcript", "misc"}


async def _get_user_skill(db: AsyncSession, user_id: str, asset_type: str):
    """Resolve user_skill_id for a given asset_type (matches global skill name)."""
    result = await db.execute(
        select(UserSkill)
        .join(GlobalSkill, UserSkill.skill_id == GlobalSkill.id)
        .where(UserSkill.user_id == user_id, GlobalSkill.name == asset_type)
    )
    return result.scalar_one_or_none()


def _ok(**kwargs):
    return {"ok": True, **kwargs}


def _err(msg: str):
    return {"ok": False, "error": msg}


# ── Asset tools ────────────────────────────────────────────────────────────────

async def create_asset(
    asset_type: str,
    payload: str,
    session_id: str = "",
    input_id: str = "",
    user_id: str = "default",
) -> dict:
    """Create an asset and index its queryable fields."""
    if asset_type not in VALID_ASSET_TYPES:
        return _err(f"invalid asset_type: {asset_type}")

    try:
        payload_dict = json.loads(payload) if isinstance(payload, str) else payload
    except json.JSONDecodeError as e:
        return _err(f"invalid payload JSON: {e}")

    payload_dict["asset_type"] = asset_type

    async with AsyncSessionLocal() as db:
        user_skill = await _get_user_skill(db, user_id, asset_type)

        asset = Asset(
            user_id=user_id,
            user_skill_id=user_skill.id if user_skill else None,
            session_id=uuid.UUID(session_id) if session_id else None,
            payload=payload_dict,
        )
        db.add(asset)
        await db.flush()  # get asset.id before indexing

        if user_skill:
            await index_asset_fields(db, asset.id, user_id, user_skill.id, payload_dict)

        await db.commit()

    return _ok(
        asset_id=str(asset.id),
        asset_type=asset_type,
        payload=payload_dict,
        created_at=asset.created_at.isoformat() if asset.created_at else None,
    )


async def query_asset(
    asset_type: str = "",
    contains: str = "",
    user_id: str = "default",
) -> dict:
    """Query assets by type and/or keyword. Returns newest-first list."""
    async with AsyncSessionLocal() as db:
        stmt = select(Asset).where(Asset.user_id == user_id)
        if asset_type:
            stmt = stmt.where(Asset.payload["asset_type"].astext == asset_type)
        if contains:
            stmt = stmt.where(Asset.payload.cast(str).ilike(f"%{contains}%"))
        stmt = stmt.order_by(Asset.created_at.desc()).limit(100)
        result = await db.execute(stmt)
        assets = result.scalars().all()

    return _ok(assets=[
        {"asset_id": str(a.id), "asset_type": a.payload.get("asset_type", ""),
         "payload": a.payload, "created_at": a.created_at.isoformat()}
        for a in assets
    ])


async def update_asset(
    asset_id: str,
    payload_patch: str,
    user_id: str = "default",
) -> dict:
    """Merge payload_patch into existing asset payload."""
    try:
        patch = json.loads(payload_patch) if isinstance(payload_patch, str) else payload_patch
    except json.JSONDecodeError as e:
        return _err(f"invalid payload_patch JSON: {e}")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Asset).where(Asset.id == uuid.UUID(asset_id), Asset.user_id == user_id)
        )
        asset = result.scalar_one_or_none()
        if not asset:
            return _err(f"asset not found: {asset_id}")

        merged = {**asset.payload, **patch}
        asset.payload = merged

        # Re-index queryable fields
        if asset.user_skill_id:
            await db.execute(
                AssetField.__table__.delete().where(AssetField.asset_id == asset.id)
            )
            await index_asset_fields(db, asset.id, user_id, asset.user_skill_id, merged)

        await db.commit()

    return _ok(asset_id=asset_id, payload=merged)


async def delete_asset(asset_id: str, user_id: str = "default") -> dict:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Asset).where(Asset.id == uuid.UUID(asset_id), Asset.user_id == user_id)
        )
        asset = result.scalar_one_or_none()
        if not asset:
            return _err(f"asset not found: {asset_id}")
        await db.delete(asset)
        await db.commit()
    return _ok(asset_id=asset_id)


# ── Contact tools ──────────────────────────────────────────────────────────────

async def create_contact(
    name: str,
    phone: str = "",
    company: str = "",
    title: str = "",
    email: str = "",
    notes: str = "",
    user_id: str = "default",
) -> dict:
    if not name:
        return _err("name is required")

    async with AsyncSessionLocal() as db:
        contact = Contact(
            user_id=user_id,
            name=name,
            phone=phone or None,
            company=company or None,
            title=title or None,
            email=email or None,
            notes=[notes] if notes else [],
        )
        db.add(contact)
        await db.commit()

    return _ok(
        contact_id=str(contact.id),
        name=name, phone=phone, company=company,
        title=title, email=email, notes=contact.notes,
    )


async def query_contact(name_query: str = "", user_id: str = "default") -> dict:
    async with AsyncSessionLocal() as db:
        stmt = select(Contact).where(Contact.user_id == user_id)
        if name_query:
            stmt = stmt.where(Contact.name.ilike(f"%{name_query}%"))
        stmt = stmt.order_by(Contact.created_at.desc()).limit(50)
        result = await db.execute(stmt)
        contacts = result.scalars().all()

    return _ok(contacts=[
        {"contact_id": str(c.id), "name": c.name, "phone": c.phone,
         "company": c.company, "title": c.title, "email": c.email,
         "notes": c.notes or []}
        for c in contacts
    ])


async def update_contact(
    contact_id: str,
    field: str,
    value: str,
    user_id: str = "default",
) -> dict:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Contact).where(Contact.id == uuid.UUID(contact_id), Contact.user_id == user_id)
        )
        contact = result.scalar_one_or_none()
        if not contact:
            return _err(f"contact not found: {contact_id}")

        if field == "notes":
            contact.notes = (contact.notes or []) + [value]
        elif hasattr(contact, field):
            setattr(contact, field, value)
        else:
            return _err(f"unknown field: {field}")

        await db.commit()

    return _ok(contact_id=contact_id, field=field, value=value)


async def delete_contact(contact_id: str, user_id: str = "default") -> dict:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Contact).where(Contact.id == uuid.UUID(contact_id), Contact.user_id == user_id)
        )
        contact = result.scalar_one_or_none()
        if not contact:
            return _err(f"contact not found: {contact_id}")
        await db.delete(contact)
        await db.commit()
    return _ok(contact_id=contact_id)
