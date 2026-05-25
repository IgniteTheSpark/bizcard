"""
Timeline assembly — Phase B v1.4.x.

Powers the「全部」filter tab in CalendarPage's Schedule view (per design
DESIGN.md §5.2 + Phase B §八). NOT a standalone page — just the data source
for that one tab.

Two concepts kept distinct:
- `created_at`     —— when the row was written to DB (audit / debug)
- `effective_at`   —— when the entity is meaningful on a user-facing timeline
                      (driven by content semantics, not row-write time)

Per-kind effective_at rule (table also lives in phase-b doc §三):

  event             →  start_at
  todo asset        →  payload.due_date  | else created_at
  expense asset     →  payload.date       | else created_at
  idea/notes/misc   →  created_at
  contact asset     →  created_at
  input_turn        →  created_at  (flash: capture moment; async ASR: completion)
  file              →  created_at  (upload moment)

The 「全部」 tab shows every kind interleaved by effective_at. Concrete-kind
tabs (event / todo / expense / ...) typically use their own endpoints with
richer per-type data (event tab needs end_at + attendees; todo tab needs
status groupings; etc.) — assemble_timeline is the unified-merge code path.
"""
from datetime import datetime, timezone
from typing import Optional, Any

# Tz-aware sentinel for sort fallback (datetime.min is naive — incompatible
# with offset-aware values parsed from ISO8601)
_EPOCH_MIN = datetime(1, 1, 1, tzinfo=timezone.utc)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import (
    Asset, UserSkill, GlobalSkill, Event, InputTurn, File,
)


# ── effective_at per kind ─────────────────────────────────────────────────────

def _parse_iso(s: Any) -> Optional[datetime]:
    """
    Parse an ISO8601 string into a tz-aware datetime; return None on failure.
    If the string lacks a timezone offset, assume UTC — this keeps everything
    on the timeline comparable (some LLM-emitted due_date strings have no TZ).
    """
    if isinstance(s, datetime):
        # Already a datetime — coerce to aware if naive
        return s if s.tzinfo else s.replace(tzinfo=timezone.utc)
    if not s or not isinstance(s, str):
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def effective_at_for_asset(asset: Asset, skill_name: str) -> datetime:
    """Compute effective_at for an asset based on its skill type + payload."""
    payload = asset.payload or {}
    if skill_name == "todo":
        return _parse_iso(payload.get("due_date")) or asset.created_at
    if skill_name == "expense":
        return _parse_iso(payload.get("date")) or asset.created_at
    # idea / notes / misc / contact / (future custom) — created_at by default
    return asset.created_at


def effective_at_for_event(event: Event) -> datetime:
    return event.start_at


def effective_at_for_input_turn(turn: InputTurn) -> datetime:
    """
    For flash: capture moment (= created_at when ASR is sync/inline).
    For async ASR (meeting): row created when ASR completed (= created_at also).
    Same field in both cases.
    """
    return turn.created_at


def effective_at_for_file(file: File) -> datetime:
    return file.created_at


# ── TimelineItem shape ────────────────────────────────────────────────────────
# Plain dicts (not a class) for direct JSON serialization. Frontend renders
# based on `kind`. Fields not relevant to a kind are simply omitted.
#
# Common keys:
#   kind:          "asset" | "event" | "input_turn" | "file"
#   id:            uuid
#   effective_at:  ISO8601 + TZ
#   created_at:    ISO8601 + TZ (for stable tie-break ordering)
#   title:         display title
#   subtitle:      optional secondary text
#   session_id:    if applicable
#
# Kind-specific:
#   asset:        skill_name, payload, source_input_turn_id
#   event:        event_id, end_at, location, attendees_count, files_count
#   input_turn:   source (voice/typed/imported), text_snippet, derived_count
#   file:         source_tag, file_type, asr_status


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def _asset_item(asset: Asset, skill_name: str) -> dict:
    p = asset.payload or {}
    # Heuristic title per skill; frontend can override
    title = (
        p.get("content") or p.get("title") or p.get("name") or
        (f"¥{p.get('amount')}" if p.get("amount") else None) or
        f"[{skill_name}]"
    )
    subtitle = p.get("description") or p.get("merchant") or ""
    return {
        "kind":                 "asset",
        "id":                   str(asset.id),
        "effective_at":         _iso(effective_at_for_asset(asset, skill_name)),
        "created_at":           _iso(asset.created_at),
        "title":                str(title)[:120],
        "subtitle":             str(subtitle)[:120],
        "skill_name":           skill_name,
        "session_id":           str(asset.session_id) if asset.session_id else None,
        "source_input_turn_id": str(asset.source_input_turn_id) if asset.source_input_turn_id else None,
        "payload":              p,
    }


def _event_item(event: Event) -> dict:
    return {
        "kind":                 "event",
        "id":                   str(event.id),
        "effective_at":         _iso(effective_at_for_event(event)),
        "created_at":           _iso(event.created_at),
        "title":                event.title,
        "subtitle":             event.location or "",
        "event_id":             str(event.id),
        "end_at":               _iso(event.end_at),
        "location":             event.location,
        "all_day":              bool(event.all_day),
        "source_input_turn_id": str(event.source_input_turn_id) if event.source_input_turn_id else None,
    }


def _input_turn_item(turn: InputTurn) -> dict:
    text = turn.text or ""
    return {
        "kind":         "input_turn",
        "id":           str(turn.id),
        "effective_at": _iso(effective_at_for_input_turn(turn)),
        "created_at":   _iso(turn.created_at),
        "title":        text[:80] + ("…" if len(text) > 80 else ""),
        "subtitle":     "",
        "source":       turn.source,
        "session_id":   str(turn.session_id) if turn.session_id else None,
        "file_id":      str(turn.file_id) if turn.file_id else None,
    }


def _file_item(file: File) -> dict:
    kind_label = "🎙 闪念录音" if file.source_tag == "flash" else (
                 "📁 会议录音" if file.source_tag == "meeting" else "📎 文件")
    return {
        "kind":         "file",
        "id":           str(file.id),
        "effective_at": _iso(effective_at_for_file(file)),
        "created_at":   _iso(file.created_at),
        "title":        kind_label,
        "subtitle":     f"{file.file_type or ''} · {file.duration_sec or 0}s",
        "file_id":      str(file.id),
        "source_tag":   file.source_tag,
        "asr_status":   file.asr_status,
    }


# ── Public: assemble_timeline ─────────────────────────────────────────────────

async def assemble_timeline(
    db: AsyncSession,
    user_id: str,
    from_dt: Optional[datetime] = None,
    to_dt:   Optional[datetime] = None,
    kinds:   Optional[set] = None,        # subset of {"asset", "event", "input_turn", "file"}
    skill_names: Optional[set] = None,    # restrict asset kind to specific skills
    limit: int = 500,
) -> list:
    """
    Assemble a unified, time-sorted list of TimelineItems for the 「全部」 tab.

    Strategy: brute-query each table within (or near) the window, compute
    effective_at in app code, filter strictly, then merge-sort. For demo
    scale this is fine; for large data, push effective_at into SQL via
    GENERATED columns or CTE.
    """
    kinds = kinds or {"asset", "event", "input_turn", "file"}
    items: list = []

    # ── assets (joined to skill name) ──
    if "asset" in kinds:
        stmt = (
            select(Asset, GlobalSkill.name.label("skill_name"))
            .join(UserSkill, Asset.user_skill_id == UserSkill.id)
            .join(GlobalSkill, UserSkill.skill_id == GlobalSkill.id)
            .where(Asset.user_id == user_id)
        )
        if skill_names:
            stmt = stmt.where(GlobalSkill.name.in_(skill_names))
        rows = (await db.execute(stmt)).all()
        for asset, skill_name in rows:
            items.append(_asset_item(asset, skill_name))

    # ── events ──
    if "event" in kinds:
        stmt = select(Event).where(Event.user_id == user_id)
        events = (await db.execute(stmt)).scalars().all()
        for ev in events:
            items.append(_event_item(ev))

    # ── input_turns ──
    if "input_turn" in kinds:
        stmt = select(InputTurn).where(InputTurn.user_id == user_id)
        turns = (await db.execute(stmt)).scalars().all()
        for t in turns:
            items.append(_input_turn_item(t))

    # ── files ──
    if "file" in kinds:
        stmt = select(File).where(File.user_id == user_id)
        files = (await db.execute(stmt)).scalars().all()
        for f in files:
            items.append(_file_item(f))

    # ── window filter ──
    if from_dt or to_dt:
        def in_window(it):
            ea = _parse_iso(it.get("effective_at"))
            if ea is None:
                return False
            if from_dt and ea < from_dt:
                return False
            if to_dt and ea > to_dt:
                return False
            return True
        items = [it for it in items if in_window(it)]

    # ── sort: effective_at desc(newest first); tie-break by created_at desc ──
    def sort_key(it):
        ea = _parse_iso(it.get("effective_at")) or _EPOCH_MIN
        ca = _parse_iso(it.get("created_at"))   or _EPOCH_MIN
        return (ea, ca)
    items.sort(key=sort_key, reverse=True)

    return items[:limit]
