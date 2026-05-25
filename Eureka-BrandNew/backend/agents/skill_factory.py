"""
Sub-skill agent factory — Phase B Step 4.

Builds ADK LlmAgents from the skills/ directory + shared MCPToolset.

Adding a new skill = (1) drop skills/<folder>/SKILL.md + (2) register in
SKILL_FOLDER_MAP below + (3) add a UserSkill row via seed or the add-skill
flow. No factory code changes for typical additions.
"""
from pathlib import Path

from google.adk.agents import LlmAgent

from agents.mcp_toolset import get_mcp_toolset
from core.llm import FLASH_SKILL_MODEL, FLASH_DISPATCHER_MODEL


SKILLS_DIR = Path(__file__).parent.parent / "skills"


# Logical skill name → directory under skills/
SKILL_FOLDER_MAP = {
    "todo":    "flash-todo-skill",
    "event":   "flash-event-skill",
    "idea":    "flash-idea-skill",
    "notes":   "flash-notes-skill",     # v1.4
    "misc":    "flash-misc-skill",      # v1.4
    "expense": "flash-expense-skill",
    "contact": "flash-contact-skill",
    "qa":      "flash-qa-skill",
}


def _load_prompt(folder: str) -> str:
    """Load skills/<folder>/SKILL.md as a string."""
    path = SKILLS_DIR / folder / "SKILL.md"
    if not path.exists():
        raise FileNotFoundError(f"no SKILL.md at {path}")
    return path.read_text(encoding="utf-8")


def make_skill_agent(skill_name: str) -> LlmAgent:
    """
    Create an ephemeral LlmAgent for a flash-pipeline sub-skill.
    Each call returns a fresh agent (cheap — they are stateless one-shots).
    """
    folder = SKILL_FOLDER_MAP.get(skill_name)
    if not folder:
        raise ValueError(f"unknown skill: {skill_name}")
    prompt = _load_prompt(folder)
    return LlmAgent(
        name=f"{skill_name}_skill",
        model=FLASH_SKILL_MODEL,
        instruction=prompt,
        tools=[get_mcp_toolset()],
    )


def make_dispatcher_agent() -> LlmAgent:
    """
    Create the Flash Pipeline dispatcher LlmAgent.
    Outputs intent list JSON; no tools (pure classification).
    """
    prompt = _load_prompt("flash-dispatcher")
    return LlmAgent(
        name="flash_dispatcher",
        model=FLASH_DISPATCHER_MODEL,
        instruction=prompt,
        tools=[],
    )
