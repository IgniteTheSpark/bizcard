"""
Centralized LLM model configuration.
Swap model strings here to change the model for all agents at once.
Uses OpenRouter as the gateway (OPENROUTER_API_KEY in .env).
"""
from google.adk.models.lite_llm import LiteLlm

# Gemini 2.5 Flash via OpenRouter — fast (~2-3s/call), excellent structured output,
# strong Chinese support; replaces Gemini 2.0 Flash.
FLASH_MODEL = LiteLlm(model="openrouter/google/gemini-2.5-flash")
QUERY_MODEL = LiteLlm(model="openrouter/google/gemini-2.5-flash")
ROOT_MODEL  = LiteLlm(model="openrouter/google/gemini-2.5-flash")
