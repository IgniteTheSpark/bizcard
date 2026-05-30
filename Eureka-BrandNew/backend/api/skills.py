"""
Skill registry + add-skill via design agent — Phase B Step 5.

GET    /api/skills                  — list registered skills for current user
POST   /api/skills                  — draft a new skill from a description (design agent)
POST   /api/skills/confirm          — commit a draft as a new user_skill row
DELETE /api/skills/{user_skill_id}  — remove a registered skill (May audit)

The design agent (agents/design_agent.py) produces a {name, display_name,
payload_schema, render_spec, sample_payload} draft. The frontend shows
the draft + preview, user tweaks, then POSTs /api/skills/confirm to land it.

User-skill cap (May audit, decision):
  USER_SKILL_CAP = 10 — measures the user-defined skills only (system
  skills are excluded since their render_spec is null/JSON-null).
"""
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, delete as sa_delete, func, or_, cast, String

from agents.design_agent import design_skill
from core.auth import get_current_user_id
from db.database import AsyncSessionLocal
from db.models import GlobalSkill, UserSkill, Asset, AssetField

USER_SKILL_CAP = 10

router = APIRouter()


async def _count_user_skills(db, user_id: str) -> int:
    """
    Count *user-defined* skills (filters out system skills whose render_spec
    is null/JSON-null). Mirrors the GET /api/skills filter.
    """
    stmt = (
        select(func.count())
        .select_from(UserSkill)
        .where(
            UserSkill.user_id == user_id,
            UserSkill.render_spec.isnot(None),
            cast(UserSkill.render_spec, String) != "null",
        )
    )
    return int((await db.execute(stmt)).scalar() or 0)


# ── Request bodies ─────────────────────────────────────────────────────────────

class DraftSkillRequest(BaseModel):
    description: str   # user's NL description, e.g. "我想记录跑步训练"


class ConfirmSkillRequest(BaseModel):
    name: str
    display_name: str
    payload_schema: dict
    render_spec: dict
    queryable_fields: list = []


# ── GET /api/skills ────────────────────────────────────────────────────────────

@router.get("/skills")
async def list_skills(user_id: str = Depends(get_current_user_id)):
    """
    Return all user_skills the current user has registered, with display_name,
    payload_schema, render_spec. Used by frontend on startup to build the
    skill registry that drives SkillCard rendering (Phase B §九).

    System skills (render_spec is null/JSON-null) are filtered out — they
    don't appear in the registry the SkillCard renderer iterates over.
    """
    async with AsyncSessionLocal() as db:
        stmt = (
            select(UserSkill, GlobalSkill.name.label("skill_name"))
            .join(GlobalSkill, UserSkill.skill_id == GlobalSkill.id)
            .where(UserSkill.user_id == user_id)
            .order_by(UserSkill.created_at.asc())
        )
        rows = (await db.execute(stmt)).all()

    skills = []
    for us, sk_name in rows:
        # Skip system skills (no payload_schema / render_spec).
        # Tolerate both SQL NULL and JSONB null.
        if us.render_spec is None or us.render_spec == "null":
            continue
        skills.append({
            "user_skill_id":    str(us.id),
            "name":             sk_name,
            "display_name":     us.display_name,
            "payload_schema":   us.payload_schema,
            "render_spec":      us.render_spec,
            "queryable_fields": us.queryable_fields or [],
        })

    return {"ok": True, "skills": skills}


# ── POST /api/skills (draft via design agent) ─────────────────────────────────

@router.post("/skills")
async def draft_skill(
    req: DraftSkillRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Run the design agent against the user's description. Returns the draft
    JSON for the frontend AddSkillWizard to preview + tweak.

    Sync (not SSE) — draft is a single coherent JSON, no progressive value
    in token-streaming. Phase D polish can upgrade to SSE if real-time
    field-by-field preview becomes desired UX.
    """
    try:
        draft = await design_skill(req.description, user_id)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"design agent returned invalid JSON: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"design agent error: {e}")

    return {"ok": True, "draft": draft}


# ── POST /api/skills/confirm (land a draft) ───────────────────────────────────

@router.post("/skills/confirm")
async def confirm_skill(
    req: ConfirmSkillRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Commit a (possibly user-edited) draft as a new UserSkill row.

    Side effect: if no GlobalSkill row exists for this name, create one too —
    that way custom skills become first-class in the catalog without a
    separate admin step.
    """
    async with AsyncSessionLocal() as db:
        # Enforce the user-skill cap before doing any other writes.
        count = await _count_user_skills(db, user_id)
        if count >= USER_SKILL_CAP:
            raise HTTPException(
                status_code=409,
                detail=f"已达技能上限({USER_SKILL_CAP});请先删除一个再添加",
            )

        # Find or create the GlobalSkill row
        gs_result = await db.execute(
            select(GlobalSkill).where(GlobalSkill.name == req.name)
        )
        gs = gs_result.scalar_one_or_none()
        if not gs:
            gs = GlobalSkill(name=req.name, description=req.display_name)
            db.add(gs)
            await db.flush()  # populate gs.id

        # Reject duplicates for this user
        existing = await db.execute(
            select(UserSkill).where(
                UserSkill.user_id == user_id, UserSkill.skill_id == gs.id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"skill already registered: {req.name}",
            )

        us = UserSkill(
            user_id=user_id,
            skill_id=gs.id,
            display_name=req.display_name,
            payload_schema=req.payload_schema,
            render_spec=req.render_spec,
            queryable_fields=req.queryable_fields,
        )
        db.add(us)
        await db.commit()
        await db.refresh(us)

    return {
        "ok": True,
        "user_skill_id": str(us.id),
        "name":          req.name,
    }


# ── DELETE /api/skills/{user_skill_id} ────────────────────────────────────────

@router.delete("/skills/{user_skill_id}")
async def delete_skill(
    user_skill_id: str,
    force: bool = Query(False, description="cascade-delete the skill's assets"),
    user_id: str = Depends(get_current_user_id),
):
    """
    Remove a user-registered skill.

    Default: returns 409 with the asset_count if any assets reference this
    skill, so the frontend can warn the user before destructive force.
    `?force=true` cascades — deletes all assets + asset_fields under this
    skill, then the skill itself.

    System skills (render_spec is null) are protected: returns 403.
    """
    try:
        usid = uuid.UUID(user_skill_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid user_skill_id")

    async with AsyncSessionLocal() as db:
        us = (await db.execute(
            select(UserSkill).where(
                UserSkill.id == usid, UserSkill.user_id == user_id,
            )
        )).scalar_one_or_none()
        if not us:
            raise HTTPException(status_code=404, detail="skill not found")

        # Guardrail: don't let system skills get nuked from the UI.
        if us.render_spec is None or us.render_spec == "null":
            raise HTTPException(status_code=403, detail="system skills are protected")

        # Count assets attached to this skill (for both the soft-fail path
        # and the cascade summary).
        asset_count = int((await db.execute(
            select(func.count()).select_from(Asset).where(Asset.user_skill_id == usid)
        )).scalar() or 0)

        if asset_count > 0 and not force:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "skill has assets",
                    "asset_count": asset_count,
                    "hint": "re-call with ?force=true to cascade-delete",
                },
            )

        # Cascade: asset_fields → assets → skill. Driven by explicit deletes
        # since the FKs don't have ON DELETE CASCADE in the schema.
        if asset_count > 0:
            asset_ids_rows = (await db.execute(
                select(Asset.id).where(Asset.user_skill_id == usid)
            )).all()
            asset_ids = [r[0] for r in asset_ids_rows]
            if asset_ids:
                await db.execute(
                    sa_delete(AssetField).where(AssetField.asset_id.in_(asset_ids))
                )
                await db.execute(
                    sa_delete(Asset).where(Asset.id.in_(asset_ids))
                )

        await db.delete(us)
        await db.commit()

    return {
        "ok": True,
        "user_skill_id": user_skill_id,
        "deleted_assets": asset_count if force else 0,
    }
