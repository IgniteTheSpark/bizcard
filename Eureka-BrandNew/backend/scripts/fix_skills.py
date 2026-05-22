"""
fix_skills.py — 对齐 global_skills / user_skills 数据

修正内容：
  1. expense  : numeric→number, enum→text
  2. todo     : due_at→due_date, enum→text
  3. contact  : 补全所有字段 (name/phone/company/title/email)
  4. idea     : 加 content 字段
  5. note     : 加 content / note_type 字段
  6. misc     : 新增（global_skills + user_skills）

同时为每个 skill 补全 payload_schema。
"""

import sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from db.database import sync_engine
from sqlalchemy import text

# ── Skill definitions ──────────────────────────────────────────────────────────

SKILLS = {
    "expense": {
        "description": "记账",
        "payload_schema": {
            "asset_type": "expense",
            "fields": {
                "amount":      {"type": "number",  "required": True},
                "merchant":    {"type": "string"},
                "category":    {"type": "string"},
                "date":        {"type": "date"},
                "description": {"type": "string"},
            }
        },
        "queryable_fields": [
            {"field": "amount",   "index_type": "number"},
            {"field": "merchant", "index_type": "text"},
            {"field": "category", "index_type": "text"},
            {"field": "date",     "index_type": "date"},
        ],
    },
    "todo": {
        "description": "待办",
        "payload_schema": {
            "asset_type": "todo",
            "fields": {
                "content":   {"type": "string", "required": True},
                "status":    {"type": "string", "enum": ["pending_confirmation","pending","done","dismissed"]},
                "due_date":  {"type": "date"},
            }
        },
        "queryable_fields": [
            {"field": "due_date", "index_type": "date"},
            {"field": "status",   "index_type": "text"},
        ],
    },
    "contact": {
        "description": "联系人",
        # contact 有独立表，payload_schema 仅供 Agent 参考
        "payload_schema": {
            "asset_type": "contact",
            "note": "Contact has its own table. This schema is for agent reference only.",
            "fields": {
                "name":    {"type": "string", "required": True},
                "phone":   {"type": "string"},
                "company": {"type": "string"},
                "title":   {"type": "string"},
                "email":   {"type": "string"},
                "notes":   {"type": "array", "items": "string"},
            }
        },
        # 所有可搜索字段 — 查询走 contacts 表而非 asset_fields
        "queryable_fields": [
            {"field": "name",    "index_type": "text"},
            {"field": "phone",   "index_type": "text"},
            {"field": "company", "index_type": "text"},
            {"field": "title",   "index_type": "text"},
            {"field": "email",   "index_type": "text"},
        ],
    },
    "idea": {
        "description": "想法",
        "payload_schema": {
            "asset_type": "idea",
            "fields": {
                "content": {"type": "string", "required": True},
                "date":    {"type": "date"},
            }
        },
        "queryable_fields": [
            {"field": "content", "index_type": "text"},
            {"field": "date",    "index_type": "date"},
        ],
    },
    "note": {
        "description": "笔记",
        "payload_schema": {
            "asset_type": "note",
            "fields": {
                "content":   {"type": "string", "required": True},
                "note_type": {"type": "string", "enum": ["meeting_summary","conversation_note","manual"]},
                "date":      {"type": "date"},
            }
        },
        "queryable_fields": [
            {"field": "content",   "index_type": "text"},
            {"field": "note_type", "index_type": "text"},
            {"field": "date",      "index_type": "date"},
        ],
    },
    "misc": {
        "description": "杂项兜底",
        "payload_schema": {
            "asset_type": "misc",
            "fields": {
                "content": {"type": "string"},
            }
        },
        "queryable_fields": [
            {"field": "content", "index_type": "text"},
        ],
    },
}


def main():
    with sync_engine.connect() as conn:
        conn.execute(text("BEGIN"))
        try:
            for skill_name, defn in SKILLS.items():
                # 1. Upsert global_skills
                conn.execute(text("""
                    INSERT INTO global_skills (name, description)
                    VALUES (:name, :desc)
                    ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
                """), {"name": skill_name, "desc": defn["description"]})

                # 2. Get skill id
                row = conn.execute(
                    text("SELECT id FROM global_skills WHERE name = :n"),
                    {"n": skill_name}
                ).fetchone()
                skill_id = row[0]

                # 3. Replace user_skills (no unique constraint → delete + insert)
                conn.execute(text("""
                    DELETE FROM user_skills
                    WHERE user_id = 'default' AND skill_id = :sid
                """), {"sid": skill_id})

                conn.execute(text("""
                    INSERT INTO user_skills (user_id, skill_id, payload_schema, queryable_fields)
                    VALUES ('default', :sid, CAST(:ps AS jsonb), CAST(:qf AS jsonb))
                """), {
                    "sid": skill_id,
                    "ps":  json.dumps(defn["payload_schema"],   ensure_ascii=False),
                    "qf":  json.dumps(defn["queryable_fields"], ensure_ascii=False),
                })

                print(f"  ok  {skill_name:10s}  qf={len(defn['queryable_fields'])} fields")

            conn.execute(text("COMMIT"))
            print()
            print("Done — all skills updated.")

        except Exception as e:
            conn.execute(text("ROLLBACK"))
            print(f"\nFailed, rolled back: {e}")
            raise


if __name__ == "__main__":
    main()
