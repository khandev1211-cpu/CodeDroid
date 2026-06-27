"""
tools.py — 18 agentic tools with confirmation gate for CodeDroid v4.

Tools that are destructive (delete, run_command, git push/force, pip install)
emit a `tool_confirm_required` WebSocket event and WAIT for the user to approve
before executing. Non-destructive tools (read, list, web_fetch) run immediately.

Confirmation flow:
  1. Agent calls a destructive tool
  2. tools.py sends  {"type": "tool_confirm_required", "id": "<uuid>", "tool": "...", "args": {...}, "risk": "..."}
  3. UI shows modal → user clicks Allow or Deny
  4. UI sends back  {"type": "tool_confirm_response", "id": "<uuid>", "approved": true/false}
  5. If approved → execute and return result
  6. If denied   → return "User denied tool execution" as tool result
"""

import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Optional

import httpx

from memory import log_file_action

# ── Workspace root (set by main.py on /set-workspace) ─────────────────────────
_workspace_root: str = ""

def set_workspace(path: str) -> None:
    global _workspace_root
    _workspace_root = path

def get_workspace() -> str:
    return _workspace_root

def _resolve(p: str) -> str:
    if not p:
        return p
    path = Path(p)
    if path.is_absolute():
        return str(path)
    if _workspace_root:
        return str(Path(_workspace_root) / path)
    return str(path.resolve())

def _is_safe_path(p: str) -> bool:
    """Block path traversal outside workspace."""
    if not _workspace_root:
        return True
    resolved = Path(_resolve(p)).resolve()
    workspace = Path(_workspace_root).resolve()
    return str(resolved).startswith(str(workspace))

# ── Destructive tool registry ──────────────────────────────────────────────────
# Maps tool name → (risk_level, human_readable_risk_description)
DESTRUCTIVE_TOOLS: dict[str, tuple[str, str]] = {
    "delete_file":    ("high",   "Permanently delete a file or directory"),
    "run_command":    ("medium", "Execute a shell command on your system"),
    "run_python":     ("medium", "Execute Python code on your system"),
    "pip_install":    ("medium", "Install a Python package system-wide"),
    "git_command":    ("medium", "Run a git command (push/force could affect remote)"),
    "run_tests":      ("low",    "Run test suite (may modify test artifacts)"),
    "create_branch":  ("low",    "Create a new git branch"),
    "commit_push":    ("high",   "Commit and push changes to remote repository"),
    "npm_command":    ("medium", "Run an npm command"),
}

# These tool names are always safe — no confirmation needed
SAFE_TOOLS = {
    "read_file", "list_files", "make_dir", "web_fetch",
    "read_url", "search_files", "get_file_tree",
    "git_status", "git_diff", "git_log",
    "lint_file", "run_tests_dry",
}

# ── Pending confirmations ──────────────────────────────────────────────────────
# Maps confirm_id → asyncio.Event + approved flag
_pending: dict[str, dict] = {}

async def request_confirmation(
    ws,
    tool_name: str,
    args: dict,
) -> bool:
    """
    Send a confirmation request to the UI and wait (up to 120s) for the user's response.
    Returns True if approved, False if denied or timed out.
    """
    confirm_id = str(uuid.uuid4())
    risk_level, risk_desc = DESTRUCTIVE_TOOLS.get(tool_name, ("medium", "Potentially destructive action"))

    event = asyncio.Event()
    _pending[confirm_id] = {"event": event, "approved": False}

    await ws.send_text(json.dumps({
        "type":    "tool_confirm_required",
        "id":      confirm_id,
        "tool":    tool_name,
        "args":    args,
        "risk":    risk_level,
        "message": risk_desc,
    }))

    try:
        await asyncio.wait_for(event.wait(), timeout=120.0)
        approved = _pending[confirm_id]["approved"]
    except asyncio.TimeoutError:
        approved = False
        await ws.send_text(json.dumps({
            "type":    "tool_confirm_timeout",
            "id":      confirm_id,
            "message": "Confirmation timed out after 120s — tool execution cancelled",
        }))
    finally:
        _pending.pop(confirm_id, None)

    return approved


def resolve_confirmation(confirm_id: str, approved: bool) -> bool:
    """Called by main.py when the UI sends a tool_confirm_response message."""
    if confirm_id in _pending:
        _pending[confirm_id]["approved"] = approved
        _pending[confirm_id]["event"].set()
        return True
    return False


# ── Tool definitions (for AI function-calling) ─────────────────────────────────
TOOLS = [
    # ── Read / explore ─────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the full contents of a file. Returns file content as text.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path (relative to workspace or absolute)"},
                    "max_chars": {"type": "integer", "description": "Max chars to return (default 8000)", "default": 8000}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List files and directories in a path. Shows names, types, and sizes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path"},
                    "recursive": {"type": "boolean", "description": "List recursively (default false)", "default": False}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_file_tree",
            "description": "Get a tree view of the project structure. Respects .gitignore.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Root directory (defaults to workspace)"},
                    "max_depth": {"type": "integer", "description": "Max depth (default 3)", "default": 3}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": "Search for text across all files in the workspace. Supports regex.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query or regex pattern"},
                    "path": {"type": "string", "description": "Directory to search (defaults to workspace)"},
                    "use_regex": {"type": "boolean", "default": False},
                    "case_sensitive": {"type": "boolean", "default": False},
                    "max_results": {"type": "integer", "default": 30}
                },
                "required": ["query"]
            }
        }
    },
    # ── Write / create ─────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write or overwrite a file with new content. Creates parent directories automatically.",
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
            "name": "create_file",
            "description": "Create a new file (fails if already exists, use write_file to overwrite).",
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
            "name": "make_dir",
            "description": "Create a directory (and all parent directories).",
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
            "name": "delete_file",
            "description": "⚠️ DESTRUCTIVE: Permanently delete a file or directory. Requires user confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "recursive": {"type": "boolean", "default": False, "description": "Delete directory recursively"}
                },
                "required": ["path"]
            }
        }
    },
    # ── Execution ──────────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "⚠️ DESTRUCTIVE: Execute a shell command. Requires user confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string"},
                    "cwd": {"type": "string", "default": ""},
                    "timeout": {"type": "integer", "default": 60}
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_python",
            "description": "⚠️ DESTRUCTIVE: Execute a Python script or code snippet. Requires user confirmation.",
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
            "name": "pip_install",
            "description": "⚠️ DESTRUCTIVE: Install a Python package. Requires user confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "package": {"type": "string"},
                    "upgrade": {"type": "boolean", "default": False}
                },
                "required": ["package"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "npm_command",
            "description": "⚠️ DESTRUCTIVE: Run an npm command (install, run, build, etc). Requires user confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "args": {"type": "array", "items": {"type": "string"}},
                    "cwd": {"type": "string", "default": ""}
                },
                "required": ["args"]
            }
        }
    },
    # ── Git (safe reads) ────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "git_status",
            "description": "Get the current git status (staged, unstaged, untracked files).",
            "parameters": {
                "type": "object",
                "properties": {
                    "cwd": {"type": "string", "default": ""}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "git_diff",
            "description": "Show git diff for changed files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "cwd": {"type": "string", "default": ""},
                    "file": {"type": "string", "description": "Specific file to diff (optional)"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "git_log",
            "description": "Show recent git commit history.",
            "parameters": {
                "type": "object",
                "properties": {
                    "cwd": {"type": "string", "default": ""},
                    "limit": {"type": "integer", "default": 10}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "git_command",
            "description": "⚠️ DESTRUCTIVE: Run any git command (use for add/commit/push/branch). Requires confirmation for push/force.",
            "parameters": {
                "type": "object",
                "properties": {
                    "args": {"type": "array", "items": {"type": "string"}},
                    "cwd": {"type": "string", "default": ""}
                },
                "required": ["args"]
            }
        }
    },
    # ── Testing ────────────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "run_tests",
            "description": "⚠️ DESTRUCTIVE: Run the project test suite (pytest/jest/vitest auto-detected). Requires confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "cwd": {"type": "string", "default": ""},
                    "filter": {"type": "string", "description": "Test name filter (optional)"},
                    "framework": {"type": "string", "description": "Force framework: pytest/jest/vitest (auto-detected if omitted)"}
                },
                "required": []
            }
        }
    },
    # ── Web ────────────────────────────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "web_fetch",
            "description": "Fetch a URL and return the readable text content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string"},
                    "max_chars": {"type": "integer", "default": 5000}
                },
                "required": ["url"]
            }
        }
    },
]


# ── Streaming command runner ───────────────────────────────────────────────────
async def run_command_streaming(command: str, cwd: Optional[str], ws, timeout: int = 60) -> dict:
    proc = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=cwd,
    )

    stdout_lines: list[str] = []
    stderr_lines: list[str] = []
    last_output = asyncio.get_event_loop().time()
    warning_sent = False
    done = asyncio.Event()

    async def check_hang():
        nonlocal warning_sent
        while not done.is_set():
            await asyncio.sleep(5)
            if done.is_set():
                break
            elapsed = asyncio.get_event_loop().time() - last_output
            if elapsed > 30 and not warning_sent and ws:
                try:
                    await ws.send_text(json.dumps({
                        "type": "agent_warning",
                        "message": "⚠️ Process has had no output for 30s — may be hanging or waiting for input",
                    }))
                except Exception:
                    pass
                warning_sent = True

    async def read_stdout():
        nonlocal last_output
        if not proc.stdout:
            return
        async for line in proc.stdout:
            decoded = line.decode(errors="replace")
            stdout_lines.append(decoded)
            last_output = asyncio.get_event_loop().time()
            if ws:
                try:
                    await ws.send_text(json.dumps({"type": "terminal_output", "stream": "stdout", "line": decoded}))
                except Exception:
                    pass

    async def read_stderr():
        nonlocal last_output
        if not proc.stderr:
            return
        async for line in proc.stderr:
            decoded = line.decode(errors="replace")
            stderr_lines.append(decoded)
            last_output = asyncio.get_event_loop().time()
            if ws:
                try:
                    await ws.send_text(json.dumps({"type": "terminal_output", "stream": "stderr", "line": decoded, "is_error": True}))
                except Exception:
                    pass

    hang_task = asyncio.create_task(check_hang())
    try:
        await asyncio.wait_for(
            asyncio.gather(read_stdout(), read_stderr()),
            timeout=timeout
        )
        await proc.wait()
    except asyncio.TimeoutError:
        proc.kill()
        return {"stdout": "", "stderr": f"Command timed out after {timeout}s", "exit_code": -1, "had_error": True, "output": f"Timed out after {timeout}s"}
    finally:
        done.set()
        hang_task.cancel()
        try:
            await hang_task
        except asyncio.CancelledError:
            pass

    full_stdout = "".join(stdout_lines)
    full_stderr = "".join(stderr_lines)
    return {
        "stdout":    full_stdout[:3000],
        "stderr":    full_stderr[:3000],
        "exit_code": proc.returncode,
        "had_error": proc.returncode != 0,
        "output":    (full_stdout + full_stderr)[:4000],
    }


# ── Tool executor ──────────────────────────────────────────────────────────────
async def execute_tool(
    tool_name: str,
    args: dict,
    ws=None,
    session_id: Optional[int] = None,
    skip_confirm: bool = False,
) -> str:
    """
    Execute a tool. For destructive tools, request user confirmation first
    (unless skip_confirm=True, used by the /tool REST endpoint).
    Logs file actions to SQLite memory.
    """
    try:
        # ── Confirmation gate ──────────────────────────────────────────────────
        needs_confirm = tool_name in DESTRUCTIVE_TOOLS and ws is not None and not skip_confirm

        # git_command: only needs confirm for dangerous subcommands
        if tool_name == "git_command":
            subcmd = (args.get("args") or [""])[0]
            dangerous_git = {"push", "force", "reset", "rebase", "clean", "rm"}
            needs_confirm = subcmd in dangerous_git and ws is not None and not skip_confirm

        if needs_confirm:
            approved = await request_confirmation(ws, tool_name, args)
            if not approved:
                return json.dumps({"ok": False, "error": "User denied tool execution", "output": "❌ Cancelled by user"})

        # ── Safe tools ─────────────────────────────────────────────────────────

        if tool_name == "read_file":
            p = Path(_resolve(args["path"]))
            if not _is_safe_path(args["path"]):
                return "Error: Path outside workspace"
            if not p.exists():
                return f"Error: File not found: {args['path']}"
            max_chars = args.get("max_chars", 8000)
            content = p.read_text(encoding="utf-8", errors="replace")
            if session_id:
                log_file_action(session_id, str(p), "read")
            if len(content) > max_chars:
                content = content[:max_chars] + f"\n...[truncated — {len(content) - max_chars} more chars]"
            return content

        elif tool_name == "list_files":
            p = Path(_resolve(args["path"]))
            if not p.exists():
                return f"Error: Not found: {args['path']}"
            recursive = args.get("recursive", False)
            entries = []
            if recursive:
                SKIP = {"node_modules", ".git", "dist", "__pycache__", "target", ".next"}
                for item in sorted(p.rglob("*")):
                    if any(s in item.parts for s in SKIP):
                        continue
                    rel = item.relative_to(p)
                    entries.append(f"{'[DIR] ' if item.is_dir() else '[FILE]'} {rel}")
                    if len(entries) >= 200:
                        entries.append("...(truncated at 200 entries)")
                        break
            else:
                for e in sorted(p.iterdir()):
                    size = f" ({e.stat().st_size:,} bytes)" if e.is_file() else ""
                    entries.append(f"{'[DIR] ' if e.is_dir() else '[FILE]'} {e.name}{size}")
            return "\n".join(entries) or "(empty directory)"

        elif tool_name == "get_file_tree":
            root = Path(_resolve(args.get("path", "") or _workspace_root or "."))
            max_depth = args.get("max_depth", 3)
            SKIP = {"node_modules", ".git", "dist", "__pycache__", "target", ".next", "release", ".cache"}
            lines = [str(root)]

            def walk(dir_path: Path, depth: int, prefix: str):
                if depth > max_depth:
                    return
                try:
                    items = sorted(dir_path.iterdir(), key=lambda x: (x.is_file(), x.name.lower()))
                except PermissionError:
                    return
                for i, item in enumerate(items):
                    if item.name in SKIP or item.name.startswith("."):
                        continue
                    connector = "└── " if i == len(items) - 1 else "├── "
                    lines.append(f"{prefix}{connector}{item.name}{'/' if item.is_dir() else ''}")
                    if item.is_dir():
                        extension = "    " if i == len(items) - 1 else "│   "
                        walk(item, depth + 1, prefix + extension)
                    if len(lines) > 300:
                        lines.append(f"{prefix}    ...(truncated)")
                        return

            walk(root, 1, "")
            return "\n".join(lines)

        elif tool_name == "search_files":
            search_root = Path(_resolve(args.get("path", "") or _workspace_root or "."))
            query = args["query"]
            use_regex = args.get("use_regex", False)
            case_sensitive = args.get("case_sensitive", False)
            max_results = args.get("max_results", 30)
            SKIP = {"node_modules", ".git", "dist", "__pycache__", "target"}
            SKIP_EXT = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2",
                        ".ttf", ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".pdf", ".lock"}
            results = []

            if use_regex:
                try:
                    flags = 0 if case_sensitive else re.IGNORECASE
                    pattern = re.compile(query, flags)
                except re.error as e:
                    return f"Invalid regex: {e}"
            else:
                pattern = None

            for fpath in search_root.rglob("*"):
                if len(results) >= max_results:
                    break
                if any(s in fpath.parts for s in SKIP):
                    continue
                if fpath.suffix.lower() in SKIP_EXT or not fpath.is_file():
                    continue
                try:
                    text = fpath.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    continue
                for i, line in enumerate(text.splitlines()):
                    hit = False
                    if pattern:
                        hit = bool(pattern.search(line))
                    else:
                        hit = (query in line) if case_sensitive else (query.lower() in line.lower())
                    if hit:
                        rel = fpath.relative_to(search_root)
                        results.append(f"{rel}:{i+1}: {line.strip()[:120]}")
                        if len(results) >= max_results:
                            break

            if not results:
                return f"No results found for '{query}'"
            return "\n".join(results)

        elif tool_name in ("write_file", "create_file"):
            p = Path(_resolve(args["path"]))
            if not _is_safe_path(args["path"]):
                return "Error: Path outside workspace"
            if tool_name == "create_file" and p.exists():
                return f"Error: File already exists: {args['path']} (use write_file to overwrite)"
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(args.get("content", ""), encoding="utf-8")
            if session_id:
                log_file_action(session_id, str(p), tool_name)
            return f"✓ {'Created' if tool_name == 'create_file' else 'Written'}: {p}"

        elif tool_name == "make_dir":
            p = Path(_resolve(args["path"]))
            if not _is_safe_path(args["path"]):
                return "Error: Path outside workspace"
            p.mkdir(parents=True, exist_ok=True)
            return f"✓ Directory created: {p}"

        elif tool_name == "delete_file":
            p = Path(_resolve(args["path"]))
            if not _is_safe_path(args["path"]):
                return "Error: Path outside workspace"
            if not p.exists():
                return f"Error: Not found: {args['path']}"
            if p.is_dir():
                shutil.rmtree(p)
            else:
                p.unlink()
            if session_id:
                log_file_action(session_id, str(p), "delete")
            return f"✓ Deleted: {p}"

        elif tool_name == "run_command":
            cwd = _resolve(args.get("cwd", "")) or _workspace_root or None
            timeout = args.get("timeout", 60)
            if ws:
                result = await run_command_streaming(args["command"], cwd, ws, timeout)
                return json.dumps(result)
            proc = await asyncio.create_subprocess_shell(
                args["command"],
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd,
            )
            try:
                stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            except asyncio.TimeoutError:
                proc.kill()
                return json.dumps({"stdout": "", "stderr": f"Timed out after {timeout}s", "exit_code": -1, "had_error": True})
            stdout = stdout_b.decode(errors="replace")
            stderr = stderr_b.decode(errors="replace")
            return json.dumps({
                "stdout":    stdout[:2000],
                "stderr":    stderr[:2000],
                "exit_code": proc.returncode,
                "had_error": proc.returncode != 0,
                "output":    (stdout + stderr)[:4000],
            })

        elif tool_name == "run_python":
            cwd = _resolve(args.get("cwd", "")) or _workspace_root or None
            with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False, encoding="utf-8") as f:
                f.write(args["code"])
                tmp = f.name
            try:
                result = subprocess.run(
                    [sys.executable, tmp],
                    capture_output=True, text=True, cwd=cwd, timeout=30
                )
                output = (result.stdout + result.stderr)[:4000] or "(no output)"
                return output
            finally:
                os.unlink(tmp)

        elif tool_name == "pip_install":
            pkg = args["package"]
            upgrade = ["--upgrade"] if args.get("upgrade") else []
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", pkg] + upgrade,
                capture_output=True, text=True, timeout=120
            )
            return (result.stdout + result.stderr)[:2000]

        elif tool_name == "npm_command":
            cwd = _resolve(args.get("cwd", "")) or _workspace_root or None
            npm = "npm.cmd" if sys.platform == "win32" else "npm"
            result = subprocess.run(
                [npm] + args["args"],
                capture_output=True, text=True, cwd=cwd, timeout=120
            )
            return (result.stdout + result.stderr)[:3000]

        elif tool_name == "git_status":
            cwd = _resolve(args.get("cwd", "")) or _workspace_root or None
            result = subprocess.run(["git", "status", "--short"], capture_output=True, text=True, cwd=cwd, timeout=15)
            return (result.stdout + result.stderr)[:2000] or "Clean working tree"

        elif tool_name == "git_diff":
            cwd = _resolve(args.get("cwd", "")) or _workspace_root or None
            cmd = ["git", "diff"]
            if args.get("file"):
                cmd.append(args["file"])
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, timeout=15)
            return (result.stdout + result.stderr)[:4000] or "No changes"

        elif tool_name == "git_log":
            cwd = _resolve(args.get("cwd", "")) or _workspace_root or None
            limit = args.get("limit", 10)
            result = subprocess.run(
                ["git", "log", f"--max-count={limit}", "--oneline", "--decorate"],
                capture_output=True, text=True, cwd=cwd, timeout=15
            )
            return (result.stdout + result.stderr)[:2000] or "No commits"

        elif tool_name == "git_command":
            cwd = _resolve(args.get("cwd", "")) or _workspace_root or None
            result = subprocess.run(
                ["git"] + args["args"],
                capture_output=True, text=True, cwd=cwd, timeout=60
            )
            return (result.stdout + result.stderr)[:2000]

        elif tool_name == "run_tests":
            cwd = _resolve(args.get("cwd", "")) or _workspace_root or None
            framework = args.get("framework", "")
            test_filter = args.get("filter", "")

            # Auto-detect framework
            if not framework:
                if cwd and (Path(cwd) / "pytest.ini").exists() or (cwd and (Path(cwd) / "pyproject.toml").exists()):
                    framework = "pytest"
                elif cwd and (Path(cwd) / "package.json").exists():
                    pkg = json.loads((Path(cwd) / "package.json").read_text())
                    scripts = pkg.get("scripts", {})
                    if "vitest" in str(scripts):
                        framework = "vitest"
                    else:
                        framework = "jest"
                else:
                    framework = "pytest"

            if framework == "pytest":
                cmd = [sys.executable, "-m", "pytest", "-v", "--tb=short"]
                if test_filter:
                    cmd += ["-k", test_filter]
            elif framework == "vitest":
                npm = "npm.cmd" if sys.platform == "win32" else "npm"
                cmd = [npm, "run", "test", "--", "--reporter=verbose"]
            else:
                npm = "npm.cmd" if sys.platform == "win32" else "npm"
                cmd = [npm, "test", "--", "--verbose"]
                if test_filter:
                    cmd += ["--testNamePattern", test_filter]

            if ws:
                result = await run_command_streaming(" ".join(cmd), cwd, ws, timeout=120)
                return json.dumps(result)
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, timeout=120)
            return (result.stdout + result.stderr)[:4000]

        elif tool_name == "web_fetch":
            max_chars = args.get("max_chars", 5000)
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                r = await client.get(args["url"])
                text = r.text
                # Strip HTML tags for readability
                text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL | re.I)
                text = re.sub(r"<style[^>]*>.*?</style>",  "", text, flags=re.DOTALL | re.I)
                text = re.sub(r"<[^>]+>", " ", text)
                text = re.sub(r"\s+", " ", text).strip()
                return text[:max_chars]

        return f"Unknown tool: {tool_name}"

    except Exception as e:
        return f"Tool error ({tool_name}): {type(e).__name__}: {e}"