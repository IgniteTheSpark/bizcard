"""
Query Agent — handles global knowledge queries.
Routes to structured DB lookup (fast, no LLM) or semantic LLM analysis.
"""
import json
from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool

from mcp.tools import query_asset, query_contact, create_asset, update_asset, delete_asset
from db.queries import query_assets_structured
from db.database import AsyncSessionLocal
from agents.model_config import QUERY_MODEL

QUERY_INSTRUCTION = """
You are the Query Agent for Eureka, a personal knowledge assistant.
You MUST call a tool to fetch real data before answering — never guess or answer from memory.
You can BOTH query data AND modify/delete assets when the user asks.

## Choosing a tool

### 待办查询（"今天有什么待办", "我有哪些代办"）
调用 tool_query_asset_semantic(asset_type="todo")
根据 payload.due_date 按日期过滤。用户消息里有"今天是 YYYY年MM月DD日"，据此判断日期。

### 修改/更新资产（"把X改成Y", "可以把X改成Y吗", "修改X", "把X标记完成"）
1. 先调用 tool_query_asset_semantic 查找目标资产，获取 asset_id
2. 调用 tool_update_asset(asset_id=..., payload_patch=JSON字符串)
- due_date 用 ISO8601 格式: YYYY-MM-DD 或 YYYY-MM-DDTHH:MM:SS
- status 字段: "pending" | "done"
- 修改内容（content）、金额（amount）等字段直接更新

### 删除资产（"删除X", "取消X"）
1. 先 tool_query_asset_semantic 找到 asset_id
2. 调用 tool_delete_asset(asset_id=...)

### 消费/金额查询
- **无论**用户说"今天"、"刚才"、"最近"还是"所有消费"，一律调用：
  tool_query_asset_semantic(asset_type="expense")
- **严禁**对 expense 使用 tool_query_assets_structured（payload.date 格式不稳定，会漏数据）
- 拿到数据后自行过滤：
  - 按日期 → 比较 created_at 字段（YYYY-MM-DDTHH:MM:SS 格式，与 "今天是..." 对比）
  - 按金额/类别 → 遍历 payload 字段筛选
- 用自然语言简洁回复（商户 · 金额 · 类别），不要展示 asset_id

### 联系人查询
调用 tool_query_contacts(name_query="...")

### 想法/笔记/其他语义分析
调用 tool_query_asset_semantic(asset_type="idea"|"note"|"misc"|"")

### 创建新资产（"帮我创建一个待办", "新增一条记账", "记录一个想法"）
调用 tool_create_asset(asset_type=..., payload_json=JSON字符串)
- todo payload: {"content": "...", "due_date": "YYYY-MM-DDTHH:MM:SS", "priority": "high|medium|low", "status": "pending"}
- expense payload: {"amount": 数字, "currency": "CNY", "merchant": "...", "description": "...", "date": "YYYY-MM-DD", "category": "..."}
- idea/note payload: {"content": "...", "tags": [...]}
- due_date / date 必须是绝对日期，根据"今天是 YYYY年MM月DD日"推算，禁止存"明天"等相对词

## 回复规范
- 必须先调用工具，绝对不能凭记忆或猜测直接回答
- payload 里 todo 的截止时间字段名是 due_date（不是 due_at）
- 用中文回复，简洁具体，不要输出 asset_id 等技术细节
- 修改成功后确认"已将…改为…"
- 创建成功后确认"已为你创建…"
"""


async def tool_query_assets_structured(
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
    async with AsyncSessionLocal() as db:
        results = await query_assets_structured(db, "default", asset_type or None, filters, limit)
    return json.dumps(results, ensure_ascii=False, default=str)


async def tool_query_asset_semantic(asset_type: str = "", contains: str = "") -> str:
    """Fetch assets by type/keyword for semantic analysis."""
    result = await query_asset(asset_type, contains)
    return json.dumps(result, ensure_ascii=False)


async def tool_query_contacts(name_query: str = "") -> str:
    """Look up contacts by name."""
    result = await query_contact(name_query)
    return json.dumps(result, ensure_ascii=False)


async def tool_update_asset(asset_id: str, payload_patch: str) -> str:
    """Update an existing asset. payload_patch is a JSON string of fields to update."""
    result = await update_asset(asset_id, payload_patch)
    return json.dumps(result, ensure_ascii=False)


async def tool_delete_asset(asset_id: str) -> str:
    """Delete an asset by its asset_id."""
    result = await delete_asset(asset_id)
    return json.dumps(result, ensure_ascii=False)


async def tool_create_asset(asset_type: str, payload_json: str) -> str:
    """Create a new asset. asset_type: todo|expense|idea|note. payload_json is a JSON string of fields."""
    result = await create_asset(asset_type, payload_json)
    return json.dumps(result, ensure_ascii=False)


query_agent = LlmAgent(
    name="query",
    model=QUERY_MODEL,
    instruction=QUERY_INSTRUCTION,
    description="Answers questions and manages assets: query, create, modify, or delete todos/expenses/ideas/contacts.",
    tools=[
        FunctionTool(tool_query_assets_structured),
        FunctionTool(tool_query_asset_semantic),
        FunctionTool(tool_query_contacts),
        FunctionTool(tool_update_asset),
        FunctionTool(tool_delete_asset),
        FunctionTool(tool_create_asset),
    ],
    output_key="query_result",
)
