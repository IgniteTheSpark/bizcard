"""
Root Agent — intent router.
Classifies user input as flash_note (capture) or query (retrieval/analysis),
then delegates to the appropriate sub-agent.

This is the single entry point for all user interactions.
"""
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm

from agents.flash_agent import flash_agent
from agents.query_agent import query_agent

CLAUDE = LiteLlm(model="anthropic/claude-sonnet-4-6")

ROOT_INSTRUCTION = """
You are the Eureka routing agent. Your only job is to classify the user's input
and hand it off to the right sub-agent. Do not answer questions yourself.

Classification rules:
- flash_note: User is capturing/recording something new.
  Keywords: 记得、提醒、花了、联系、想到、记一下、待办、刚才
  Examples: "今天花了150块吃麦当劳", "记得明天联系刘洋", "想到一个好主意"

- query: User is asking about existing data.
  Keywords: 查、有哪些、什么时候、多少、帮我找、总结、分析
  Examples: "我本周有哪些待办", "上次吃麦当劳花了多少", "刘洋的联系方式"

Route to the correct sub-agent and pass the user's original text unchanged.
"""

root_agent = LlmAgent(
    name="router",
    model=CLAUDE,
    instruction=ROOT_INSTRUCTION,
    description="Routes user input to flash_note agent (capture) or query agent (retrieval).",
    sub_agents=[flash_agent, query_agent],
)
