"""
Seed default global_skills and user_skills (with payload_schema + render_spec)
for user_id='default'. Run after `alembic upgrade head`:

    python -m db.seed

Idempotent — safe to re-run.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from db.models import GlobalSkill, UserSkill
from db.database import DATABASE_URL

engine = create_engine(DATABASE_URL)


# ── Global skill catalog (machine names + human descriptions) ──────────────────

GLOBAL_SKILLS = [
    {"name": "todo",    "description": "待办"},
    {"name": "event",   "description": "日程 / 事件"},
    {"name": "idea",    "description": "想法 / 笔记"},
    {"name": "contact", "description": "名片 / 联系人"},
    {"name": "expense", "description": "记账"},
    {"name": "qa",      "description": "问答(系统能力,无资产产出)"},
]


# ── Per-skill UserSkill configuration for the default user ─────────────────────
# payload_schema + queryable_fields + render_spec follow Phase B §九.

USER_SKILL_CONFIGS = [
    {
        "name": "todo",
        "display_name": "待办",
        "payload_schema": {
            "content":  {"type": "string",   "required": True},
            "due_date": {"type": "datetime"},
            "status":   {"type": "string", "enum": ["pending", "done", "pending_confirmation"], "default": "pending"},
        },
        "queryable_fields": [
            {"field": "due_date", "index_type": "date"},
            {"field": "status",   "index_type": "enum"},
        ],
        "render_spec": {
            "card_layout":       "horizontal",
            "icon":              "✅",
            "accent_color":      "blue",
            "primary_field":     "content",
            "secondary_field":   "due_date",
            "secondary_format":  "relative_date",
            "actions":           ["check", "edit"],
            "timeline_position": {"time_field": "due_date", "fallback": "created_at"},
            "calendar_render":   {"date_field": "due_date"},
        },
    },
    {
        "name": "event",
        "display_name": "事件",
        "payload_schema": {
            "title":        {"type": "string",   "required": True},
            "start_at":     {"type": "datetime", "required": True},
            "end_at":       {"type": "datetime"},
            "duration_min": {"type": "number"},
            "location":     {"type": "string"},
            "attendees":    {"type": "array", "items": "string"},
        },
        "queryable_fields": [
            {"field": "start_at", "index_type": "date"},
            {"field": "location", "index_type": "text"},
        ],
        "render_spec": {
            "card_layout":      "horizontal",
            "icon":             "📅",
            "accent_color":     "purple",
            "primary_field":    "title",
            "secondary_field":  "start_at",
            "secondary_format": "absolute_date",
            "meta_fields": [
                {"field": "duration_min", "format": "duration"},
                {"field": "location"},
            ],
            "actions":         ["edit", "open"],
            "calendar_render": {"date_field": "start_at", "time_field": "start_at"},
        },
    },
    {
        "name": "idea",
        "display_name": "想法",
        "payload_schema": {
            "title":   {"type": "string"},
            "content": {"type": "string", "required": True},
        },
        "queryable_fields": [],
        "render_spec": {
            "card_layout":      "stacked",
            "icon":             "💡",
            "accent_color":     "amber",
            "primary_field":    "title",
            "secondary_field":  "content",
            "secondary_format": "truncate_40",
            "actions":          ["edit", "open"],
        },
    },
    {
        "name": "contact",
        "display_name": "名片",
        # contact 的「真身」在 contacts 表;这个 asset 形态用于在时间流 / 资产库里展示
        # 「最近捕捉到的联系人引用」,payload 指向真实 contact_id。
        "payload_schema": {
            "contact_id": {"type": "uuid",   "required": True},
            "name":       {"type": "string", "required": True},
            "company":    {"type": "string"},
            "title":      {"type": "string"},
            "phone":      {"type": "string"},
        },
        "queryable_fields": [
            {"field": "name",    "index_type": "text"},
            {"field": "company", "index_type": "text"},
        ],
        "render_spec": {
            "card_layout":     "horizontal",
            "icon":            "👤",
            "accent_color":    "neutral",
            "primary_field":   "name",
            "secondary_field": "company",
            "meta_fields":     [{"field": "title"}, {"field": "phone"}],
            "actions":         ["edit", "open"],
        },
    },
    {
        "name": "expense",
        "display_name": "记账",
        "payload_schema": {
            "amount":      {"type": "number", "required": True},
            "currency":    {"type": "string", "default": "CNY"},
            "category":    {"type": "string"},
            "merchant":    {"type": "string"},
            "date":        {"type": "date"},
            "description": {"type": "string"},
        },
        "queryable_fields": [
            {"field": "amount",   "index_type": "numeric"},
            {"field": "category", "index_type": "enum"},
            {"field": "date",     "index_type": "date"},
            {"field": "merchant", "index_type": "text"},
        ],
        "render_spec": {
            "card_layout":     "horizontal",
            "icon":            "💰",
            "accent_color":    "green",
            "primary_field":   "amount",
            "primary_format":  "currency",
            "secondary_field": "description",
            "meta_fields": [
                {"field": "category", "format": "badge"},
                {"field": "date",     "format": "absolute_date"},
            ],
            "actions": ["edit"],
        },
    },
    {
        # qa is a recognized system capability but produces no assets:
        # null payload_schema + null render_spec is the contract for "system skill".
        "name":             "qa",
        "display_name":     "问答",
        "payload_schema":   None,
        "render_spec":      None,
        "queryable_fields": None,
    },
]


def seed():
    with Session(engine) as db:
        # ── global_skills ──
        skill_ids = {}
        for gs in GLOBAL_SKILLS:
            existing = db.query(GlobalSkill).filter_by(name=gs["name"]).first()
            if not existing:
                obj = GlobalSkill(**gs)
                db.add(obj)
                db.flush()
                skill_ids[gs["name"]] = obj.id
                print(f"  + global_skill: {gs['name']}")
            else:
                skill_ids[gs["name"]] = existing.id
                print(f"  ~ global_skill exists: {gs['name']}")

        # ── user_skills for default user ──
        for cfg in USER_SKILL_CONFIGS:
            sk_id = skill_ids[cfg["name"]]
            existing = db.query(UserSkill).filter_by(user_id="default", skill_id=sk_id).first()
            if not existing:
                obj = UserSkill(
                    user_id="default",
                    skill_id=sk_id,
                    display_name=cfg["display_name"],
                    payload_schema=cfg["payload_schema"],
                    render_spec=cfg["render_spec"],
                    queryable_fields=cfg["queryable_fields"],
                )
                db.add(obj)
                print(f"  + user_skill: {cfg['name']}")
            else:
                print(f"  ~ user_skill exists: {cfg['name']}")

        db.commit()
    print("Seed complete.")


if __name__ == "__main__":
    seed()
