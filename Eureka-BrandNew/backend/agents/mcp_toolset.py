"""
MCPToolset singleton — Phase B Step 4 (decision Q1 #1).

One MCPToolset connects to one mcp_server/server.py stdio subprocess. All agents
share the same instance to avoid the ~200ms per-call subprocess spawn cost
that would make conversations feel sluggish.

Lazy-initialized on first use; explicit close on app shutdown.
"""
import os
import sys

from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StdioServerParameters

_toolset: MCPToolset | None = None


def get_mcp_toolset() -> MCPToolset:
    """
    Returns the shared MCPToolset, lazy-initialized on first call.

    Used by:
    - agents/assistant.py (unified Assistant)
    - agents/skill_factory.py (sub-skill agents in Flash Pipeline)
    - agents/design_agent.py
    """
    global _toolset
    if _toolset is None:
        _toolset = MCPToolset(
            connection_params=StdioServerParameters(
                command=sys.executable,
                args=["-m", "mcp_server.server"],
                # Propagate DB / LLM env vars to subprocess
                env=os.environ.copy(),
            )
        )
    return _toolset


async def close_mcp_toolset() -> None:
    """Tear down the singleton (call from app shutdown handler in main.py)."""
    global _toolset
    if _toolset is None:
        return
    try:
        # ADK MCPToolset exposes close()/async cleanup — exact name may vary.
        # Best-effort cleanup; ignore errors during shutdown.
        if hasattr(_toolset, "close"):
            result = _toolset.close()
            if hasattr(result, "__await__"):
                await result
    except Exception:
        pass
    finally:
        _toolset = None
