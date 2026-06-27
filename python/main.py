"""
CodeDroid Python Sidecar
AI backend + agentic tool execution engine
FastAPI + WebSocket streaming
"""

import asyncio
import json
import os
import subprocess
import sys
import argparse
from pathlib import Path
from typing import Any, AsyncGenerator

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Local error detection module
try:
    from error_detector import detect_error, is_error_paste
except ImportError:
    def detect_error(output: str) -> dict:
        return {"has_error": False, "error_type": None, "error_message": None,
                "file_path": None, "line_number": None, "column": None, "stack_trace": None}
    def is_error_paste(text: str) -> bool:
        return False

try:
    from thinking_detector import (
        should_use_thinking, is_native_thinking_model,
        extract_think_tags, inject_cot_into_system,
        was_response_truncated, has_incomplete_code_block, merge_continuations,
    )
except ImportError:
    def should_use_thinking(p, m): return False
    def is_native_thinking_model(m): return False
    def extract_think_tags(r): return "", r
    def inject_cot_into_system(s): return s
    def was_response_truncated(r, p): return False
    def has_incomplete_code_block(t): return False
    def merge_continuations(a, b): return a + "\n" + b

try:
    from browser_agent import get_browser_agent, reset_browser_agent, PLAYWRIGHT_AVAILABLE
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    def get_browser_agent(): raise RuntimeError("browser_agent module not available")
    async def reset_browser_agent(): raise RuntimeError("browser_agent module not available")

# ─── Phase 1: Agent core modules ──────────────────────────────────────────────
from agent_core import run_agent
from tools import execute_tool as tool_execute, set_workspace as tools_set_workspace, resolve_confirmation, TOOLS
from context_manager import sanitize_user_input
from memory import init_db, search_messages

# ─── Phase 2: MCP Plugin Bus ──────────────────────────────────────────────────
from mcp_bus import get_bus

# Initialise SQLite memory DB on startup
init_db()

app = FastAPI(title="CodeDroid AI Sidecar", version="4.0.0")

@app.on_event("startup")
async def startup_event():
    """Initialize the MCP plugin bus on sidecar startup."""
    try:
        bus = get_bus()
        await bus.initialize()
        print("[MCP] Plugin bus initialized")
    except Exception as e:
        print(f"[MCP] Bus init warning: {e}")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Agent auto-fix constants ──────────────────────────────────────────────────
MAX_FIX_ATTEMPTS = 3

# ─── Groq per-model token limits ─────────────────────────────────────────────
GROQ_MAX_TOKENS = {
    # Output token limits tuned for Groq free tier (8000 TPM total = input + output).
    # We cap output at 2000 so input messages have ~6000 tokens of headroom.
    # Users on paid Dev tier (100k+ TPM) can raise these manually.
    "openai/gpt-oss-120b":               2000,
    "openai/gpt-oss-20b":                2000,
    "llama-3.3-70b-versatile":           2000,
    "llama-3.1-70b-versatile":           2000,
    "llama-3.1-8b-instant":              2000,
    "llama3-70b-8192":                   2000,
    "llama3-8b-8192":                    2000,
    "llama3-groq-70b-8192-tool-use-preview": 2000,
    "llama3-groq-8b-8192-tool-use-preview":  2000,
    "mixtral-8x7b-32768":                2000,
    "gemma2-9b-it":                      2000,
    "gemma-7b-it":                       2000,
    "default":                           1500,
}

# ─── Models ──────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    messages: list[dict]
    provider: str = "groq"
    api_key: str = ""
    model: str = ""
    host: str = "http://localhost:11434"
    system: str = ""
    mode: str = "ask"
    skills: list[str] = []
    thinking: bool = False      # manually force thinking mode

class ToolRequest(BaseModel):
    tool: str
    args: dict
    cwd: str = ""

class FormatRequest(BaseModel):
    code: str
    language: str

class LintRequest(BaseModel):
    code: str
    language: str

# ─── AI Tools ─────────────────────────────────────────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path to read"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write content to a file",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "content": {"type": "string"}
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Execute a shell command",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string"},
                    "cwd": {"type": "string", "default": ""}
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List files in a directory",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "pip_install",
            "description": "Install a Python package with pip",
            "parameters": {
                "type": "object",
                "properties": {
                    "package": {"type": "string"}
                },
                "required": ["package"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "git_command",
            "description": "Run a git command",
            "parameters": {
                "type": "object",
                "properties": {
                    "args": {"type": "array", "items": {"type": "string"}},
                    "cwd": {"type": "string"}
                },
                "required": ["args", "cwd"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_file",
            "description": "Create a new file (or overwrite)",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "content": {"type": "string", "default": ""}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_file",
            "description": "Delete a file or directory",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "make_dir",
            "description": "Create a directory",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_python",
            "description": "Execute a Python script or snippet",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string"},
                    "cwd": {"type": "string", "default": ""}
                },
                "required": ["code"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_fetch",
            "description": "Fetch content from a URL",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string"}
                },
                "required": ["url"]
            }
        }
    },
]

# ─── Agent terminal streaming with hanging detection ──────────────────────────
async def run_command_streaming(command: str, workspace: str, ws=None) -> dict:
    """
    Run a command, streaming stdout/stderr line-by-line to the websocket in
    real time, and warn if the process produces no output for 30+ seconds.
    """
    cwd = workspace or _workspace_root or None
    proc = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=cwd,
    )

    stdout_lines: list[str] = []
    stderr_lines: list[str] = []
    last_output_time = asyncio.get_event_loop().time()
    warning_sent = False
    done = asyncio.Event()

    async def check_hanging():
        nonlocal warning_sent
        while not done.is_set():
            await asyncio.sleep(5)
            if done.is_set():
                break
            elapsed = asyncio.get_event_loop().time() - last_output_time
            if elapsed > 30 and not warning_sent and ws is not None:
                try:
                    await ws.send_text(json.dumps({
                        "type": "agent_warning",
                        "message": "⚠️ Process has produced no output for 30 seconds — it may be hanging or waiting for input"
                    }))
                except Exception:
                    pass
                warning_sent = True

    async def stream_stdout():
        nonlocal last_output_time
        if proc.stdout is None:
            return
        async for line in proc.stdout:
            decoded = line.decode(errors="replace")
            stdout_lines.append(decoded)
            last_output_time = asyncio.get_event_loop().time()
            if ws is not None:
                try:
                    await ws.send_text(json.dumps({
                        "type": "terminal_output", "stream": "stdout", "line": decoded
                    }))
                except Exception:
                    pass

    async def stream_stderr():
        nonlocal last_output_time
        if proc.stderr is None:
            return
        async for line in proc.stderr:
            decoded = line.decode(errors="replace")
            stderr_lines.append(decoded)
            last_output_time = asyncio.get_event_loop().time()
            if ws is not None:
                try:
                    await ws.send_text(json.dumps({
                        "type": "terminal_output", "stream": "stderr", "line": decoded, "is_error": True
                    }))
                except Exception:
                    pass

    hang_task = asyncio.create_task(check_hanging())
    try:
        await asyncio.gather(stream_stdout(), stream_stderr())
        await proc.wait()
    finally:
        done.set()
        hang_task.cancel()
        try:
            await hang_task
        except asyncio.CancelledError:
            pass

    full_stdout = "".join(stdout_lines)
    full_stderr = "".join(stderr_lines)
    had_error = (proc.returncode != 0) or bool(full_stderr.strip())

    return {
        "stdout": full_stdout[:3000],
        "stderr": full_stderr[:3000],
        "exit_code": proc.returncode,
        "had_error": had_error,
        "output": (full_stdout + full_stderr)[:4000],
    }


# ─── Tool executor ─────────────────────────────────────────────────────────────
async def execute_tool(tool_name: str, args: dict, ws=None) -> str:
    try:
        if tool_name == "read_file":
            p = Path(_resolve_path(args["path"]))
            return p.read_text(encoding="utf-8") if p.exists() else f"Error: File not found: {args['path']}"

        elif tool_name == "write_file" or tool_name == "create_file":
            p = Path(_resolve_path(args["path"]))
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(args.get("content", ""), encoding="utf-8")
            return f"Written: {p}"

        elif tool_name == "delete_file":
            import shutil
            p = Path(_resolve_path(args["path"]))
            if p.is_dir(): shutil.rmtree(p)
            elif p.exists(): p.unlink()
            return f"Deleted: {p}"

        elif tool_name == "make_dir":
            p = Path(_resolve_path(args["path"]))
            p.mkdir(parents=True, exist_ok=True)
            return f"Created directory: {p}"

        elif tool_name == "list_files":
            p = Path(_resolve_path(args["path"]))
            if not p.exists(): return f"Error: Directory not found: {args['path']}"
            entries = []
            for e in sorted(p.iterdir()):
                entries.append(f"{'[DIR]' if e.is_dir() else '[FILE]'} {e.name}")
            return "\n".join(entries) or "(empty)"

        elif tool_name == "run_command":
            cwd = _resolve_path(args.get("cwd", "")) or _workspace_root or None
            # Use streaming + hanging-detection version when a websocket is available
            # (i.e. when called from the agent loop, not the one-shot /tool REST endpoint)
            if ws is not None:
                result = await run_command_streaming(args["command"], cwd or "", ws)
                return json.dumps(result)

            proc = await asyncio.create_subprocess_shell(
                args["command"],
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd,
            )
            try:
                stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=60)
            except asyncio.TimeoutError:
                proc.kill()
                return json.dumps({"stdout": "", "stderr": "Command timed out after 60s", "exit_code": -1, "had_error": True})
            stdout = stdout_b.decode(errors="replace")
            stderr = stderr_b.decode(errors="replace")
            combined = (stdout + stderr)[:4000]
            had_error = (proc.returncode != 0) or bool(stderr.strip())
            return json.dumps({
                "stdout": stdout[:2000],
                "stderr": stderr[:2000],
                "exit_code": proc.returncode,
                "had_error": had_error,
                "output": combined,
            })

        elif tool_name == "run_python":
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False, encoding="utf-8") as f:
                f.write(args["code"])
                tmp = f.name
            try:
                cwd = _resolve_path(args.get("cwd", "")) or _workspace_root or None
                result = subprocess.run(
                    [sys.executable, tmp], capture_output=True, text=True,
                    cwd=cwd, timeout=30
                )
                return (result.stdout + result.stderr)[:4000] or "(no output)"
            finally:
                os.unlink(tmp)

        elif tool_name == "pip_install":
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", args["package"]],
                capture_output=True, text=True, timeout=60
            )
            return (result.stdout + result.stderr)[:2000]

        elif tool_name == "git_command":
            cwd = _resolve_path(args.get("cwd", "")) or _workspace_root or None
            result = subprocess.run(
                ["git"] + args["args"], capture_output=True, text=True,
                cwd=cwd, timeout=30
            )
            return (result.stdout + result.stderr)[:2000]

        elif tool_name == "web_fetch":
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(args["url"], follow_redirects=True)
                return r.text[:5000]

        return f"Unknown tool: {tool_name}"

    except Exception as e:
        return f"Tool error ({tool_name}): {str(e)}"


# ─── REST endpoints ────────────────────────────────────────────────────────────

# Global workspace root — updated by /set-workspace when user opens a folder
_workspace_root: str = ""

@app.post("/detect-error")
async def detect_error_endpoint(body: dict):
    """Detect errors in text and return structured info. Used by AiPanel paste detection."""
    text = body.get("text", "")
    return {
        "is_error_paste": is_error_paste(text),
        "error": detect_error(text),
    }


@app.get("/health")
async def health():
    return {"status": "ok", "version": "4.0.0", "phase": "phase1"}


@app.post("/set-workspace")
async def set_workspace(body: dict):
    global _workspace_root
    _workspace_root = body.get("path", "")
    tools_set_workspace(_workspace_root)   # keep tools.py in sync
    return {"ok": True, "workspace": _workspace_root}


def _resolve_path(p: str) -> str:
    """Resolve a path against the workspace root if it is relative."""
    if not p:
        return p
    path = Path(p)
    if path.is_absolute():
        return str(path)
    if _workspace_root:
        return str(Path(_workspace_root) / path)
    return str(path.resolve())


@app.get("/models/ollama")
async def get_ollama_models(host: str = "http://localhost:11434"):
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{host}/api/tags")
            data = r.json()
            models = [m["name"] for m in data.get("models", [])]
            return {"ok": True, "models": models}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/tool")
async def run_tool(req: ToolRequest):
    result = await execute_tool(req.tool, req.args)
    return {"result": result}


@app.post("/format")
async def format_code(req: FormatRequest):
    try:
        if req.language == "python":
            import tempfile, black
            formatted = black.format_str(req.code, mode=black.Mode())
            return {"ok": True, "code": formatted}
        return {"ok": False, "error": "Formatter not available for this language"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/lint")
async def lint_code(req: LintRequest):
    try:
        if req.language == "python":
            import ast, pyflakes.api, pyflakes.checker
            import io, contextlib
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                pyflakes.api.check(req.code, "<stdin>")
            return {"ok": True, "output": out.getvalue()}
        return {"ok": True, "output": ""}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ─── Skill Resolver ──────────────────────────────────────────────────────────
SKILLS_WORKSPACE = r"C:\Users\CHAND COMPUTER\Desktop\WOrkSpace\SkillsForAi"

def get_skill_content(skill_id: str) -> str:
    # Try local first, then workspace
    search_paths = [
        Path(__file__).parent / "skills" / f"{skill_id}.json",
        Path(SKILLS_WORKSPACE) / "agents" / "skills" / skill_id / "SKILL.md",
        Path(SKILLS_WORKSPACE) / "claude" / "skills" / skill_id / "SKILL.md",
    ]

    for p in search_paths:
        if p.exists():
            if p.suffix == ".json":
                data = json.loads(p.read_text(encoding="utf-8"))
                return data.get("systemPromptBlock", "")
            else:
                return f"\n--- SKILL: {skill_id} ---\n{p.read_text(encoding='utf-8')}\n"
    return ""

@app.get("/skills/list")
async def list_skills():
    skills = []
    base = Path(SKILLS_WORKSPACE) / "agents" / "skills"
    if base.exists():
        for d in base.iterdir():
            if d.is_dir() and (d / "SKILL.md").exists():
                skills.append({"id": d.name, "path": str(d / "SKILL.md")})
    return {"skills": skills}

@app.post("/enhance")
async def enhance_prompt(req: ChatRequest):
    system_instruction = (
        "You are an expert prompt engineer. Rewrite the user's rough prompt to be "
        "clear, detailed, and optimized for AI while preserving the original intent. "
        "Return ONLY the enhanced prompt text."
    )

    prompt = req.messages[0]["content"] if req.messages else ""

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            if req.provider == "groq":
                enh_model = req.model or "llama3-70b-8192"
                r = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {req.api_key}"},
                    json={
                        "model": enh_model,
                        "max_tokens": GROQ_MAX_TOKENS.get(enh_model, GROQ_MAX_TOKENS["default"]),
                        "messages": [{"role": "system", "content": system_instruction}, {"role": "user", "content": prompt}],
                    }
                )
                return {"enhanced": r.json()["choices"][0]["message"]["content"]}

            elif req.provider == "ollama":
                r = await client.post(
                    f"{req.host}/api/chat",
                    json={
                        "model": req.model or "llama3",
                        "stream": False,
                        "messages": [{"role": "system", "content": system_instruction}, {"role": "user", "content": prompt}]
                    }
                )
                return {"enhanced": r.json()["message"]["content"]}

            elif req.provider == "gemini":
                r = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{req.model or 'gemini-1.5-pro'}:generateContent?key={req.api_key}",
                    json={"contents": [{"parts": [{"text": f"{system_instruction}\n\nPrompt to enhance: {prompt}"}]}]}
                )
                return {"enhanced": r.json()["candidates"][0]["content"]["parts"][0]["text"]}

            elif req.provider == "claude":
                r = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": req.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                    json={
                        "model": req.model or "claude-3-5-sonnet-20240620",
                        "max_tokens": 1024,
                        "system": system_instruction,
                        "messages": [{"role": "user", "content": prompt}]
                    }
                )
                return {"enhanced": r.json()["content"][0]["text"]}

            return {"enhanced": prompt}
    except Exception as e:
        print(f"Enhance Error: {e}")
        return {"enhanced": prompt, "error": str(e)}

# ─── WebSocket streaming AI ───────────────────────────────────────────────────
# ─── MCP Plugin REST endpoints ───────────────────────────────────────────────

@app.get("/mcp/servers")
async def mcp_list_servers():
    """List all registered MCP servers and their status."""
    return {"ok": True, "servers": get_bus().list_servers()}

@app.get("/mcp/tools")
async def mcp_list_tools():
    """List all available tools from all connected MCP servers."""
    return {"ok": True, "tools": get_bus().list_all_tools()}

@app.post("/mcp/install")
async def mcp_install_server(body: dict):
    """Install a new MCP server from a manifest."""
    result = await get_bus().install_server(body)
    return result

@app.post("/mcp/toggle")
async def mcp_toggle_server(body: dict):
    """Enable or disable an MCP server."""
    result = await get_bus().toggle_server(body.get("id", ""), body.get("enabled", True))
    return result

@app.delete("/mcp/uninstall/{server_id}")
async def mcp_uninstall_server(server_id: str):
    """Uninstall an MCP server."""
    result = await get_bus().uninstall_server(server_id)
    return result

@app.post("/mcp/call")
async def mcp_call_tool(body: dict):
    """Directly call an MCP tool (used by UI for testing)."""
    result = await get_bus().call_tool(
        body.get("server_id", ""),
        body.get("tool_name", ""),
        body.get("args", {}),
    )
    return {"ok": True, "result": result}

@app.get("/memory/search")
async def memory_search(q: str = ""):
    """Full-text search across chat history stored in SQLite."""
    if not q or len(q) < 2:
        return {"ok": True, "results": []}
    results = search_messages(q, limit=20)
    return {"ok": True, "results": results}


@app.get("/memory/sessions")
async def memory_sessions(project: str = ""):
    """Get recent agent sessions for a project."""
    from memory import get_recent_sessions
    sessions = get_recent_sessions(project, limit=10)
    return {"ok": True, "sessions": sessions}


@app.websocket("/ws/chat")
async def websocket_chat(ws: WebSocket):
    """
    WebSocket chat endpoint — thin wrapper around agent_core.run_agent().
    Handles: connection lifecycle, tool confirmation responses, message parsing.
    """
    await ws.accept()
    try:
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)

            # ── Tool confirmation response from UI ─────────────────────────
            if msg.get("type") == "tool_confirm_response":
                resolve_confirmation(msg["id"], msg.get("approved", False))
                continue

            req = ChatRequest(**msg)

            # Skill injection
            skill_blocks = []
            for skill_id in req.skills:
                c = get_skill_content(skill_id)
                if c:
                    skill_blocks.append(c)
            skill_context = "\n".join(skill_blocks)

            base_system = req.system or (
                "You are CodeDroid AI Copilot, an expert coding assistant. "
                "Be concise, technical, and precise. Format code in markdown."
            )
            if skill_context:
                base_system = f"{base_system}\n\nUSE THESE SKILLS:\n{skill_context}"

            await run_agent(
                ws=ws,
                provider=req.provider,
                api_key=req.api_key,
                model=req.model,
                messages=req.messages,
                system=base_system,
                mode=req.mode,
                thinking=req.thinking,
                skills=req.skills,
                workspace=_workspace_root,
                ollama_host=req.host,
            )

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_text(json.dumps({"type": "error", "message": str(e)}))
        except Exception:
            pass


@app.websocket("/ws/agent-fix")
async def websocket_agent_fix(ws: WebSocket):
    """
    Autonomous error-detect → auto-fix → re-run WebSocket.

    Client sends AgentFixRequest JSON.
    Server emits a stream of typed events:
      { type: "step",    text: str }          — live step card update
      { type: "token",   text: str }          — streaming report tokens
      { type: "error_detected", error: dict } — structured error info
      { type: "fix_applied", attempt: int, file: str } — fix written to disk
      { type: "success", attempts: int, output: str }  — all done
      { type: "failed",  attempts: int, report: str }  — gave up after MAX
      { type: "done" }                        — stream finished
    """
    await ws.accept()
    try:
        raw = await ws.receive_text()
        req = AgentFixRequest(**json.loads(raw))
        workspace = req.workspace or _workspace_root or ""

        async def emit(type_: str, **kwargs):
            await ws.send_text(json.dumps({"type": type_, **kwargs}))

        # ── Step 1: Run the command (or use pre-pasted error) ─────────────────
        if req.error_text:
            run_result = {
                "stdout": "", "stderr": req.error_text,
                "exit_code": 1, "had_error": True, "output": req.error_text,
            }
            await emit("step", text=f"⚡ Analyzing pasted error...")
        else:
            await emit("step", text=f"⚡ run_command → `{req.command}`")
            run_result = await _run_command_capture(req.command, workspace)
            exit_icon = "✅" if not run_result["had_error"] else "❌"
            await emit("step", text=f"   ↳ {exit_icon} Exit code {run_result['exit_code']}")

        # ── Step 2: Detect error ───────────────────────────────────────────────
        if not run_result["had_error"]:
            await emit("success", attempts=0, output=run_result["output"])
            await emit("done")
            return

        error = detect_error(run_result["output"])
        if not error["has_error"]:
            # Exit code was non-zero but no recognized error pattern
            await emit("step", text=f"   ↳ ⚠️ Non-zero exit but no parseable error. Output:\n{run_result['output'][:500]}")
            await emit("failed", attempts=0, report=run_result["output"])
            await emit("done")
            return

        await emit("error_detected", error=error)
        await emit("step", text=f"🔍 {error['error_type']} detected — {error['error_message'] or ''}")
        if error.get("line_number"):
            await emit("step", text=f"   ↳ {error.get('file_path', 'unknown file')} line {error['line_number']}")

        # ── Determine which file to fix ────────────────────────────────────────
        file_path = req.file_path or error.get("file_path") or ""
        if file_path and not Path(file_path).is_absolute() and workspace:
            file_path = str(Path(workspace) / file_path)

        if not file_path or not Path(file_path).exists():
            await emit("step", text=f"⚠️ Cannot locate source file to fix. Stopping.")
            await emit("failed", attempts=0, report=run_result["output"])
            await emit("done")
            return

        # ── Auto-fix loop ──────────────────────────────────────────────────────
        current_error = error
        for attempt in range(1, MAX_FIX_ATTEMPTS + 1):
            await emit("step", text=f"📖 read_file → {Path(file_path).name}")
            file_content = Path(file_path).read_text(encoding="utf-8", errors="replace")
            await emit("step", text=f"   ↳ {len(file_content.splitlines())} lines read")

            await emit("step", text=f"🔧 Applying fix attempt {attempt}/{MAX_FIX_ATTEMPTS}...")
            try:
                fixed_content = await _get_ai_fix(
                    api_key=req.api_key, provider=req.provider,
                    model=req.model, host=req.host,
                    file_path=file_path, file_content=file_content,
                    error=current_error, command=req.command,
                )
                # Strip any accidental markdown fences
                if fixed_content.strip().startswith("```"):
                    lines = fixed_content.strip().splitlines()
                    fixed_content = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
            except Exception as e:
                await emit("step", text=f"   ↳ ❌ AI fix request failed: {e}")
                break

            Path(file_path).write_text(fixed_content, encoding="utf-8")
            await emit("fix_applied", attempt=attempt, file=file_path)
            # Rough diff summary
            old_lines = len(file_content.splitlines())
            new_lines = len(fixed_content.splitlines())
            await emit("step", text=f"   ↳ {old_lines}→{new_lines} lines written")

            # ── Re-run ────────────────────────────────────────────────────────
            await emit("step", text=f"⚡ run_command → {req.command}  [retry {attempt}]")
            run_result = await _run_command_capture(req.command, workspace)
            if not run_result["had_error"]:
                await emit("step", text=f"   ↳ ✅ Exit code 0 — fixed!")

                # ── Post-fix report ───────────────────────────────────────────
                report = (
                    f"✅ Fixed successfully after {attempt} attempt{'s' if attempt > 1 else ''}\n\n"
                    f"### 🔍 What Was Wrong\n"
                    f"{current_error['error_type']} on line {current_error.get('line_number', '?')} "
                    f"of `{Path(file_path).name}` — {current_error['error_message'] or ''}\n\n"
                    f"### 🔧 What I Fixed\n"
                    f"Rewrote the broken section of `{Path(file_path).name}` to resolve the {current_error['error_type']}.\n\n"
                    f"### 📁 Files Changed\n"
                    f"- `{file_path}`\n\n"
                    f"### ▶ Re-run Result\n"
                    f"```\n$ {req.command}\n{run_result['output'][:500]}\n✅ Exit code 0 — no errors\n```"
                )
                # Stream report as tokens
                for chunk in [report[i:i+80] for i in range(0, len(report), 80)]:
                    await emit("token", text=chunk)

                await emit("success", attempts=attempt, output=run_result["output"])
                await emit("done")
                return

            # Still broken — re-detect error for next attempt
            current_error = detect_error(run_result["output"])
            if not current_error["has_error"]:
                current_error = {"error_type": "unknown", "error_message": run_result["output"][:200],
                                 "line_number": None, "file_path": file_path}
            await emit("step", text=f"   ↳ ❌ Still failing — {current_error.get('error_message', '')[:80]}")

        # ── All attempts exhausted ─────────────────────────────────────────────
        debug_report = (
            f"❌ Could not fix after {MAX_FIX_ATTEMPTS} attempts.\n\n"
            f"**Error type:** {current_error.get('error_type')}\n"
            f"**File:** {file_path}\n"
            f"**Line:** {current_error.get('line_number', 'unknown')}\n\n"
            f"**Last output:**\n```\n{run_result['output'][:1000]}\n```\n\n"
            f"Please review the file manually."
        )
        for chunk in [debug_report[i:i+80] for i in range(0, len(debug_report), 80)]:
            await emit("token", text=chunk)

        await emit("failed", attempts=MAX_FIX_ATTEMPTS, report=run_result["output"])
        await emit("done")

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_text(json.dumps({"type": "error", "message": str(e)}))
            await ws.send_text(json.dumps({"type": "done"}))
        except Exception:
            pass


# ─── Live Preview + Edit Mode System ───────────────────────────────────────────

class StartPreviewRequest(BaseModel):
    url: str = ""                 # direct URL to open (static HTML file:// or already-running server)
    dev_command: str = ""         # e.g. "npm run dev" — if set, spawns a dev server first
    workspace: str = ""
    ready_url: str = ""           # URL to poll until the dev server is ready (used with dev_command)
    width: int = 1280
    height: int = 800


@app.get("/preview/check")
async def preview_check():
    """Check if Playwright is installed and ready."""
    return {
        "playwright_available": PLAYWRIGHT_AVAILABLE,
        "message": "OK" if PLAYWRIGHT_AVAILABLE else "Run: pip install playwright && playwright install chromium"
    }


@app.post("/preview/start")
async def preview_start(req: StartPreviewRequest):
    if not PLAYWRIGHT_AVAILABLE:
        return {"ok": False, "error": "Playwright is not installed. Run: pip install playwright && playwright install chromium"}

    agent = await reset_browser_agent()
    workspace = req.workspace or _workspace_root

    try:
        target_url = req.url
        if req.dev_command:
            ready = await agent.start_dev_server(req.dev_command, workspace, req.ready_url or req.url, timeout=30)
            if not ready:
                return {"ok": False, "error": "Dev server did not become ready within 30s"}
            target_url = req.ready_url or req.url

        if not target_url:
            return {"ok": False, "error": "No URL or dev command provided"}

        await agent.start(target_url, req.width, req.height)
        return {"ok": True, "url": target_url}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/preview/stop")
async def preview_stop():
    agent = get_browser_agent()
    await agent.stop()
    return {"ok": True}


@app.post("/preview/reload")
async def preview_reload():
    agent = get_browser_agent()
    try:
        await agent.reload()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/preview/navigate")
async def preview_navigate(body: dict):
    agent = get_browser_agent()
    try:
        await agent.navigate(body.get("url", ""))
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


class ElementEditRequest(BaseModel):
    element: dict                  # element_data from the click event
    prompt: str
    provider: str = "groq"
    api_key: str = ""
    model: str = ""
    host: str = "http://localhost:11434"


@app.websocket("/ws/preview")
async def websocket_preview(ws: WebSocket):
    """
    Single long-lived WebSocket per preview session. Handles:
      client → server: { type: "enable_edit_mode" }
                        { type: "disable_edit_mode" }
                        { type: "submit_edit", element, prompt, provider, api_key, model, host }
                        { type: "save_changes", file_path, provider, api_key, model, host }
                        { type: "discard_changes" }
                        { type: "discard_single", index }
      server → client: { type: "element_clicked", data }
                        { type: "edit_applying" }
                        { type: "element_edit_preview", change, element_data }
                        { type: "edit_error", message }
                        { type: "changes_saved", file_path }
                        { type: "changes_discarded" }
                        { type: "pending_changes", changes }
                        { type: "console", level, text }
                        { type: "preview_closed" }
    """
    await ws.accept()
    agent = get_browser_agent()

    loop = asyncio.get_event_loop()

    async def forward_element_clicked(data: dict):
        await ws.send_text(json.dumps({"type": "element_clicked", "data": data}))

    async def forward_console(level: str, text: str):
        await ws.send_text(json.dumps({"type": "console", "level": level, "text": text[:500]}))

    async def forward_closed():
        await ws.send_text(json.dumps({"type": "preview_closed"}))

    agent.on_element_clicked = forward_element_clicked
    agent.on_console = forward_console
    agent.on_closed = forward_closed

    async def forward_prompt_submitted(prompt: str, provider: str, model: str):
        """Relay the floating-input prompt submission to React so it can call submit_edit with API keys."""
        await ws.send_text(json.dumps({
            "type": "prompt_submitted",
            "prompt": prompt,
            "provider": provider,
            "model": model,
            "element": agent._last_clicked_element,
        }))

    agent.on_prompt_submitted = forward_prompt_submitted

    # Element data from the most recent click, keyed by selector, so submit_edit
    # (which may arrive from either the in-page floating input OR the chat panel)
    # always has the right context.
    pending_element: dict | None = None

    async def emit_pending_changes():
        await ws.send_text(json.dumps({
            "type": "pending_changes",
            "changes": agent.pending_changes,
        }))

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type == "enable_edit_mode":
                # Sync active provider/model from React so the floating popup pre-selects correctly
                agent.current_provider = msg.get("provider", agent.current_provider)
                agent.current_model = msg.get("model", agent.current_model)
                await agent.enable_edit_mode()
                await ws.send_text(json.dumps({"type": "edit_mode_enabled"}))

            elif msg_type == "disable_edit_mode":
                await agent.disable_edit_mode()
                await ws.send_text(json.dumps({"type": "edit_mode_disabled"}))

            elif msg_type == "element_context":
                # Frontend can push the last-clicked element explicitly
                # (e.g. when the user types in the chat panel instead of the
                # in-page floating input) so submit_edit has context.
                pending_element = msg.get("element")

            elif msg_type == "submit_edit":
                element = msg.get("element") or pending_element
                prompt = msg.get("prompt", "")
                if not element:
                    await ws.send_text(json.dumps({"type": "edit_error", "message": "No element selected"}))
                    continue

                await ws.send_text(json.dumps({"type": "edit_applying"}))

                system_prompt = (
                    "You are editing a live webpage element. Respond with ONLY a JSON object "
                    "describing the DOM change to make. No explanation, no markdown fences.\n\n"
                    f"Element being edited:\n"
                    f"- Tag: {element.get('tag')}\n"
                    f"- Current text: {element.get('text')}\n"
                    f"- Current HTML: {element.get('html')}\n"
                    f"- Selector: {element.get('selector')}\n\n"
                    f'User request: "{prompt}"\n\n'
                    "Respond with this exact JSON structure:\n"
                    "{\n"
                    '  "action": "set_text" | "set_html" | "set_attribute" | "remove" | "set_style",\n'
                    f'  "selector": "{element.get("selector")}",\n'
                    '  "value": "the new value to apply",\n'
                    '  "attribute_name": "only present if action is set_attribute"\n'
                    "}"
                )

                try:
                    ai_response = await _get_ai_completion(
                        system=system_prompt, prompt=prompt,
                        api_key=msg.get("api_key", ""), provider=msg.get("provider", "groq"),
                        model=msg.get("model", ""), host=msg.get("host", "http://localhost:11434"),
                        max_tokens=800,
                    )
                    clean = _strip_json_fences(ai_response)
                    change = json.loads(clean)
                    change.setdefault("selector", element.get("selector"))
                except Exception as e:
                    await ws.send_text(json.dumps({"type": "edit_error", "message": f"AI did not return valid change JSON: {e}"}))
                    continue

                try:
                    await agent.apply_dom_change(change)
                except Exception as e:
                    await ws.send_text(json.dumps({"type": "edit_error", "message": str(e)}))
                    continue

                await ws.send_text(json.dumps({
                    "type": "element_edit_preview",
                    "change": change,
                    "element_data": element,
                }))
                await emit_pending_changes()

            elif msg_type == "discard_single":
                idx = msg.get("index", -1)
                agent.remove_pending_change(idx)
                await agent.clear_editing_outline()
                await emit_pending_changes()

            elif msg_type == "discard_changes":
                await agent.reload()
                agent.clear_pending_changes()
                await ws.send_text(json.dumps({"type": "changes_discarded"}))
                await emit_pending_changes()

            elif msg_type == "save_changes":
                if not agent.pending_changes:
                    await ws.send_text(json.dumps({"type": "edit_error", "message": "No pending changes to save"}))
                    continue

                file_path = msg.get("file_path", "")
                if not file_path:
                    await ws.send_text(json.dumps({"type": "edit_error", "message": "No file path provided to save to"}))
                    continue

                resolved_path = _resolve_path(file_path)
                try:
                    current_html = Path(resolved_path).read_text(encoding="utf-8")
                except Exception as e:
                    await ws.send_text(json.dumps({"type": "edit_error", "message": f"Could not read {file_path}: {e}"}))
                    continue

                save_system_prompt = (
                    "You are applying visual-editor DOM changes back to an HTML source file. "
                    "Make minimal, surgical edits — only change what corresponds to the listed DOM "
                    "changes. Preserve all formatting, indentation, comments, and unrelated code "
                    "exactly as-is. Return ONLY the complete updated file content, nothing else — "
                    "no explanation, no markdown fences."
                )
                save_prompt = (
                    f"DOM changes made during visual editing:\n{json.dumps(agent.pending_changes, indent=2)}\n\n"
                    f"Current file content:\n{current_html}"
                )

                try:
                    updated_html = await _get_ai_completion(
                        system=save_system_prompt, prompt=save_prompt,
                        api_key=msg.get("api_key", ""), provider=msg.get("provider", "groq"),
                        model=msg.get("model", ""), host=msg.get("host", "http://localhost:11434"),
                        max_tokens=8000,
                    )
                    updated_html = _strip_json_fences(updated_html)
                except Exception as e:
                    await ws.send_text(json.dumps({"type": "edit_error", "message": f"AI failed to apply changes to file: {e}"}))
                    continue

                try:
                    Path(resolved_path).write_text(updated_html, encoding="utf-8")
                except Exception as e:
                    await ws.send_text(json.dumps({"type": "edit_error", "message": f"Could not write {file_path}: {e}"}))
                    continue

                # Flash green confirmation on the most recently edited selector(s)
                for change in agent.pending_changes:
                    await agent.flash_saved(change.get("selector", ""))

                agent.clear_pending_changes()

                await ws.send_text(json.dumps({
                    "type": "changes_saved",
                    "file_path": file_path,
                    "previous_content": current_html,
                    "new_content": updated_html,
                }))
                await emit_pending_changes()

    except WebSocketDisconnect:
        pass
    finally:
        agent.on_element_clicked = None
        agent.on_prompt_submitted = None
        agent.on_console = None
        agent.on_closed = None


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    import uvicorn
    print(f"[CodeDroid Sidecar] Starting on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")