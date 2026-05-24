"""
LLM configuration — Phase B Step 3.

Single place to:
- Set up provider env vars (LiteLLM picks up from env)
- Define per-role model selections (swap models for all consumers in one place)

Provider: OpenRouter (multi-model gateway). All agents go through ADK's
LiteLlm wrapper so model swaps don't require any agent code changes.

Replaces the previous `agents/model_config.py` (deleted in Step 6 cleanup).
"""
import os

from google.adk.models.lite_llm import LiteLlm

from config import settings


def configure_llm_env() -> None:
    """
    Populate environment variables LiteLLM looks for. Idempotent.
    Called once at app startup from main.py.
    """
    if settings.openrouter_api_key:
        os.environ.setdefault("OPENROUTER_API_KEY", settings.openrouter_api_key)
    if settings.openai_api_key:
        # OpenAI key is for Whisper ASR (audio upload path is deferred per Phase A)
        os.environ.setdefault("OPENAI_API_KEY", settings.openai_api_key)


# ── Per-role models ────────────────────────────────────────────────────────────
# Change a single string here to swap a model for every consumer. Roles are
# named by where they get used in the architecture, not by model family.
#
# Current pick: Gemini 2.5 Flash for everything — fast (~2s/call), good
# structured-output adherence, strong Chinese support, cheap. Upgrade specific
# roles (e.g. ASSISTANT_MODEL → Sonnet) when quality demands it.

ASSISTANT_MODEL        = LiteLlm(model="openrouter/google/gemini-2.5-flash")
FLASH_DISPATCHER_MODEL = LiteLlm(model="openrouter/google/gemini-2.5-flash")
FLASH_SKILL_MODEL      = LiteLlm(model="openrouter/google/gemini-2.5-flash")
DESIGN_AGENT_MODEL     = LiteLlm(model="openrouter/google/gemini-2.5-flash")
