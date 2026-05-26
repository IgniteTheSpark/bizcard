"""
Sub-skill agent factory — Phase B v1.4.x.

Builds ADK LlmAgents from the skills/ directory + shared MCPToolset.

Adding a new skill:
1. Drop `skills/flash-<name>-skill/SKILL.md` — it's auto-discovered at boot
2. Add UserSkill row (via db/seed.py or design-agent flow) so the asset has
   payload_schema + render_spec
3. Add a row to flash-dispatcher/SKILL.md's intent table so the dispatcher
   knows the type exists

No factory code changes needed — `SKILL_FOLDER_MAP` is computed from the
filesystem at import time.
"""
from pathlib import Path

from google.adk.agents import LlmAgent

from agents.mcp_toolset import get_mcp_toolset
from core.llm import FLASH_SKILL_MODEL, FLASH_DISPATCHER_MODEL


SKILLS_DIR = Path(__file__).parent.parent / "skills"

# Folders we never want to dispatch to even if they live in skills/.
# `flash-dispatcher` is the dispatcher itself, not a sub-skill.
_NON_SKILL_FOLDERS = {"flash-dispatcher"}


def _discover_skill_folders() -> dict[str, str]:
    """
    Scan skills/ for folders matching `flash-<machine_name>-skill/` that
    contain a SKILL.md, return {machine_name → folder_name}.

    Naming convention: `flash-<machine_name>-skill`
      - `flash-todo-skill`    → machine_name="todo"
      - `flash-expense-skill` → machine_name="expense"

    Folders not matching this pattern (e.g. flash-dispatcher) are skipped.
    """
    out: dict[str, str] = {}
    if not SKILLS_DIR.exists():
        return out
    for folder in SKILLS_DIR.iterdir():
        if not folder.is_dir():
            continue
        if folder.name in _NON_SKILL_FOLDERS:
            continue
        if not (folder / "SKILL.md").exists():
            continue
        name = folder.name
        if not (name.startswith("flash-") and name.endswith("-skill")):
            continue
        machine_name = name[len("flash-"):-len("-skill")]
        out[machine_name] = name
    return out


# Snapshot at import time. Restart backend to pick up newly-added skill folders.
SKILL_FOLDER_MAP: dict[str, str] = _discover_skill_folders()


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
        raise ValueError(
            f"unknown skill: {skill_name!r}. "
            f"Discovered: {sorted(SKILL_FOLDER_MAP)}. "
            f"To add: drop skills/flash-{skill_name}-skill/SKILL.md and restart."
        )
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
