"""initial schema — Phase B rebuild

9 tables: global_skills, user_skills, sessions, files, transcripts,
assets, asset_fields, contacts, messages.

This is the new from-scratch initial migration. Previous 0001 + 0002 have
been removed as part of the Phase B rebuild (no production data — wipe
and reseed via `docker compose down -v && docker compose up db -d &&
alembic upgrade head && python -m db.seed`).

Revision ID: 0001
Revises:
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

TIMESTAMPTZ = sa.TIMESTAMP(timezone=True)

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── global_skills ──────────────────────────────────────────────────────────
    op.create_table(
        "global_skills",
        sa.Column("id",          sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name",        sa.String(50), nullable=False, unique=True),
        sa.Column("description", sa.Text()),
        sa.Column("created_at",  TIMESTAMPTZ, server_default=sa.func.now()),
    )

    # ── user_skills ────────────────────────────────────────────────────────────
    op.create_table(
        "user_skills",
        sa.Column("id",               UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id",          sa.String(50), nullable=False, server_default="default"),
        sa.Column("skill_id",         sa.Integer(), sa.ForeignKey("global_skills.id")),
        sa.Column("display_name",     sa.String(100)),
        sa.Column("payload_schema",   JSONB()),
        sa.Column("render_spec",      JSONB()),
        sa.Column("queryable_fields", JSONB()),
        sa.Column("created_at",       TIMESTAMPTZ, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "skill_id", name="uq_user_skills_user_skill"),
    )

    # ── sessions ───────────────────────────────────────────────────────────────
    op.create_table(
        "sessions",
        sa.Column("id",           UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id",      sa.String(50), nullable=False, server_default="default"),
        sa.Column("session_type", sa.String(20), nullable=False),    # daily | meeting | agent_chat
        sa.Column("title",        sa.String(255)),
        sa.Column("date",         sa.Date()),
        sa.Column("created_at",   TIMESTAMPTZ, server_default=sa.func.now()),
    )
    op.create_index("idx_sessions_user_date", "sessions", ["user_id", "date"])

    # ── files ──────────────────────────────────────────────────────────────────
    op.create_table(
        "files",
        sa.Column("id",           UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id",      sa.String(50), nullable=False),
        sa.Column("storage_url",  sa.Text()),
        sa.Column("file_type",    sa.String(50)),
        sa.Column("duration_sec", sa.Integer()),
        sa.Column("source_tag",   sa.String(20)),                    # flash | meeting
        sa.Column("asr_status",   sa.String(20)),                    # pending | processing | completed | failed
        sa.Column("created_at",   TIMESTAMPTZ, server_default=sa.func.now()),
    )

    # ── transcripts ────────────────────────────────────────────────────────────
    op.create_table(
        "transcripts",
        sa.Column("id",           UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id",      sa.String(50), nullable=False),
        sa.Column("file_id",      UUID(as_uuid=True), sa.ForeignKey("files.id")),       # nullable: typed has no file
        sa.Column("session_id",   UUID(as_uuid=True), sa.ForeignKey("sessions.id")),
        sa.Column("text",         sa.Text(), nullable=False),
        sa.Column("segments",     JSONB()),                                              # meeting populates [{speaker, start, end, text}]
        sa.Column("source",       sa.String(20), nullable=False),                        # voice_flash | typed | meeting
        sa.Column("asr_provider", sa.String(50)),
        sa.Column("language",     sa.String(10)),
        sa.Column("created_at",   TIMESTAMPTZ, server_default=sa.func.now()),
    )
    op.create_index("idx_transcripts_session", "transcripts", ["user_id", "session_id", "created_at"])
    op.create_index("idx_transcripts_source",  "transcripts", ["user_id", "source", "created_at"])

    # ── assets ─────────────────────────────────────────────────────────────────
    op.create_table(
        "assets",
        sa.Column("id",                   UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id",              sa.String(50), nullable=False, server_default="default"),
        sa.Column("user_skill_id",        UUID(as_uuid=True), sa.ForeignKey("user_skills.id"), nullable=False),
        sa.Column("session_id",           UUID(as_uuid=True), sa.ForeignKey("sessions.id")),
        sa.Column("source_transcript_id", UUID(as_uuid=True), sa.ForeignKey("transcripts.id")),    # nullable
        sa.Column("payload",              JSONB(), nullable=False),
        sa.Column("created_at",           TIMESTAMPTZ, server_default=sa.func.now()),
    )
    op.create_index("idx_assets_user",       "assets", ["user_id", "created_at"])
    op.create_index("idx_assets_skill",      "assets", ["user_id", "user_skill_id", "created_at"])
    op.create_index("idx_assets_transcript", "assets", ["user_id", "source_transcript_id"])

    # ── asset_fields ───────────────────────────────────────────────────────────
    op.create_table(
        "asset_fields",
        sa.Column("asset_id",     UUID(as_uuid=True), sa.ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id",      sa.String(50), nullable=False, primary_key=True),
        sa.Column("field_name",   sa.String(100), nullable=False, primary_key=True),
        sa.Column("value_text",   sa.Text()),
        sa.Column("value_number", sa.Numeric()),
        sa.Column("value_date",   TIMESTAMPTZ),
    )
    op.create_index("idx_asset_fields_num",  "asset_fields", ["user_id", "field_name", "value_number"])
    op.create_index("idx_asset_fields_text", "asset_fields", ["user_id", "field_name", "value_text"])
    op.create_index("idx_asset_fields_date", "asset_fields", ["user_id", "field_name", "value_date"])

    # ── contacts ───────────────────────────────────────────────────────────────
    op.create_table(
        "contacts",
        sa.Column("id",         UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id",    sa.String(50), nullable=False, server_default="default"),
        sa.Column("name",       sa.String(255), nullable=False),
        sa.Column("phone",      sa.String(50)),
        sa.Column("company",    sa.String(255)),
        sa.Column("title",      sa.String(255)),
        sa.Column("email",      sa.String(255)),
        sa.Column("notes",      ARRAY(sa.Text()), server_default="{}"),
        sa.Column("created_at", TIMESTAMPTZ, server_default=sa.func.now()),
    )
    op.create_index("idx_contacts_name", "contacts", ["user_id", "name"])

    # ── messages ───────────────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id",          UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id",  UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id",     sa.String(50), nullable=False, server_default="default"),
        sa.Column("role",        sa.String(10), nullable=False),       # user | agent | tool
        sa.Column("text",        sa.Text(), nullable=False, server_default=""),
        sa.Column("tool_call",   JSONB()),                              # {name, args}
        sa.Column("tool_result", JSONB()),
        sa.Column("cards",       JSONB(), server_default="[]"),
        sa.Column("elapsed_ms",  sa.Integer()),
        sa.Column("created_at",  TIMESTAMPTZ, server_default=sa.func.now()),
    )
    op.create_index("idx_messages_session", "messages", ["session_id", "created_at"])


def downgrade() -> None:
    op.drop_table("messages")
    op.drop_table("contacts")
    op.drop_table("asset_fields")
    op.drop_table("assets")
    op.drop_table("transcripts")
    op.drop_table("files")
    op.drop_table("sessions")
    op.drop_table("user_skills")
    op.drop_table("global_skills")
