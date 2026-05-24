"""
SQLAlchemy models — Phase B target schema.

9 tables:
  global_skills, user_skills, sessions, files, transcripts,
  assets, asset_fields, contacts, messages.

Key changes from previous version:
- File and Transcript are new (Transcript is now a first-class entity)
- Asset has source_transcript_id FK to transcripts; user_skill_id is NOT NULL
- Asset payload no longer carries asset_type (derived via user_skill_id → global_skills.name)
- Message gains tool_call, tool_result columns
- UserSkill gains display_name, render_spec (both nullable — system skills like qa
  have null payload_schema/render_spec)
"""
from sqlalchemy import (
    Column, String, Integer, Numeric, Text, Date, ARRAY,
    ForeignKey, UniqueConstraint, Index, TIMESTAMP,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func
import uuid

TIMESTAMPTZ = TIMESTAMP(timezone=True)
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
    display_name     = Column(String(100))
    payload_schema   = Column(JSONB)   # nullable: system skills (e.g. qa) have no payload
    render_spec      = Column(JSONB)   # nullable: skills that don't produce visible assets
    queryable_fields = Column(JSONB)   # nullable
    created_at       = Column(TIMESTAMPTZ, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "skill_id", name="uq_user_skills_user_skill"),
    )


class Session(Base):
    __tablename__ = "sessions"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(String(50), nullable=False, server_default="default")
    session_type = Column(String(20), nullable=False)   # daily | meeting | agent_chat
    title        = Column(String(255))
    date         = Column(Date)
    created_at   = Column(TIMESTAMPTZ, server_default=func.now())

    __table_args__ = (
        Index("idx_sessions_user_date", "user_id", "date"),
    )


class File(Base):
    __tablename__ = "files"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(String(50), nullable=False)
    storage_url  = Column(Text)
    file_type    = Column(String(50))
    duration_sec = Column(Integer)
    source_tag   = Column(String(20))   # flash | meeting
    asr_status   = Column(String(20))   # pending | processing | completed | failed
    created_at   = Column(TIMESTAMPTZ, server_default=func.now())


class Transcript(Base):
    __tablename__ = "transcripts"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(String(50), nullable=False)
    file_id      = Column(UUID(as_uuid=True), ForeignKey("files.id"))      # nullable: typed has no file
    session_id   = Column(UUID(as_uuid=True), ForeignKey("sessions.id"))
    text         = Column(Text, nullable=False)
    segments     = Column(JSONB)                                            # meeting populates [{speaker, start, end, text}]
    source       = Column(String(20), nullable=False)                       # voice_flash | typed | meeting
    asr_provider = Column(String(50))
    language     = Column(String(10))
    created_at   = Column(TIMESTAMPTZ, server_default=func.now())

    __table_args__ = (
        Index("idx_transcripts_session", "user_id", "session_id", "created_at"),
        Index("idx_transcripts_source",  "user_id", "source", "created_at"),
    )


class Asset(Base):
    __tablename__ = "assets"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id              = Column(String(50), nullable=False, server_default="default")
    user_skill_id        = Column(UUID(as_uuid=True), ForeignKey("user_skills.id"), nullable=False)
    session_id           = Column(UUID(as_uuid=True), ForeignKey("sessions.id"))
    source_transcript_id = Column(UUID(as_uuid=True), ForeignKey("transcripts.id"))   # nullable
    payload              = Column(JSONB, nullable=False)
    created_at           = Column(TIMESTAMPTZ, server_default=func.now())

    __table_args__ = (
        Index("idx_assets_user",       "user_id", "created_at"),
        Index("idx_assets_skill",      "user_id", "user_skill_id", "created_at"),
        Index("idx_assets_transcript", "user_id", "source_transcript_id"),
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

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id  = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    user_id     = Column(String(50), nullable=False, server_default="default")
    role        = Column(String(10), nullable=False)        # user | agent | tool
    text        = Column(Text, nullable=False, server_default="")
    tool_call   = Column(JSONB)                              # {name, args} when agent invokes a tool
    tool_result = Column(JSONB)                              # tool output (role=tool)
    cards       = Column(JSONB, server_default="[]")         # rendered asset card snapshots
    elapsed_ms  = Column(Integer)
    created_at  = Column(TIMESTAMPTZ, server_default=func.now())

    __table_args__ = (
        Index("idx_messages_session", "session_id", "created_at"),
    )
