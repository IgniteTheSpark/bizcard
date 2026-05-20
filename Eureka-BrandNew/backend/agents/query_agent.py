"""
Query Agent — handles global knowledge queries.
Routes to structured DB lookup (fast, no LLM) or semantic LLM analysis.
"""
import json
import asyncio
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools import FunctionTool

from mcp.tools import query_asset, query_contact
from db.queries import query_assets_structured
from db.database import AsyncSessionLocal

CLAUDE = LiteLlm(model="anthropic/claude-sonnet-4-6")

QUERY_INSTRUCTION = """
You are the Query Agent for Eureka, a personal knowledge assistant.

When a user asks a question about their data:

1. STRUCTURED queries (filter/lookup) — call query_assets_structured directly:
   - "我花了150块" → filters: [{field: amount, op: eq, value: 150}]
   - "本周待办" → filters: [{field: due_at, op: lte, value: <end of week>}]
   - "刘洋的联系方式" → call query_contacts with name_query="刘洋"

2. SEMANTIC queries (analysis/summary) — call query_asset to fetch relevant assets,
   then reason over them to produce the answer:
   - "最近消费有什么规律"
   - "哪些想法还没有跟进"

Always respond in Chinese. Be concise and specific.
Cite the asset_id when referencing a specific item.
"""


def tool_query_assets_structured(
    asset_type: str = "",
    filters_json: str = "[]",
    limit: int = 50,
) -> str:
    """
    Query assets using indexed fields. No LLM involved — pure SQL.
    filters_json: JSON array of {field, op, value} objects.
    op: eq | gt | gte | lt | lte
    """
    filters = json.loads(filters_json)
    async def _run():
        async with AsyncSessionLocal() as db:
            return await query_assets_structured(db, "default", asset_type or None, filters, limit)
    results = asyncio.get_event_loop().run_until_complete(_run())
    return json.dumps(results, ensure_ascii=False, default=str)


def tool_query_asset_semantic(asset_type: str = "", contains: str = "") -> str:
    """Fetch assets by type/keyword for semantic analysis."""
    result = asyncio.get_event_loop().run_until_complete(query_asset(asset_type, contains))
    return json.dumps(result, ensure_ascii=False)


def tool_query_contacts(name_query: str = "") -> str:
    """Look up contacts by name."""
    result = asyncio.get_event_loop().run_until_complete(query_contact(name_query))
    return json.dumps(result, ensure_ascii=False)


query_agent = LlmAgent(
    name="query",
    model=CLAUDE,
    instruction=QUERY_INSTRUCTION,
    description="Answers questions about the user's assets and contacts. Routes to SQL index for structured queries, LLM analysis for semantic queries.",
    tools=[
        FunctionTool(tool_query_assets_structured),
        FunctionTool(tool_query_asset_semantic),
        FunctionTool(tool_query_contacts),
    ],
    output_key="query_result",
)
