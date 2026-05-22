from sqlalchemy import (
    Column, String, Integer, Numeric, Text, Date, ARRAY,
    ForeignKey, UniqueConstraint, Index
)
from sqlalchemy import TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB

TIMESTAMPTZ = TIMESTAMP(timezone=True)
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()


class GlobalSkill(Base):
    __tablename__ = "global_skills"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    created_at  = Column(TIMESTAMPTZ, server_default=func.now())


class UserSkill(Base):
    __tablename__ = "user_skills"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(String(50), nullable=False, server_default="default")
    skill_id         = Column(Integer, ForeignKey("global_skills.id"))
    payload_schema   = Column(JSONB)        # full field definitions
    queryable_fields = Column(JSONB)        # [{field, index_type}]
    created_at       = Column(TIMESTAMPTZ, server_default=func.now())


class Session(Base):
    __tablename__ = "sessions"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(String(50), nullable=False, server_default="default")
    session_type = Column(String(20), nullable=False)   # daily | meeting | research
    title        = Column(String(255))
    date         = Column(Date)
    created_at   = Column(TIMESTAMPTZ, server_default=func.now())


class Asset(Base):
    __tablename__ = "assets"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id       = Column(String(50), nullable=False, server_default="default")
    user_skill_id = Column(UUID(as_uuid=True), ForeignKey("user_skills.id"))
    session_id    = Column(UUID(as_uuid=True), ForeignKey("sessions.id"))
    payload       = Column(JSONB, nullable=False)
    created_at    = Column(TIMESTAMPTZ, server_default=func.now())

    __table_args__ = (
        Index("idx_assets_user", "user_id", "created_at"),
    )


class AssetField(Base):
    """Queryable field inverted index — one row per indexed field per asset."""
    __tablename__ = "asset_fields"

    asset_id     = Column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True)
    user_id      = Column(String(50), nullable=False, primary_key=True)
    field_name   = Column(String(100), nullable=False, primary_key=True)
    value_text   = Column(Text)
    value_number = Column(Numeric)
    value_date   = Column(TIMESTAMPTZ)

    __table_args__ = (
        Index("idx_asset_fields_num",  "user_id", "field_name", "value_number"),
        Index("idx_asset_fields_text", "user_id", "field_name", "value_text"),
        Index("idx_asset_fields_date", "user_id", "field_name", "value_date"),
    )


class Contact(Base):
    __tablename__ = "contacts"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(String(50), nullable=False, server_default="default")
    name       = Column(String(255), nullable=False)
    phone      = Column(String(50))
    company    = Column(String(255))
    title      = Column(String(255))
    email      = Column(String(255))
    notes      = Column(ARRAY(Text), server_default="{}")
    created_at = Column(TIMESTAMPTZ, server_default=func.now())

    __table_args__ = (
        Index("idx_contacts_name", "user_id", "name"),
    )


class Message(Base):
    __tablename__ = "messages"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    user_id    = Column(String(50), nullable=False, server_default="default")
    role       = Column(String(10), nullable=False)   # "user" | "agent"
    text       = Column(Text, nullable=False, server_default="")
    cards      = Column(JSONB, server_default="[]")
    elapsed_ms = Column(Integer)
    created_at = Column(TIMESTAMPTZ, server_default=func.now())

    __table_args__ = (
        Index("idx_messages_session", "session_id", "created_at"),
    )
