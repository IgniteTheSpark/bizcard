"""add messages table

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
TIMESTAMPTZ = sa.TIMESTAMP(timezone=True)

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "messages",
        sa.Column("id",         UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id",    sa.String(50), nullable=False, server_default="default"),
        sa.Column("role",       sa.String(10), nullable=False),
        sa.Column("text",       sa.Text(), nullable=False, server_default=""),
        sa.Column("cards",      JSONB(), server_default="[]"),
        sa.Column("elapsed_ms", sa.Integer()),
        sa.Column("created_at", TIMESTAMPTZ, server_default=sa.func.now()),
    )
    op.create_index("idx_messages_session", "messages", ["session_id", "created_at"])


def downgrade() -> None:
    op.drop_table("messages")
