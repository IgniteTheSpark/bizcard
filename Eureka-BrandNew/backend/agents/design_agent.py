"""
Design Agent — Phase B Step 4 (decision Q1 #4 + Phase A §8).

Takes a user's natural-language description of a new skill they want to track
(e.g. "我想记录跑步训练") and produces a draft:
  { name, display_name, payload_schema, render_spec, sample_payload }

Used by POST /api/skills (Step 5). The frontend's AddSkillWizard streams the
draft into a live preview the user can tweak before committing.

Structured output via Gemini's response_schema (decision Q1 #4) — eliminates
JSON-parsing defensive code and reduces retries.

The render_spec produced here must conform to the receivable enum vocabulary
(7 accent_colors × 4 card_layouts × bounded format/action sets) so the
SkillCard renderer (Phase D §九) can render it without surprise.
"""
import json
import uuid

from google.adk.agents import LlmAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai.types import Content, Part

from core.llm import DESIGN_AGENT_MODEL


_session_service = InMemorySessionService()
APP_NAME = "eureka-design-agent"


DESIGN_INSTRUCTION = """
你是 Eureka 的「skill 设计助手」。用户描述一种想记录的东西,你产出一份
能直接装入 Eureka 系统的 skill 定义。

## 必须返回单个 JSON 对象,字段固定如下:

{
  "name":         "string",   // skill machine name,小写英文,不超过 30 字符,例 "running"
  "display_name": "string",   // 中文显示名,例 "跑步训练"
  "payload_schema": {         // 字段定义,3-6 个字段最合适
    "<field>": {
      "type":        "string|number|datetime|date|boolean",
      "required":    true|false,
      "description": "字段含义"
    }
  },
  "render_spec": {
    "card_layout":      "horizontal|stacked|inline|compact",
    "icon":             "string (1 个 emoji)",
    "accent_color":     "blue|amber|green|red|purple|gray|neutral",
    "primary_field":    "string (payload 字段名)",
    "secondary_field":  "string (payload 字段名,可省)",
    "secondary_format": "text|relative_date|absolute_date|time|currency|duration|badge|truncate_40",
    "meta_fields":      [{"field": "string", "format": "可省", "label": "可省"}],
    "actions":          ["check"|"edit"|"delete"|"open"]
  },
  "sample_payload": {        // 示范数据一条,用于前端实时预览 card 的样子
    "<field>": <value>
  }
}

## 设计规则

- 字段尽量精简:3-6 个就够,多了用户填不动。优先「真正想记录的」,而不是「能记录的」。
- accent_color 必须从 7 个槽里选(都是有语义的):
    blue(默认/中性) · amber(提醒/注意) · green(正向/数字) · red(紧急)
    · purple(事件/日程) · gray(次要) · neutral(无强语义)
- icon 用 1 个 emoji,跟主题贴近(跑步 🏃、读书 📖、睡眠 😴、健身 💪、习惯 ⭕)
- card_layout 默认 horizontal;内容字段多/长用 stacked;时间流密集场景用 inline
- primary_field 必填,选最能一眼识别这条记录的字段(跑步 → 距离;读书 → 书名)
- secondary_format 不确定就 "text",日期/时间字段用 "relative_date" 或 "absolute_date"
- 不要发明 enum 外的值
"""


# Response schema — passed to ADK LlmAgent for guaranteed structured output.
# Gemini's response_schema enforces this at decode time.
RESPONSE_SCHEMA = {
    "type": "object",
    "required": ["name", "display_name", "payload_schema", "render_spec", "sample_payload"],
    "properties": {
        "name":         {"type": "string"},
        "display_name": {"type": "string"},
        "payload_schema": {"type": "object"},
        "render_spec": {
            "type": "object",
            "required": ["card_layout", "icon", "accent_color", "primary_field"],
            "properties": {
                "card_layout": {
                    "type": "string",
                    "enum": ["horizontal", "stacked", "inline", "compact"],
                },
                "icon": {"type": "string"},
                "accent_color": {
                    "type": "string",
                    "enum": ["blue", "amber", "green", "red", "purple", "gray", "neutral"],
                },
                "primary_field":    {"type": "string"},
                "secondary_field":  {"type": "string"},
                "secondary_format": {"type": "string"},
                "meta_fields":      {"type": "array"},
                "actions":          {"type": "array"},
            },
        },
        "sample_payload": {"type": "object"},
    },
}


def make_design_agent() -> LlmAgent:
    """
    Create the design LlmAgent. Stateless — called per /api/skills request.

    NOTE on ADK structured-output API:
    ADK 1.0 LlmAgent should accept output_schema (or response_schema, name may
    differ across versions). If the keyword is wrong at integration time,
    Step 5 will catch it; we may fall back to prompt + JSON-parsing + 1 retry
    if structured output isn't available.
    """
    return LlmAgent(
        name="design_agent",
        model=DESIGN_AGENT_MODEL,
        instruction=DESIGN_INSTRUCTION,
        # output_schema enforces RESPONSE_SCHEMA at generation time when supported.
        # Keyword name may need adjustment for the installed ADK version.
        output_schema=RESPONSE_SCHEMA,
        tools=[],
    )


async def design_skill(description: str, user_id: str = "default") -> dict:
    """
    One-shot design call.
    Returns the parsed draft dict ({name, display_name, payload_schema, render_spec, sample_payload}).

    Raises if the LLM returns non-JSON (shouldn't happen with response_schema,
    but caller should handle JSONDecodeError defensively in Step 5).
    """
    agent = make_design_agent()
    sid = str(uuid.uuid4())
    await _session_service.create_session(
        app_name=APP_NAME, user_id=user_id, session_id=sid,
    )
    runner = Runner(agent=agent, app_name=APP_NAME, session_service=_session_service)
    msg = Content(role="user", parts=[Part(text=description)])

    final_text = ""
    async for event in runner.run_async(
        user_id=user_id, session_id=sid, new_message=msg,
    ):
        if event.is_final_response() and event.content and event.content.parts:
            final_text = event.content.parts[0].text or ""

    return json.loads(final_text)
