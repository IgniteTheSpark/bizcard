"""
SQLAlchemy models — Phase B target schema (with design integration).

9 tables:
  global_skills, user_skills, sessions, files, input_turns,
  assets, asset_fields, contacts, messages.

Key changes from previous version:
- File and InputTurn are new (InputTurn is the unit of provenance,
  formerly conceptualized as Transcript; renamed after design integration)
- Asset has source_input_turn_id FK to input_turns; user_skill_id is NOT NULL
- Asset payload no longer carries asset_type (derived via user_skill_id → global_skills.name)
- Message gains tool_call, tool_result columns
- UserSkill gains display_name, render_spec (both nullable — system skills like qa
  have null payload_schema/render_spec)
- Session.session_type values: flash | chat | meeting | manual
  (replaces daily | meeting | agent_chat); flash session aggregates by day,
  each in-day input becomes one input_turn row inside it
- file_id is on InputTurn only, NOT on Session — a session can have many
  input_turns each with its own file (flash, multi-clip meeting, etc.)
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
    session_type = Column(String(20), nullable=False)   # flash | chat | meeting | manual
    title        = Column(String(255))
    date         = Column(Date)                          # natural-day grouping for flash; null for others
    created_at   = Column(TIMESTAMPTZ, server_default=func.now())

    __table_args__ = (
        Index("idx_sessions_user_date", "user_id", "date"),
        Index("idx_sessions_user_type",  "user_id", "session_type", "created_at"),
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


class InputTurn(Base):
    """
    One unit of input within a Session. Replaces the old Transcript concept.

    - flash session:   each captured voice/typed flash → one input_turn (with file_id if voice)
    - chat session:    each user message → one input_turn (no file_id)
    - meeting session: a long transcript is sliced into per-speaker input_turns
                       (each carries source_file_id + source_file_offset)
    - manual session:  no input_turns (asset created directly)
    """
    __tablename__ = "input_turns"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id            = Column(String(50), nullable=False)
    session_id         = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False)
    index              = Column(Integer, nullable=False)             # 0-based position within session
    file_id            = Column(UUID(as_uuid=True), ForeignKey("files.id"))   # nullable: typed / chat has no file
    source_file_offset = Column(Integer)                              # ms in audio (meeting segment)
    text               = Column(Text, nullable=False)
    segments           = Column(JSONB)                                # optional speaker / per-token detail
    source             = Column(String(20), nullable=False)           # flash | chat | meeting
    asr_provider       = Column(String(50))
    language           = Column(String(10))
    created_at         = Column(TIMESTAMPTZ, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("session_id", "index", name="uq_input_turns_session_index"),
        Index("idx_input_turns_session", "user_id", "session_id", "index"),
        Index("idx_input_turns_source",  "user_id", "source", "created_at"),
    )


class Asset(Base):
    __tablename__ = "assets"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id              = Column(String(50), nullable=False, server_default="default")
    user_skill_id        = Column(UUID(as_uuid=True), ForeignKey("user_skills.id"), nullable=False)
    session_id           = Column(UUID(as_uuid=True), ForeignKey("sessions.id"))
    source_input_turn_id = Column(UUID(as_uuid=True), ForeignKey("input_turns.id"))   # nullable: manual session has no input_turn
    payload              = Column(JSONB, nullable=False)
    created_at           = Column(TIMESTAMPTZ, server_default=func.now())

    __table_args__ = (
        Index("idx_assets_user",       "user_id", "created_at"),
        Index("idx_assets_skill",      "user_id", "user_skill_id", "created_at"),
        Index("idx_assets_input_turn", "user_id", "source_input_turn_id"),
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
