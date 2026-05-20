"""
FastMCP server — exposes the same 8 tools as the original mcp-server/server.py
but backed by PostgreSQL via tools.py.

Run standalone:  python -m mcp.server
Used by ADK agents as a subprocess MCP server.
"""
import asyncio
from fastmcp import FastMCP
from mcp.tools import (
    create_asset, query_asset, update_asset, delete_asset,
    create_contact, query_contact, update_contact, delete_contact,
)

mcp = FastMCP("eureka")

# ── Asset tools ────────────────────────────────────────────────────────────────

@mcp.tool()
async def tool_create_asset(
    asset_type: str,
    payload: str,
    session_id: str = "",
    input_id: str = "",
) -> str:
    """
    Create a new asset and persist it to the database.
    asset_type: todo | idea | note | expense | transcript | misc
    payload: JSON string with type-specific fields
    """
    result = await create_asset(asset_type, payload, session_id, input_id)
    import json; return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def tool_query_asset(asset_type: str = "", contains: str = "") -> str:
    """
    Query assets. Filter by asset_type and/or keyword in payload.
    Returns newest-first list.
    """
    result = await query_asset(asset_type, contains)
    import json; return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def tool_update_asset(asset_id: str, payload_patch: str) -> str:
    """Merge payload_patch (JSON string) into existing asset."""
    result = await update_asset(asset_id, payload_patch)
    import json; return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def tool_delete_asset(asset_id: str) -> str:
    """Delete an asset by ID."""
    result = await delete_asset(asset_id)
    import json; return json.dumps(result, ensure_ascii=False)


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
    """Create a new contact. name is required."""
    result = await create_contact(name, phone, company, title, email, notes)
    import json; return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def tool_query_contact(name_query: str = "") -> str:
    """Query contacts by name substring (case-insensitive)."""
    result = await query_contact(name_query)
    import json; return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def tool_update_contact(contact_id: str, field: str, value: str) -> str:
    """
    Update a single field on a contact.
    Notes field appends; all other fields overwrite.
    """
    result = await update_contact(contact_id, field, value)
    import json; return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def tool_delete_contact(contact_id: str) -> str:
    """Delete a contact by ID."""
    result = await delete_contact(contact_id)
    import json; return json.dumps(result, ensure_ascii=False)


if __name__ == "__main__":
    mcp.run(transport="stdio")
