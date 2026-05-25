"""
Unified Assistant agent — Phase B Step 4 (decision #4).

Single ADK LlmAgent + shared MCPToolset. Handles BOTH:
- Intent recognition → asset CRUD (create / update / delete / query)
- Conversational responses (when no clear asset intent)

Used by /api/chat (Step 5). Per-request:
  1. Resolve / create chat session + create input_turn(source=typed)
  2. Load recent N=20 messages from PostgresSessionService (decision #3)
  3. Build assistant with this turn's session_id + input_turn_id baked in
  4. Hand to ADK Runner; stream events out as SSE; persist Message rows

Cross-turn "刚刚那个" reference mechanism:
- recent messages history contains prior tool_call/tool_result rows
- the agent sees those in context and identifies the relevant asset_id
- no special tooling needed — falls out of decision #3 + Step 1 schema
"""
from google.adk.agents import LlmAgent

from agents.mcp_toolset import get_mcp_toolset
from core.llm import ASSISTANT_MODEL


ASSISTANT_INSTRUCTION_BASE = """
你是 Eureka,一个个人 AI 助手。用户对你说话或打字,你识别意图后行动,
或自然对答。

## 核心行为规则

1. **意图明确指向资产 → 直接调工具,不要先问用户确认**
   - 「帮我建个待办」「记一笔花了 50」「记下张三电话 138…」 →
     立刻调 create_asset / create_contact
   - 「把刚刚那个待办改成 4 点」「删掉那个想法」 →
     从对话历史里最近的 tool_call+tool_result 找到 asset_id,
     调 update_asset / delete_asset
   - 「这周有什么待办」「上次跟刘洋说什么了」 →
     调 query_asset / query_input_turn 拿数据后简短自然回答

2. **没有明确资产意图 → 自然对答**
   - 总结、分析、闲聊、给建议 → 直接回答,不要硬塞工具调用
   - UI 会自动在你的回答下方提供「沉淀为资产」选项,用户想留就留

3. **跨 turn 引用「刚刚那个」「上面那条」**
   - 优先看对话历史最近的 tool_call(create_asset / update_asset)拿 asset_id
   - 如果不在近 20 条历史里,调 query_asset 拿最新几条做候选,挑最贴合的

4. **长 transcript(会议)按需检索,不假设你已经看过**
   - 用户问会议内容时调 query_input_turn 找相关片段,需要全文再 get_input_turn

## 工具签名要点

create_asset 必传 user_skill_name(skill 的 machine name,例 'todo' 'event')
和 payload(JSON 字符串)。session_id 和 source_input_turn_id 从本轮上下
文获取(下方),传给工具表示资产来源。

## 回复风格

- 简洁,自然,不卖萌,不堆感叹号
- 中文回复
- 不暴露技术细节(asset_id / 工具名 / JSON 不在正文里出现)
- CRUD 成功后短确认:「已记录」「已改到 4 点」「已删除」
- 引用资产时用「待办『跟客户开会』」这种自然语言,不要 ID
"""


def make_assistant_agent(
    session_id: str,
    input_turn_id: str,
    event_id: str = "",
) -> LlmAgent:
    """
    Build a fresh Assistant LlmAgent with this turn's session_id and
    input_turn_id woven into the system prompt. The agent uses these
    when calling create_asset(source_input_turn_id=...).

    v1.4: if event_id is set (chat-from-event flow), inject a hint so the
    agent treats this chat as anchored to that event — it can call
    tool_get_event(event_id) to fetch full context, tool_update_event /
    tool_add_event_attendee / tool_link_event_file to act on it.

    Stateless — instantiate per request. Tools (the shared MCPToolset)
    are cheap to attach since the underlying subprocess is a singleton.
    """
    instruction = (
        ASSISTANT_INSTRUCTION_BASE
        + "\n\n## 本轮上下文(给工具调用用)\n"
        + f"- session_id: {session_id}\n"
        + f"- input_turn_id: {input_turn_id}\n"
        + "  → 创建资产时把这个值作为 source_input_turn_id 参数传给 create_asset\n"
    )
    if event_id:
        instruction += (
            f"- event_id: {event_id}\n"
            "  → 本轮 chat **锚定到这个 event**。用户可能问「这个会议的参与人有谁」、\n"
            "    「帮我准备会前调研」、「改一下会议时间」等。需要 event 详细信息时\n"
            "    调 tool_get_event(event_id) 拿(title / start_at / location /\n"
            "    attendees / files);需要操作时用 tool_update_event /\n"
            "    tool_add_event_attendee / tool_link_event_file 等。\n"
        )
    return LlmAgent(
        name="assistant",
        model=ASSISTANT_MODEL,
        instruction=instruction,
        tools=[get_mcp_toolset()],
    )
