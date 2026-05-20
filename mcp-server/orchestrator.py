"""
Flash Note Orchestrator
Dispatcher → Sub-skills (sequential) → Session Writer
Run: python orchestrator.py
"""

import os
import sys
import json
import store
import anthropic
from pathlib import Path

# ── Config ─────────────────────────────────────────────────────────────────

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
MODEL = "claude-opus-4-5"
BASE_DIR = Path(__file__).parent
SKILLS_DIR = BASE_DIR / "skills"

# ── Tool definitions (names match what SKILL.md files reference) ───────────

TOOLS = [
    {
        "name": "mcp__bizcard-mock__create_asset",
        "description": (
            "Create a new asset. "
            "asset_type: todo | idea | note | expense | transcript. "
            "payload: JSON string with type-specific fields."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "asset_type": {"type": "string"},
                "payload":    {"type": "string"},
                "session_id": {"type": "string"},
                "input_id":   {"type": "string"},
            },
            "required": ["asset_type", "payload"],
        },
    },
    {
        "name": "mcp__bizcard-mock__query_asset",
        "description": "Query assets. asset_type: filter by type (optional). contains: keyword search (optional).",
        "input_schema": {
            "type": "object",
            "properties": {
                "asset_type": {"type": "string"},
                "contains":   {"type": "string"},
            },
        },
    },
    {
        "name": "mcp__bizcard-mock__update_asset",
        "description": "Update fields in an existing asset's payload.",
        "input_schema": {
            "type": "object",
            "properties": {
                "asset_id":      {"type": "string"},
                "payload_patch": {"type": "string"},
            },
            "required": ["asset_id", "payload_patch"],
        },
    },
    {
        "name": "mcp__bizcard-mock__create_contact",
        "description": "Create a new contact. name is required.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name":    {"type": "string"},
                "phone":   {"type": "string"},
                "company": {"type": "string"},
                "title":   {"type": "string"},
                "email":   {"type": "string"},
                "notes":   {"type": "string"},
            },
            "required": ["name"],
        },
    },
    {
        "name": "mcp__bizcard-mock__query_contact",
        "description": "Search contacts by name (case-insensitive substring match).",
        "input_schema": {
            "type": "object",
            "properties": {
                "name_query": {"type": "string"},
            },
            "required": ["name_query"],
        },
    },
    {
        "name": "mcp__bizcard-mock__update_contact",
        "description": "Update a single field on an existing contact.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_id": {"type": "string"},
                "field":      {"type": "string"},
                "value":      {"type": "string"},
            },
            "required": ["contact_id", "field", "value"],
        },
    },
]

# ── Tool executor (routes to store.py) ─────────────────────────────────────

def execute_tool(name: str, inp: dict) -> dict:
    try:
        if name == "mcp__bizcard-mock__create_asset":
            payload_dict = json.loads(inp["payload"])
            asset = store.create_asset(
                asset_type=inp["asset_type"],
                payload=payload_dict,
                session_id=inp.get("session_id") or None,
                input_id=inp.get("input_id") or None,
            )
            return {"ok": True, "asset": asset}

        elif name == "mcp__bizcard-mock__query_asset":
            filters = {}
            if inp.get("contains"):
                filters["contains"] = inp["contains"]
            results = store.query_asset(
                asset_type=inp.get("asset_type") or None,
                filters=filters or None,
            )
            return {"ok": True, "count": len(results), "assets": results}

        elif name == "mcp__bizcard-mock__update_asset":
            patch = json.loads(inp["payload_patch"])
            asset = store.update_asset(inp["asset_id"], patch)
            return {"ok": True, "asset": asset}

        elif name == "mcp__bizcard-mock__create_contact":
            contact = store.create_contact(
                name=inp["name"],
                phone=inp.get("phone") or None,
                company=inp.get("company") or None,
                title=inp.get("title") or None,
                email=inp.get("email") or None,
                notes=inp.get("notes") or None,
            )
            return {"ok": True, "contact": contact}

        elif name == "mcp__bizcard-mock__query_contact":
            results = store.query_contact(inp["name_query"])
            return {"ok": True, "count": len(results), "candidates": results}

        elif name == "mcp__bizcard-mock__update_contact":
            contact = store.update_contact(inp["contact_id"], inp["field"], inp["value"])
            return {"ok": True, "contact": contact}

        else:
            return {"error": f"Unknown tool: {name}"}

    except Exception as e:
        return {"error": str(e)}


# ── Claude caller with tool-use loop ───────────────────────────────────────

def call_claude(system: str, user: str, use_tools: bool = False) -> str:
    messages = [{"role": "user", "content": user}]
    tools = TOOLS if use_tools else []

    while True:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=system,
            messages=messages,
            tools=tools,
        )

        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    return block.text
            return ""

        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = execute_tool(block.name, block.input)
                    print(f"        🔧 {block.name} → {json.dumps(result, ensure_ascii=False)[:80]}…")
                    tool_results.append({
                        "type": "tool_use_id" and "tool_result",
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result, ensure_ascii=False),
                    })
            messages.append({"role": "user", "content": tool_results})


# ── Pipeline ────────────────────────────────────────────────────────────────

def run(user_text: str, session_id: str = "session_local_001", input_id: str = "input_001"):
    print(f"\n{'━' * 60}")
    print(f"  INPUT : {user_text}")
    print(f"{'━' * 60}")

    # Step 1: Dispatcher
    print("\n[1/3] Dispatcher")
    dispatcher_system = (SKILLS_DIR / "flash_note_dispatcher.md").read_text(encoding="utf-8")
    dispatcher_user = (
        f'user_text: "{user_text}"\n'
        f'session_id: "{session_id}"\n'
        f'input_id: "{input_id}"'
    )
    raw = call_claude(dispatcher_system, dispatcher_user)
    dispatch_plan = json.loads(raw)
    for item in dispatch_plan["dispatch"]:
        print(f"      → {item['skill']}: 「{item['source_text']}」")

    if not dispatch_plan["dispatch"]:
        print("      (no intents found)")
        return {"ok": True, "summary": "本次闪念未识别到可保存的内容。", "cards": [], "has_pending": False}

    # Step 2: Sub-skills
    print("\n[2/3] Sub-skills")
    skill_results = []
    for item in dispatch_plan["dispatch"]:
        skill_name = item["skill"]
        source_text = item["source_text"]
        skill_dir = SKILLS_DIR / f"flash-{skill_name}"

        if not skill_dir.exists():
            print(f"      ⚠ skill not found: {skill_name}, skipping")
            continue

        skill_system = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
        skill_user = (
            f'source_text: "{source_text}"\n'
            f'user_text: "{user_text}"\n'
            f'session_id: "{session_id}"\n'
            f'input_id: "{input_id}"'
        )
        use_tools = skill_name != "qa-skill"
        print(f"      → {skill_name}")
        raw = call_claude(skill_system, skill_user, use_tools=use_tools)
        result = json.loads(raw)
        skill_results.append({"skill": skill_name, "source_text": source_text, **result})
        status = "✓" if result.get("ok") else "✗"
        print(f"        {status} done")

    # Step 3: Session Writer
    print("\n[3/3] Session Writer")
    writer_system = (SKILLS_DIR / "flash-session-writer-skill" / "SKILL.md").read_text(encoding="utf-8")
    writer_user = (
        f'user_text: "{user_text}"\n'
        f'session_id: "{session_id}"\n'
        f'input_id: "{input_id}"\n'
        f'results: {json.dumps(skill_results, ensure_ascii=False, indent=2)}'
    )
    raw = call_claude(writer_system, writer_user)
    final = json.loads(raw)

    print(f"\n{'━' * 60}")
    print("  OUTPUT:")
    print(json.dumps(final, ensure_ascii=False, indent=2))
    print(f"{'━' * 60}\n")
    return final


# ── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Pass input as command-line argument
        user_text = " ".join(sys.argv[1:])
    else:
        # Default test cases
        cases = [
            "保存联系人刘洋手机13900002222公司XX科技，提醒我明天给他发合同，另外我觉得可以做一个客户偏好标签系统",
            "今天午饭花了68块，吃的日料",
            "拿铁和美式有什么区别",
        ]
        print("No input provided. Running default test cases.\n")
        for case in cases:
            run(case)
        sys.exit(0)

    run(user_text)
