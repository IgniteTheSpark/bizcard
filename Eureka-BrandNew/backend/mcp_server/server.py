"""
FastMCP server — Phase B Step 2.

Exposes 10 tools to ADK agents via the stdio MCP protocol:
- 4 asset tools (create / query / update / delete)
- 4 contact tools (create / query / update / delete)
- 2 input_turn tools (query / get)
  → agents READ input_turns only; rows are created by the API layer
    (POST /api/chat, POST /api/flash) before invoking the agent, so the
    input_turn_id is known up front and passed via source_input_turn_id.

Run standalone:
    python -m mcp_server.server

Used by ADK agents as a subprocess MCP server (decision #2):
    MCPToolset(StdioServerParameters(command="python", args=["-m", "mcp_server.server"]))
"""
import json
from fastmcp import FastMCP

from mcp_server.tools import (
    create_asset, query_asset, update_asset, delete_asset,
    create_contact, query_contact, update_contact, delete_contact,
    query_input_turn, get_input_turn,
    create_event, query_event, get_event, update_event, delete_event,   # v1.4
    add_event_attendee, link_event_file,                                  # v1.4
)

mcp = FastMCP("eureka")


def _jsonify(result: dict) -> str:
    return json.dumps(result, ensure_ascii=False)


# ── Asset tools ────────────────────────────────────────────────────────────────

@mcp.tool()
async def tool_create_asset(
    user_skill_name: str,
    payload: str,
    session_id: str = "",
    source_input_turn_id: str = "",
) -> str:
    """
    Create a new asset under a skill the user has registered.

    user_skill_name: machine name of the skill (todo | event | idea | contact | expense | ...)
    payload: JSON string with fields matching the skill's payload_schema
    session_id: optional session UUID this asset belongs to
    source_input_turn_id: optional input_turn UUID that produced this asset

    The skill must exist in user_skills for the current user. An unregistered
    skill name returns an error — do NOT retry with a different name without
    consulting the skill registry.
    """
    return _jsonify(await create_asset(user_skill_name, payload, session_id, source_input_turn_id))


@mcp.tool()
async def tool_query_asset(
    user_skill_name: str = "",
    contains: str = "",
    limit: int = 100,
) -> str:
    """
    Query assets. Filter by skill name and/or keyword in payload (case-insensitive).

    Returns newest-first list with skill_name + payload + session_id + source_input_turn_id.
    Empty user_skill_name = all skills.
    """
    return _jsonify(await query_asset(user_skill_name, contains, limit))


@mcp.tool()
async def tool_update_asset(asset_id: str, payload_patch: str) -> str:
    """
    Merge payload_patch (JSON string) into existing asset; re-indexes queryable
    fields automatically.
    """
    return _jsonify(await update_asset(asset_id, payload_patch))


@mcp.tool()
async def tool_delete_asset(asset_id: str) -> str:
    """Delete an asset by ID. Cascades to asset_fields."""
    return _jsonify(await delete_asset(asset_id))


# ── Contact tools ──────────────────────────────────────────────────────────────

@mcp.tool()
async def tool_create_contact(
    name: str,
    phone: str = "",
    company: str = "",
    title: str = "",
    email: str = "",
    notes: str = "",
) -> str:
    """Create a new contact. name is required; other fields optional."""
    return _jsonify(await create_contact(name, phone, company, title, email, notes))


@mcp.tool()
async def tool_query_contact(name_query: str = "") -> str:
    """Query contacts by name substring (case-insensitive). Newest-first."""
    return _jsonify(await query_contact(name_query))


@mcp.tool()
async def tool_update_contact(contact_id: str, field: str, value: str) -> str:
    """
    Update a single field on a contact.
    Notes field appends to the array; all other fields overwrite.
    """
    return _jsonify(await update_contact(contact_id, field, value))


@mcp.tool()
async def tool_delete_contact(contact_id: str) -> str:
    """Delete a contact by ID."""
    return _jsonify(await delete_contact(contact_id))


# ── InputTurn tools (lazy-load for long-form content) ─────────────────────────

@mcp.tool()
async def tool_query_input_turn(
    contains: str = "",
    source: str = "",
    limit: int = 50,
) -> str:
    """
    Full-text search input_turns by keyword and/or source (modality).

    source: voice | typed | imported (empty = all)
    Returns text snippets truncated to 200 chars. Use tool_get_input_turn
    with the returned input_turn_id to fetch full text when needed.
    """
    return _jsonify(await query_input_turn(contains, source, limit))


@mcp.tool()
async def tool_get_input_turn(input_turn_id: str) -> str:
    """
    Fetch the full text + segments of a single input_turn.

    Use this for long-form content (e.g. meeting transcripts) that is not
    auto-included in chat history per decision #3 — agent calls this on
    demand when the user references specific content.
    """
    return _jsonify(await get_input_turn(input_turn_id))


# ── Event tools (v1.4: Event is a first-class entity) ────────────────────────

@mcp.tool()
async def tool_create_event(
    title: str,
    start_at: str,
    end_at: str = "",
    location: str = "",
    description: str = "",
    all_day: int = 0,
    recurrence_rule: str = "",
    source_input_turn_id: str = "",
) -> str:
    """
    Create a calendar event (scheduled time block — distinct from todo's deadline).

    title: short event name (e.g. "跟客户开会")
    start_at: ISO8601 with timezone (required), e.g. "2026-05-26T14:00:00+08:00"
    end_at:   ISO8601 (optional)
    location: free-form (e.g. "会议室B", "Zoom")
    all_day:  0 or 1
    source_input_turn_id: when this event was extracted from a voice flash, pass the turn id
    """
    return _jsonify(await create_event(
        title, start_at, end_at, location, description, all_day,
        recurrence_rule, source_input_turn_id,
    ))


@mcp.tool()
async def tool_query_event(
    contains: str = "",
    from_date: str = "",
    to_date: str = "",
    status: str = "",
    limit: int = 50,
) -> str:
    """
    Query events. Filter by date range (from_date/to_date, ISO8601), status
    (scheduled | cancelled | done), and/or keyword in title/location/description.

    Returns events newest-start_at first, with attendees and file refs inlined
    for each (no need to call get_event for basic listing).
    """
    return _jsonify(await query_event(contains, from_date, to_date, status, limit))


@mcp.tool()
async def tool_get_event(event_id: str) -> str:
    """Fetch a single event by id, with attendees and files inlined."""
    return _jsonify(await get_event(event_id))


@mcp.tool()
async def tool_update_event(event_id: str, patch: str) -> str:
    """
    Update event fields. `patch` is a JSON string of field→value.
    Allowed fields: title | start_at | end_at | location | description |
                    status | all_day | recurrence_rule
    Example: {"start_at": "2026-05-26T16:00:00+08:00", "location": "Zoom"}
    """
    return _jsonify(await update_event(event_id, patch))


@mcp.tool()
async def tool_delete_event(event_id: str) -> str:
    """Delete an event. Cascades to event_attendees and event_files."""
    return _jsonify(await delete_event(event_id))


@mcp.tool()
async def tool_add_event_attendee(
    event_id: str,
    name: str = "",
    contact_id: str = "",
    role: str = "attendee",
) -> str:
    """
    Add an attendee to an event. Either contact_id (link existing contact)
    or name (unresolved string for later matching) must be set.
    role: organizer | attendee | optional
    """
    return _jsonify(await add_event_attendee(event_id, name, contact_id, role))


@mcp.tool()
async def tool_link_event_file(
    event_id: str,
    file_id: str,
    kind: str = "attachment",
) -> str:
    """
    Attach a file to an event. kind: prep | recording | notes | attachment
    Use case: pre-meeting docs, post-meeting recording, summary notes.
    """
    return _jsonify(await link_event_file(event_id, file_id, kind))


if __name__ == "__main__":
    mcp.run(transport="stdio")
