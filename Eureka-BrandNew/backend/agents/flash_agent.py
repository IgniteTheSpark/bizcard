"""
Flash Note Agent — processes unstructured text input (voice transcription or typed)
and extracts structured assets via the dispatcher + skill pipeline.

Reuses existing SKILL.md prompt files unchanged.
"""
import os
import json
from pathlib import Path
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools import FunctionTool

from mcp.tools import (
    create_asset, query_asset, update_asset,
    create_contact, query_contact, update_contact,
)

SKILLS_DIR = Path(__file__).parent.parent / "skills"

CLAUDE = LiteLlm(model="anthropic/claude-sonnet-4-6")


def _load_skill(filename: str) -> str:
    return (SKILLS_DIR / filename).read_text(encoding="utf-8")


# ── Tool wrappers (sync-compatible for ADK) ────────────────────────────────────

def tool_create_asset(asset_type: str, payload: str,
                      session_id: str = "", input_id: str = "") -> str:
    import asyncio
    result = asyncio.get_event_loop().run_until_complete(
        create_asset(asset_type, payload, session_id, input_id)
    )
    return json.dumps(result, ensure_ascii=False)


def tool_query_asset(asset_type: str = "", contains: str = "") -> str:
    import asyncio
    result = asyncio.get_event_loop().run_until_complete(query_asset(asset_type, contains))
    return json.dumps(result, ensure_ascii=False)


def tool_create_contact(name: str, phone: str = "", company: str = "",
                        title: str = "", email: str = "", notes: str = "") -> str:
    import asyncio
    result = asyncio.get_event_loop().run_until_complete(
        create_contact(name, phone, company, title, email, notes)
    )
    return json.dumps(result, ensure_ascii=False)


def tool_query_contact(name_query: str = "") -> str:
    import asyncio
    result = asyncio.get_event_loop().run_until_complete(query_contact(name_query))
    return json.dumps(result, ensure_ascii=False)


def tool_update_contact(contact_id: str, field: str, value: str) -> str:
    import asyncio
    result = asyncio.get_event_loop().run_until_complete(update_contact(contact_id, field, value))
    return json.dumps(result, ensure_ascii=False)


# ── Agent definition ───────────────────────────────────────────────────────────

flash_agent = LlmAgent(
    name="flash_note",
    model=CLAUDE,
    instruction=_load_skill("flash_note_dispatcher.md"),
    description="Processes flash note input: dispatches to todo/contact/idea/expense/qa skills and returns structured asset cards.",
    tools=[
        FunctionTool(tool_create_asset),
        FunctionTool(tool_query_asset),
        FunctionTool(tool_create_contact),
        FunctionTool(tool_query_contact),
        FunctionTool(tool_update_contact),
    ],
    output_key="flash_result",
)
