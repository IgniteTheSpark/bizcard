"""
Seed default global_skills and user_skills for user_id='default'.
Run: python -m db.seed
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from db.models import GlobalSkill, UserSkill
from db.database import DATABASE_URL

engine = create_engine(DATABASE_URL)

GLOBAL_SKILLS = [
    {"name": "expense", "description": "记账"},
    {"name": "todo",    "description": "待办"},
    {"name": "contact", "description": "联系人"},
    {"name": "idea",    "description": "想法"},
    {"name": "note",    "description": "笔记"},
]

USER_SKILL_CONFIGS = {
    "expense": {
        "payload_schema": {
            "amount": "number", "currency": "string", "category": "string",
            "merchant": "string", "date": "date", "description": "string"
        },
        "queryable_fields": [
            {"field": "amount",   "index_type": "numeric"},
            {"field": "merchant", "index_type": "text"},
            {"field": "date",     "index_type": "date"},
            {"field": "category", "index_type": "enum"},
        ],
    },
    "todo": {
        "payload_schema": {
            "title": "string", "due_at": "date", "status": "string"
        },
        "queryable_fields": [
            {"field": "due_at", "index_type": "date"},
            {"field": "status", "index_type": "enum"},
        ],
    },
    "contact": {
        "payload_schema": {
            "name": "string", "phone": "string", "company": "string",
            "title": "string", "email": "string"
        },
        "queryable_fields": [
            {"field": "name",    "index_type": "text"},
            {"field": "company", "index_type": "text"},
        ],
    },
    "idea": {
        "payload_schema": {"title": "string", "content": "string"},
        "queryable_fields": [
            {"field": "date", "index_type": "date"},
        ],
    },
    "note": {
        "payload_schema": {"title": "string", "content": "string"},
        "queryable_fields": [
            {"field": "date", "index_type": "date"},
        ],
    },
}


def seed():
    with Session(engine) as db:
        # Insert global skills (skip if already exist)
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

        # Insert default user_skills for user_id='default'
        for skill_name, cfg in USER_SKILL_CONFIGS.items():
            skill_id = skill_ids[skill_name]
            existing = db.query(UserSkill).filter_by(
                user_id="default", skill_id=skill_id
            ).first()
            if not existing:
                obj = UserSkill(
                    user_id="default",
                    skill_id=skill_id,
                    payload_schema=cfg["payload_schema"],
                    queryable_fields=cfg["queryable_fields"],
                )
                db.add(obj)
                print(f"  + user_skill: {skill_name}")
            else:
                print(f"  ~ user_skill exists: {skill_name}")

        db.commit()
    print("Seed complete.")


if __name__ == "__main__":
    seed()
