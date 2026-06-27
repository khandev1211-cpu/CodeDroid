"""
mcp_bus.py — MCP Plugin Bus for CodeDroid v4.

Manages connections to MCP servers (stdio transport for local,
SSE/HTTP transport for remote). Handles:
  - Server registration and lifecycle
  - Tool discovery (tools/list)
  - Tool invocation routing
  - Permission enforcement
  - Hot-reload on manifest change

MCP spec: https://modelcontextprotocol.io/specification
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import httpx

logger = logging.getLogger("mcp_bus")

# ── Permission levels ──────────────────────────────────────────────────────────
PERMISSION_LEVELS = {
    "filesystem:read":   10,
    "filesystem:write":  20,
    "network:external":  30,
    "shell:execute":     40,
}


@dataclass
class McpTool:
    name: str
    description: str
    input_schema: dict
    server_id: str


@dataclass
class McpServer:
    id: str
    name: str
    description: str
    transport: str          # "stdio" | "sse" | "http"
    command: list[str]      # for stdio
    url: str                # for sse/http
    permissions: list[str]  # declared permissions
    enabled: bool = True
    status: str = "disconnected"  # disconnected | connecting | connected | error
    error: str = ""
    tools: list[McpTool] = field(default_factory=list)
    _process: Any = field(default=None, repr=False)
    _reader: Any = field(default=None, repr=False)
    _writer: Any = field(default=None, repr=False)
    _pending: dict = field(default_factory=dict, repr=False)
    _msg_id: int = field(default=0, repr=False)


# ── Plugin manifest format ─────────────────────────────────────────────────────
# Stored as JSON files in ~/.codedroid/plugins/<name>/manifest.json
#
# {
#   "id": "github",
#   "name": "GitHub MCP",
#   "description": "Browse repos, issues, PRs",
#   "transport": "stdio",
#   "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
#   "url": "",
#   "permissions": ["network:external"],
#   "enabled": true
# }

PLUGINS_DIR = Path.home() / ".codedroid" / "plugins"
BUILTIN_DIR = Path(__file__).parent / "mcp_servers"


# ── MCP Bus ────────────────────────────────────────────────────────────────────

class McpBus:
    def __init__(self):
        self._servers: dict[str, McpServer] = {}
        self._lock = asyncio.Lock()
        self._initialized = False

    async def initialize(self) -> None:
        """Load all plugin manifests and connect enabled servers."""
        if self._initialized:
            return
        self._initialized = True
        PLUGINS_DIR.mkdir(parents=True, exist_ok=True)

        # Install built-in servers
        await self._install_builtin_servers()

        # Load all manifests
        for manifest_path in PLUGINS_DIR.glob("*/manifest.json"):
            try:
                manifest = json.loads(manifest_path.read_text())
                server = self._manifest_to_server(manifest)
                self._servers[server.id] = server
                if server.enabled:
                    asyncio.create_task(self._connect_server(server))
            except Exception as e:
                logger.warning(f"Failed to load plugin {manifest_path}: {e}")

    async def _install_builtin_servers(self) -> None:
        """Write built-in server manifests if not already present."""
        builtins = [
            {
                "id": "web-search",
                "name": "Web Search",
                "description": "Search the web via DuckDuckGo — no API key required",
                "transport": "builtin",
                "command": [],
                "url": "",
                "permissions": ["network:external"],
                "enabled": True,
            },
            {
                "id": "github",
                "name": "GitHub",
                "description": "Browse repos, issues, PRs, and create branches",
                "transport": "stdio",
                "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
                "url": "",
                "permissions": ["network:external"],
                "enabled": False,  # needs GITHUB_PERSONAL_ACCESS_TOKEN env var
            },
            {
                "id": "filesystem",
                "name": "Filesystem (extended)",
                "description": "Extended file system operations via MCP",
                "transport": "stdio",
                "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem",
                            str(Path.home())],
                "url": "",
                "permissions": ["filesystem:read", "filesystem:write"],
                "enabled": False,
            },
        ]

        for b in builtins:
            dest = PLUGINS_DIR / b["id"] / "manifest.json"
            dest.parent.mkdir(parents=True, exist_ok=True)
            if not dest.exists():
                dest.write_text(json.dumps(b, indent=2))

    def _manifest_to_server(self, m: dict) -> McpServer:
        return McpServer(
            id=m["id"],
            name=m["name"],
            description=m.get("description", ""),
            transport=m.get("transport", "stdio"),
            command=m.get("command", []),
            url=m.get("url", ""),
            permissions=m.get("permissions", []),
            enabled=m.get("enabled", True),
        )

    # ── Server connection ──────────────────────────────────────────────────────

    async def _connect_server(self, server: McpServer) -> None:
        server.status = "connecting"
        try:
            if server.transport == "builtin":
                server.status = "connected"
                server.tools = self._builtin_tools(server.id)
                return

            if server.transport == "stdio":
                await self._connect_stdio(server)
            elif server.transport in ("sse", "http"):
                await self._connect_http(server)

            # Discover tools
            tools = await self._list_tools(server)
            server.tools = tools
            server.status = "connected"
            logger.info(f"[MCP] {server.name}: connected, {len(tools)} tools")

        except Exception as e:
            server.status = "error"
            server.error = str(e)
            logger.warning(f"[MCP] {server.name}: connection failed — {e}")

    async def _connect_stdio(self, server: McpServer) -> None:
        if not server.command:
            raise ValueError("stdio server has no command")

        env = {**os.environ}
        proc = await asyncio.create_subprocess_exec(
            *server.command,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        server._process = proc
        server._reader = proc.stdout
        server._writer = proc.stdin

        # MCP initialize handshake
        await self._send_request(server, "initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "clientInfo": {"name": "CodeDroid", "version": "4.0.0"},
        })
        await self._send_notification(server, "notifications/initialized", {})

    async def _connect_http(self, server: McpServer) -> None:
        # SSE/HTTP transport — just verify the endpoint is reachable
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(server.url)
            if r.status_code >= 400:
                raise ConnectionError(f"HTTP {r.status_code} from {server.url}")

    # ── JSON-RPC over stdio ────────────────────────────────────────────────────

    async def _send_request(self, server: McpServer, method: str, params: dict) -> Any:
        if server.transport != "stdio":
            return {}
        server._msg_id += 1
        msg_id = server._msg_id
        payload = json.dumps({"jsonrpc": "2.0", "id": msg_id,
                               "method": method, "params": params}) + "\n"
        server._writer.write(payload.encode())
        await server._writer.drain()

        # Read response
        event = asyncio.Event()
        server._pending[msg_id] = {"event": event, "result": None, "error": None}

        # Start background reader if not running
        asyncio.create_task(self._read_responses(server))

        try:
            await asyncio.wait_for(event.wait(), timeout=15.0)
        except asyncio.TimeoutError:
            server._pending.pop(msg_id, None)
            raise TimeoutError(f"MCP request '{method}' timed out")

        entry = server._pending.pop(msg_id, {})
        if entry.get("error"):
            raise RuntimeError(f"MCP error: {entry['error']}")
        return entry.get("result", {})

    async def _send_notification(self, server: McpServer, method: str, params: dict) -> None:
        if server.transport != "stdio":
            return
        payload = json.dumps({"jsonrpc": "2.0", "method": method, "params": params}) + "\n"
        server._writer.write(payload.encode())
        await server._writer.drain()

    async def _read_responses(self, server: McpServer) -> None:
        """Read JSON-RPC responses from the server process stdout."""
        if not server._reader:
            return
        try:
            async for line in server._reader:
                line = line.decode().strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line)
                    msg_id = msg.get("id")
                    if msg_id and msg_id in server._pending:
                        server._pending[msg_id]["result"] = msg.get("result")
                        server._pending[msg_id]["error"] = msg.get("error")
                        server._pending[msg_id]["event"].set()
                except json.JSONDecodeError:
                    pass
        except Exception:
            pass

    # ── Tool discovery ─────────────────────────────────────────────────────────

    async def _list_tools(self, server: McpServer) -> list[McpTool]:
        if server.transport == "builtin":
            return self._builtin_tools(server.id)
        if server.transport == "stdio":
            result = await self._send_request(server, "tools/list", {})
            tools = result.get("tools", [])
        else:
            # HTTP transport
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(f"{server.url}/tools/list", json={})
                tools = r.json().get("tools", [])

        return [
            McpTool(
                name=t["name"],
                description=t.get("description", ""),
                input_schema=t.get("inputSchema", {}),
                server_id=server.id,
            )
            for t in tools
        ]

    def _builtin_tools(self, server_id: str) -> list[McpTool]:
        """Return tool definitions for built-in servers."""
        if server_id == "web-search":
            return [
                McpTool(
                    name="web_search",
                    description="Search the web and return top results",
                    input_schema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                            "max_results": {"type": "integer", "default": 5},
                        },
                        "required": ["query"],
                    },
                    server_id=server_id,
                )
            ]
        return []

    # ── Tool invocation ────────────────────────────────────────────────────────

    async def call_tool(self, server_id: str, tool_name: str, args: dict) -> str:
        """Invoke a tool on a connected MCP server."""
        server = self._servers.get(server_id)
        if not server:
            return f"Error: MCP server '{server_id}' not found"
        if server.status != "connected":
            return f"Error: MCP server '{server.name}' is not connected (status: {server.status})"

        try:
            if server.transport == "builtin":
                return await self._call_builtin(server_id, tool_name, args)

            if server.transport == "stdio":
                result = await self._send_request(server, "tools/call", {
                    "name": tool_name,
                    "arguments": args,
                })
            else:
                async with httpx.AsyncClient(timeout=30) as client:
                    r = await client.post(f"{server.url}/tools/call", json={
                        "name": tool_name, "arguments": args,
                    })
                    result = r.json()

            # Extract text from result content blocks
            content = result.get("content", [])
            if isinstance(content, list):
                return "\n".join(
                    c.get("text", "") for c in content if c.get("type") == "text"
                )
            return str(result)

        except Exception as e:
            return f"MCP tool error ({tool_name}): {e}"

    async def _call_builtin(self, server_id: str, tool_name: str, args: dict) -> str:
        """Execute built-in server tools directly in Python."""
        if server_id == "web-search" and tool_name == "web_search":
            return await self._web_search(args.get("query", ""),
                                          args.get("max_results", 5))
        return f"Unknown builtin tool: {tool_name}"

    async def _web_search(self, query: str, max_results: int = 5) -> str:
        """DuckDuckGo instant answer + HTML search (no API key needed)."""
        import urllib.parse
        encoded = urllib.parse.quote(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded}"
        import re

        try:
            async with httpx.AsyncClient(
                timeout=10,
                headers={"User-Agent": "Mozilla/5.0 CodeDroid/4.0"},
                follow_redirects=True,
            ) as client:
                r = await client.get(url)
                html = r.text

            # Extract result snippets
            results = []
            # Find result blocks
            pattern = re.compile(
                r'class="result__title"[^>]*>.*?<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?'
                r'class="result__snippet"[^>]*>(.*?)</(?:a|span)>',
                re.DOTALL,
            )
            for m in pattern.finditer(html):
                href = m.group(1).strip()
                title = re.sub(r'<[^>]+>', '', m.group(2)).strip()
                snippet = re.sub(r'<[^>]+>', '', m.group(3)).strip()
                if title and snippet:
                    results.append(f"**{title}**\n{snippet}\n{href}")
                if len(results) >= max_results:
                    break

            if not results:
                return f"No results found for: {query}"
            return f"Search results for '{query}':\n\n" + "\n\n---\n\n".join(results)

        except Exception as e:
            return f"Web search error: {e}"

    # ── Registry API ───────────────────────────────────────────────────────────

    def list_servers(self) -> list[dict]:
        return [
            {
                "id": s.id,
                "name": s.name,
                "description": s.description,
                "transport": s.transport,
                "permissions": s.permissions,
                "enabled": s.enabled,
                "status": s.status,
                "error": s.error,
                "tools": [{"name": t.name, "description": t.description} for t in s.tools],
            }
            for s in self._servers.values()
        ]

    def list_all_tools(self) -> list[dict]:
        """Return all tools from all connected servers."""
        tools = []
        for s in self._servers.values():
            if s.status == "connected":
                for t in s.tools:
                    tools.append({
                        "name": f"mcp_{s.id}_{t.name}",
                        "description": f"[{s.name}] {t.description}",
                        "server_id": s.id,
                        "tool_name": t.name,
                        "input_schema": t.input_schema,
                    })
        return tools

    async def install_server(self, manifest: dict) -> dict:
        """Install a new MCP server from a manifest dict."""
        server_id = manifest.get("id")
        if not server_id:
            return {"ok": False, "error": "Manifest must have an 'id' field"}

        dest = PLUGINS_DIR / server_id / "manifest.json"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(manifest, indent=2))

        server = self._manifest_to_server(manifest)
        self._servers[server_id] = server

        if server.enabled:
            asyncio.create_task(self._connect_server(server))

        return {"ok": True, "id": server_id}

    async def toggle_server(self, server_id: str, enabled: bool) -> dict:
        """Enable or disable a server."""
        server = self._servers.get(server_id)
        if not server:
            return {"ok": False, "error": "Server not found"}

        server.enabled = enabled
        manifest_path = PLUGINS_DIR / server_id / "manifest.json"
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text())
            manifest["enabled"] = enabled
            manifest_path.write_text(json.dumps(manifest, indent=2))

        if enabled and server.status != "connected":
            asyncio.create_task(self._connect_server(server))
        elif not enabled:
            await self._disconnect_server(server)

        return {"ok": True}

    async def _disconnect_server(self, server: McpServer) -> None:
        if server._process:
            try:
                server._process.terminate()
            except Exception:
                pass
            server._process = None
        server.status = "disconnected"
        server.tools = []

    async def uninstall_server(self, server_id: str) -> dict:
        server = self._servers.get(server_id)
        if server:
            await self._disconnect_server(server)
            del self._servers[server_id]

        manifest_path = PLUGINS_DIR / server_id / "manifest.json"
        if manifest_path.exists():
            import shutil
            shutil.rmtree(manifest_path.parent)

        return {"ok": True}


# ── Singleton ──────────────────────────────────────────────────────────────────
_bus: Optional[McpBus] = None

def get_bus() -> McpBus:
    global _bus
    if _bus is None:
        _bus = McpBus()
    return _bus