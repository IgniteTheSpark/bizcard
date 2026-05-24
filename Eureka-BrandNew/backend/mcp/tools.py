"""
Tool implementations backed by PostgreSQL — Phase B Step 2.

Called by mcp/server.py (the FastMCP server agents connect to via stdio).
Can also be imported directly during transitional steps; production callers
should go through MCP.

Changes from previous version (Step 2 design integration):
- create_asset/query_asset use `user_skill_name` (replaces `asset_type`)
- create_asset takes `source_input_turn_id` (replaces `input_id`)
- Removed VALID_ASSET_TYPES hardcoded set; user_skills registry is the source
  of truth — unregistered skill = error
- Asset payload no longer carries asset_type (type derived via FK chain)
- New: query_input_turn, get_input_turn for transcript retrieval
- Renamed _get_user_skill → _resolve_user_skill for clarity
"""
import json
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, Text

from db.models import (
    Asset, AssetField, Contact, UserSkill, GlobalSkill, InputTurn,
)
from db.queries import index_asset_fields
from db.database import AsyncSessionLocal


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _resolve_user_skill(db: AsyncSession, user_id: str, user_skill_name: str):
    """
    Look up the UserSkill row for (user_id, GlobalSkill.name = user_skill_name).
    Returns None if the user has not registered this skill.
    """
    result = await db.execute(
        select(UserSkill)
        .join(GlobalSkill, UserSkill.skill_id == GlobalSkill.id)
        .where(UserSkill.user_id == user_id, GlobalSkill.name == user_skill_name)
    )
    return result.scalar_one_or_none()


def _ok(**kwargs):
    return {"ok": True, **kwargs}


def _err(msg: str):
    return {"ok": False, "error": msg}


# ── Asset tools ────────────────────────────────────────────────────────────────

async def create_asset(
    user_skill_name: str,
    payload: str,
    session_id: str = "",
    source_input_turn_id: str = "",
    user_id: str = "default",
) -> dict:
    """
    Create an asset under a registered skill, and index its queryable fields.

    The skill MUST be registered in user_skills for this user — agent should not
    invent new skill names. Use the add-skill flow (POST /api/skills + design
    agent) to register new skills.
    """
    try:
        payload_dict = json.loads(payload) if isinstance(payload, str) else payload
    except json.JSONDecodeError as e:
        return _err(f"invalid payload JSON: {e}")
    if not isinstance(payload_dict, dict):
        return _err("payload must be a JSON object")

    async with AsyncSessionLocal() as db:
        user_skill = await _resolve_user_skill(db, user_id, user_skill_name)
        if not user_skill:
            return _err(f"skill not registered for user: {user_skill_name}")

        asset = Asset(
            user_id=user_id,
            user_skill_id=user_skill.id,
            session_id=uuid.UUID(session_id) if session_id else None,
            source_input_turn_id=uuid.UUID(source_input_turn_id) if source_input_turn_id else None,
            payload=payload_dict,
        )
        db.add(asset)
        await db.flush()  # populate asset.id before indexing

        await index_asset_fields(db, asset.id, user_id, user_skill.id, payload_dict)

        await db.commit()

    return _ok(
        asset_id=str(asset.id),
        user_skill_name=user_skill_name,
        payload=payload_dict,
        created_at=asset.created_at.isoformat() if asset.created_at else None,
    )


async def query_asset(
    user_skill_name: str = "",
    contains: str = "",
    limit: int = 100,
    user_id: str = "default",
) -> dict:
    """
    Query assets by skill name and/or keyword in payload. Newest-first.

    Skill name is resolved via UserSkill → GlobalSkill.name join — no reliance
    on payload.asset_type (that field is gone).
    """
    async with AsyncSessionLocal() as db:
        stmt = (
            select(Asset, GlobalSkill.name.label("skill_name"))
            .join(UserSkill, Asset.user_skill_id == UserSkill.id)
            .join(GlobalSkill, UserSkill.skill_id == GlobalSkill.id)
            .where(Asset.user_id == user_id)
        )
        if user_skill_name:
            stmt = stmt.where(GlobalSkill.name == user_skill_name)
        if contains:
            stmt = stmt.where(Asset.payload.cast(Text).ilike(f"%{contains}%"))
        stmt = stmt.order_by(Asset.created_at.desc()).limit(limit)
        result = await db.execute(stmt)
        rows = result.all()

    return _ok(assets=[
        {
            "asset_id":             str(a.id),
            "user_skill_name":      skill_name,
            "payload":              a.payload,
            "session_id":           str(a.session_id) if a.session_id else None,
            "source_input_turn_id": str(a.source_input_turn_id) if a.source_input_turn_id else None,
            "created_at":           a.created_at.isoformat(),
        }
        for a, skill_name in rows
    ])


async def update_asset(
    asset_id: str,
    payload_patch: str,
    user_id: str = "default",
) -> dict:
    """Merge payload_patch into existing asset; re-indexes queryable fields."""
    try:
        patch = json.loads(payload_patch) if isinstance(payload_patch, str) else payload_patch
    except json.JSONDecodeError as e:
        return _err(f"invalid payload_patch JSON: {e}")
    if not isinstance(patch, dict):
        return _err("payload_patch must be a JSON object")

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


# ── Contact tools (unchanged from v1) ──────────────────────────────────────────

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
        contact_action="created",
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

    return _ok(contact_id=contact_id, contact_action="updated", field=field, value=value)


async def delete_contact(contact_id: str, user_id: str = "default") -> dict:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Contact).where(Contact.id == uuid.UUID(contact_id), Contact.user_id == user_id)
        )
        contact = result.scalar_one_or_none()
        if not contact:
            return _err(f"contact not found: {contact_id}")
        name = contact.name
        await db.delete(contact)
        await db.commit()
    return _ok(contact_id=contact_id, contact_action="deleted", name=name)


# ── InputTurn tools (NEW: design integration §七) ─────────────────────────────

async def query_input_turn(
    contains: str = "",
    source: str = "",
    limit: int = 50,
    user_id: str = "default",
) -> dict:
    """
    Full-text search input_turns by keyword and/or source.
    source: flash | chat | meeting (empty = all sources)

    Returns text snippets (truncated to 200 chars). Use get_input_turn for full text.
    """
    async with AsyncSessionLocal() as db:
        stmt = select(InputTurn).where(InputTurn.user_id == user_id)
        if source:
            stmt = stmt.where(InputTurn.source == source)
        if contains:
            stmt = stmt.where(InputTurn.text.ilike(f"%{contains}%"))
        stmt = stmt.order_by(InputTurn.created_at.desc()).limit(limit)
        result = await db.execute(stmt)
        turns = result.scalars().all()

    return _ok(input_turns=[
        {
            "input_turn_id": str(t.id),
            "session_id":    str(t.session_id),
            "source":        t.source,
            "snippet":       (t.text[:200] + "…") if len(t.text) > 200 else t.text,
            "full_text_len": len(t.text),
            "file_id":       str(t.file_id) if t.file_id else None,
            "created_at":    t.created_at.isoformat(),
        }
        for t in turns
    ])


async def get_input_turn(input_turn_id: str, user_id: str = "default") -> dict:
    """
    Fetch the full text + segments of a single input_turn.
    Use this for long-form content (meeting transcripts) — they should NOT be
    auto-included in chat history per the §3 decision.
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(InputTurn).where(
                InputTurn.id == uuid.UUID(input_turn_id),
                InputTurn.user_id == user_id,
            )
        )
        turn = result.scalar_one_or_none()
        if not turn:
            return _err(f"input_turn not found: {input_turn_id}")

    return _ok(
        input_turn_id=str(turn.id),
        session_id=str(turn.session_id),
        index=turn.index,
        source=turn.source,
        text=turn.text,
        segments=turn.segments,
        file_id=str(turn.file_id) if turn.file_id else None,
        source_file_offset=turn.source_file_offset,
        asr_provider=turn.asr_provider,
        language=turn.language,
        created_at=turn.created_at.isoformat(),
    )
