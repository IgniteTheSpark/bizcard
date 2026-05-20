"""
In-memory store for mock MCP server.
All data lives in process memory — restarting the server resets everything.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

_assets: dict[str, dict] = {}
_contacts: dict[str, dict] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Asset operations
# ---------------------------------------------------------------------------

VALID_ASSET_TYPES = {"todo", "idea", "note", "expense", "transcript"}


def create_asset(
    asset_type: str,
    payload: dict,
    session_id: str | None = None,
    input_id: str | None = None,
) -> dict:
    if asset_type not in VALID_ASSET_TYPES:
        raise ValueError(f"Unknown asset_type '{asset_type}'. Valid: {VALID_ASSET_TYPES}")

    asset_id = _new_id()
    asset = {
        "asset_id": asset_id,
        "asset_type": asset_type,
        "source_session_id": session_id,
        "source_input_id": input_id,
        "created_at": _now(),
        "payload": payload,
    }
    _assets[asset_id] = asset
    return asset


def query_asset(asset_type: str | None = None, filters: dict | None = None) -> list[dict]:
    results = list(_assets.values())

    if asset_type:
        results = [a for a in results if a["asset_type"] == asset_type]

    if filters:
        # Simple keyword search on payload text fields
        keyword = filters.get("contains", "").lower()
        if keyword:
            def _matches(asset: dict) -> bool:
                payload_str = str(asset.get("payload", "")).lower()
                return keyword in payload_str
            results = [a for a in results if _matches(a)]

    # Sort newest first
    results.sort(key=lambda a: a["created_at"], reverse=True)
    return results


def update_asset(asset_id: str, payload_patch: dict) -> dict:
    if asset_id not in _assets:
        raise KeyError(f"Asset '{asset_id}' not found")
    _assets[asset_id]["payload"].update(payload_patch)
    _assets[asset_id]["updated_at"] = _now()
    return _assets[asset_id]


def delete_asset(asset_id: str) -> dict:
    if asset_id not in _assets:
        raise KeyError(f"Asset '{asset_id}' not found")
    return _assets.pop(asset_id)


# ---------------------------------------------------------------------------
# Contact operations
# ---------------------------------------------------------------------------

def create_contact(
    name: str,
    phone: str | None = None,
    company: str | None = None,
    title: str | None = None,
    email: str | None = None,
    notes: str | None = None,
) -> dict:
    contact_id = _new_id()
    contact = {
        "contact_id": contact_id,
        "name": name,
        "phone": phone,
        "company": company,
        "title": title,
        "email": email,
        "notes": [notes] if notes else [],
        "created_at": _now(),
    }
    _contacts[contact_id] = contact
    return contact


def query_contact(name_query: str) -> list[dict]:
    q = name_query.lower()
    return [c for c in _contacts.values() if q in c["name"].lower()]


def update_contact(contact_id: str, field: str, value: Any) -> dict:
    if contact_id not in _contacts:
        raise KeyError(f"Contact '{contact_id}' not found")
    if field == "notes":
        _contacts[contact_id]["notes"].append(value)
    else:
        _contacts[contact_id][field] = value
    _contacts[contact_id]["updated_at"] = _now()
    return _contacts[contact_id]


def delete_contact(contact_id: str) -> dict:
    if contact_id not in _contacts:
        raise KeyError(f"Contact '{contact_id}' not found")
    return _contacts.pop(contact_id)
