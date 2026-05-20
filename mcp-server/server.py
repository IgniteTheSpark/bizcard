"""
Bizcard Mock MCP Server
Exposes Asset + Contact tools for testing the agentic pipeline locally.
"""

import json
from mcp.server.fastmcp import FastMCP
import store

mcp = FastMCP("bizcard-mock")


# ===========================================================================
# Asset Tools
# ===========================================================================

@mcp.tool()
def create_asset(
    asset_type: str,
    payload: str,
    session_id: str = "",
    input_id: str = "",
) -> str:
    """
    Create a new asset and save it to the store.

    asset_type: one of todo | idea | note | expense | transcript
    payload: JSON string with asset-type-specific fields.
      - todo:       {"title": "...", "due_at": "ISO8601 or null", "status": "active"}
      - idea:       {"title": "...", "content": "markdown string"}
      - note:       {"title": "...", "content": "markdown string", "template_id": "or null"}
      - expense:    {"amount": 99.0, "currency": "CNY", "category": "...", "merchant": "...", "date": "ISO8601 or null", "description": "..."}
      - transcript: {"text": "...", "file_id": "...", "duration_sec": 0, "speakers": []}
    session_id: source session ID (optional)
    input_id: source input ID (optional)
    """
    try:
        payload_dict = json.loads(payload)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid payload JSON: {e}"})

    try:
        asset = store.create_asset(
            asset_type=asset_type,
            payload=payload_dict,
            session_id=session_id or None,
            input_id=input_id or None,
        )
        return json.dumps({"ok": True, "asset": asset})
    except ValueError as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def query_asset(
    asset_type: str = "",
    contains: str = "",
) -> str:
    """
    Query assets from the store.

    asset_type: filter by type (optional, leave empty for all types)
    contains: keyword to search inside payload fields (optional)
    """
    filters = {}
    if contains:
        filters["contains"] = contains

    results = store.query_asset(
        asset_type=asset_type or None,
        filters=filters or None,
    )
    return json.dumps({"ok": True, "count": len(results), "assets": results})


@mcp.tool()
def update_asset(asset_id: str, payload_patch: str) -> str:
    """
    Update fields in an existing asset's payload.

    asset_id: the asset to update
    payload_patch: JSON string with fields to merge into the existing payload
    """
    try:
        patch = json.loads(payload_patch)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid payload_patch JSON: {e}"})

    try:
        asset = store.update_asset(asset_id, patch)
        return json.dumps({"ok": True, "asset": asset})
    except KeyError as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def delete_asset(asset_id: str) -> str:
    """
    Delete an asset from the store.

    asset_id: the asset to delete
    """
    try:
        asset = store.delete_asset(asset_id)
        return json.dumps({"ok": True, "deleted": asset})
    except KeyError as e:
        return json.dumps({"error": str(e)})


# ===========================================================================
# Contact Tools
# ===========================================================================

@mcp.tool()
def create_contact(
    name: str,
    phone: str = "",
    company: str = "",
    title: str = "",
    email: str = "",
    notes: str = "",
) -> str:
    """
    Create a new contact.

    name: full name (required)
    phone, company, title, email, notes: all optional
    """
    contact = store.create_contact(
        name=name,
        phone=phone or None,
        company=company or None,
        title=title or None,
        email=email or None,
        notes=notes or None,
    )
    return json.dumps({"ok": True, "contact": contact})


@mcp.tool()
def query_contact(name_query: str) -> str:
    """
    Search contacts by name (case-insensitive substring match).

    name_query: name or partial name to search for
    """
    results = store.query_contact(name_query)
    return json.dumps({"ok": True, "count": len(results), "candidates": results})


@mcp.tool()
def update_contact(contact_id: str, field: str, value: str) -> str:
    """
    Update a single field on an existing contact.

    contact_id: the contact to update
    field: field name (name / phone / company / title / email / notes)
    value: new value (for 'notes', this appends to the notes list)
    """
    try:
        contact = store.update_contact(contact_id, field, value)
        return json.dumps({"ok": True, "contact": contact})
    except KeyError as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def delete_contact(contact_id: str) -> str:
    """
    Delete a contact from the store.

    contact_id: the contact to delete
    """
    try:
        contact = store.delete_contact(contact_id)
        return json.dumps({"ok": True, "deleted": contact})
    except KeyError as e:
        return json.dumps({"error": str(e)})


# ===========================================================================
# Entry point
# ===========================================================================

if __name__ == "__main__":
    mcp.run(transport="stdio")
