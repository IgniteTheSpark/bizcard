"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-20
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

    op.create_table(
        "global_skills",
        sa.Column("id",          sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name",        sa.String(50), nullable=False, unique=True),
        sa.Column("description", sa.Text()),
        sa.Column("created_at",  TIMESTAMPTZ, server_default=sa.func.now()),
    )

    op.create_table(
        "user_skills",
        sa.Column("id",               UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id",          sa.String(50), nullable=False, server_default="default"),
        sa.Column("skill_id",         sa.Integer(), sa.ForeignKey("global_skills.id")),
        sa.Column("payload_schema",   JSONB()),
        sa.Column("queryable_fields", JSONB()),
        sa.Column("created_at",       TIMESTAMPTZ, server_default=sa.func.now()),
    )

    op.create_table(
        "sessions",
        sa.Column("id",           UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id",      sa.String(50), nullable=False, server_default="default"),
        sa.Column("session_type", sa.String(20), nullable=False),
        sa.Column("title",        sa.String(255)),
        sa.Column("date",         sa.Date()),
        sa.Column("created_at",   TIMESTAMPTZ, server_default=sa.func.now()),
    )

    op.create_table(
        "assets",
        sa.Column("id",            UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id",       sa.String(50), nullable=False, server_default="default"),
        sa.Column("user_skill_id", UUID(as_uuid=True), sa.ForeignKey("user_skills.id")),
        sa.Column("session_id",    UUID(as_uuid=True), sa.ForeignKey("sessions.id")),
        sa.Column("payload",       JSONB(), nullable=False),
        sa.Column("created_at",    TIMESTAMPTZ, server_default=sa.func.now()),
    )
    op.create_index("idx_assets_user", "assets", ["user_id", "created_at"])

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


def downgrade() -> None:
    op.drop_table("contacts")
    op.drop_table("asset_fields")
    op.drop_table("assets")
    op.drop_table("sessions")
    op.drop_table("user_skills")
    op.drop_table("global_skills")
