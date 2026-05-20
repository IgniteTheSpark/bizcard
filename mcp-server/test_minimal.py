from mcp.server.fastmcp import FastMCP

mcp = FastMCP("test")

@mcp.tool()
def hello(name: str) -> str:
    """Say hello"""
    return f"Hello, {name}!"

if __name__ == "__main__":
    mcp.run(transport="stdio")
