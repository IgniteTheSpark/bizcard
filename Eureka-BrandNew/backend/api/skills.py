"""
Skill registry + add-skill via design agent — Phase B Step 5.

GET  /api/skills              — list registered skills for current user
POST /api/skills              — draft a new skill from a description (design agent)
POST /api/skills/confirm      — commit a draft as a new user_skill row

The design agent (agents/design_agent.py) produces a {name, display_name,
payload_schema, render_spec, sample_payload} draft. The frontend shows
the draft + preview, user tweaks, then POSTs /api/skills/confirm to land it.
"""
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from agents.design_agent import design_skill
from core.auth import get_current_user_id
from db.database import AsyncSessionLocal
from db.models import GlobalSkill, UserSkill

router = APIRouter()


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
