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

app = FastAPI(title="CodeDroid AI Sidecar", version="3.0.0")
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
    return {"status": "ok", "version": "3.0.0"}


@app.post("/set-workspace")
async def set_workspace(body: dict):
    global _workspace_root
    _workspace_root = body.get("path", "")
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
@app.websocket("/ws/chat")
async def websocket_chat(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_text()
            req = ChatRequest(**json.loads(data))

            # Dynamic Skill Injection
            skill_blocks = []
            for skill_id in req.skills:
                content = get_skill_content(skill_id)
                if content:
                    skill_blocks.append(content)

            skill_context = "\n".join(skill_blocks)

            system = req.system or (
                "You are CodeDroid AI Copilot, an expert coding assistant. "
                "Be concise, technical, and precise. Format code with markdown."
            )

            if skill_context:
                system = f"{system}\n\nUSE THESE SPECIALIZED SKILLS AND RULES:\n{skill_context}"

            # ── Groq free tier: 8000 TPM (input + output combined) ────────────
            # Cap system prompt at 800 chars (~200 tokens)
            # Trim history to last 4 messages, 400 chars each (~400 tokens)
            # Output capped at 2000 tokens → total ~3100 tokens → safely under 8000
            MAX_SYS_CHARS  = 800
            MAX_HIST_MSGS  = 4
            MAX_HIST_CHARS = 400

            if len(system) > MAX_SYS_CHARS:
                system = system[:MAX_SYS_CHARS]

            # Trim history for Groq — applied per-provider below
            def trim_messages_for_groq(messages: list) -> list:
                trimmed = [m for m in messages if m.get("content") and m.get("role") != "tool"]
                trimmed = trimmed[-MAX_HIST_MSGS:]
                return [
                    {**m, "content": m["content"][:MAX_HIST_CHARS] if isinstance(m["content"], str) else m["content"]}
                    for m in trimmed
                ]

            try:
                # Tool descriptions for prompt-injection providers (Ollama, Gemini)
                TOOLS_DESCRIPTION = "\n".join(
                    f"- {t['function']['name']}: {t['function']['description']}"
                    for t in TOOLS
                )
                AGENT_TOOL_PROMPT = (
                    "\n\nYou have access to the following tools. To call a tool, output ONLY a "
                    "JSON object on its own line in this exact format (no markdown, no backticks):\n"
                    '{"tool":"<name>","args":{<args>}}\n'
                    "After each tool call you will receive a [TOOL RESULT] message. "
                    "Continue calling tools as needed. When fully done, output your final answer.\n\n"
                    f"Available tools:\n{TOOLS_DESCRIPTION}"
                )

                async with httpx.AsyncClient(timeout=120) as client:

                    if req.provider == "groq":
                        # ── Groq: native function-calling agent loop ─────────────────────
                        groq_history = trim_messages_for_groq(req.messages)
                        groq_model = req.model or "llama-3.3-70b-versatile"
                        if groq_model.startswith("compound"):
                            await ws.send_text(json.dumps({
                                "type": "token",
                                "text": f'⚠️ "{groq_model}" is a Groq system agent, not a direct chat model.\n\nPlease select a chat model like:\n• openai/gpt-oss-120b\n• llama-3.3-70b-versatile\n• mixtral-8x7b-32768'
                            }))
                            await ws.send_text(json.dumps({"type": "done"}))
                            return
                        groq_max_tokens = GROQ_MAX_TOKENS.get(groq_model, GROQ_MAX_TOKENS["default"])

                        # ── Thinking mode ──────────────────────────────────────────────────
                        use_thinking = req.thinking or should_use_thinking(req.messages[-1].get("content","") if req.messages else "", req.mode)
                        native_think = is_native_thinking_model(groq_model)

                        groq_system = system
                        if use_thinking and not native_think:
                            groq_system = inject_cot_into_system(system)

                        if use_thinking:
                            await ws.send_text(json.dumps({"type": "thinking_start"}))

                        current_messages = [{"role": "system", "content": groq_system}] + groq_history
                        max_iterations = 8 if req.mode == "agent" else 1

                        for i in range(max_iterations):
                            payload: dict = {
                                "model": groq_model,
                                "stream": True,
                                "max_tokens": groq_max_tokens,
                                "messages": current_messages,
                            }
                            if req.mode == "agent":
                                payload["tools"] = TOOLS
                                payload["tool_choice"] = "auto"

                            tool_calls: list = []
                            full_content = ""
                            finish_reason = ""
                            async with client.stream(
                                "POST", "https://api.groq.com/openai/v1/chat/completions",
                                headers={"Authorization": f"Bearer {req.api_key}"},
                                json=payload,
                            ) as resp:
                                async for line in resp.aiter_lines():
                                    if line.startswith("data: ") and line != "data: [DONE]":
                                        try:
                                            chunk = json.loads(line[6:])
                                            choice = chunk["choices"][0]
                                            delta = choice["delta"]
                                            finish_reason = choice.get("finish_reason") or finish_reason
                                            if "content" in delta and delta["content"]:
                                                full_content += delta["content"]
                                                await ws.send_text(json.dumps({"type": "token", "text": delta["content"]}))
                                            if "tool_calls" in delta:
                                                for tc in delta["tool_calls"]:
                                                    while len(tool_calls) <= tc["index"]:
                                                        tool_calls.append({"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
                                                    if "id" in tc: tool_calls[tc["index"]]["id"] += tc["id"]
                                                    if "function" in tc:
                                                        if "name" in tc["function"]: tool_calls[tc["index"]]["function"]["name"] += tc["function"]["name"]
                                                        if "arguments" in tc["function"]: tool_calls[tc["index"]]["function"]["arguments"] += tc["function"]["arguments"]
                                        except: pass

                            # Extract thinking block for native models
                            if use_thinking and native_think and full_content:
                                thinking, full_content = extract_think_tags(full_content)
                                if thinking:
                                    await ws.send_text(json.dumps({"type": "thinking", "text": thinking}))

                            # Truncation detection
                            if was_response_truncated(finish_reason, "groq") and req.mode != "agent":
                                await ws.send_text(json.dumps({"type": "truncated", "finish_reason": finish_reason}))

                            if not tool_calls:
                                break

                            current_messages.append({"role": "assistant", "content": full_content, "tool_calls": tool_calls})
                            for tc in tool_calls:
                                name = tc["function"]["name"]
                                try:
                                    args = json.loads(tc["function"]["arguments"])
                                except Exception:
                                    args = {}
                                await ws.send_text(json.dumps({"type": "tool_start", "tool": name, "args": args}))
                                result = await execute_tool(name, args, ws)
                                await ws.send_text(json.dumps({"type": "tool_end", "tool": name, "output": result}))
                                current_messages.append({
                                    "role": "tool", "tool_call_id": tc["id"],
                                    "name": name, "content": result,
                                })
                            if i == max_iterations - 1:
                                await ws.send_text(json.dumps({"type": "token", "text": "\n\n*(Max agent iterations reached)*"}))

                    elif req.provider == "claude":
                        # ── Claude: native tool_use API ──────────────────────────────────
                        claude_model = req.model or "claude-sonnet-4-20250514"

                        if req.mode == "agent":
                            claude_tools = [
                                {"name": t["function"]["name"],
                                 "description": t["function"]["description"],
                                 "input_schema": t["function"]["parameters"]}
                                for t in TOOLS
                            ]
                            current_messages = list(req.messages)
                            max_iterations = 8

                            for i in range(max_iterations):
                                r = await client.post(
                                    "https://api.anthropic.com/v1/messages",
                                    headers={"x-api-key": req.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                                    json={
                                        "model": claude_model, "max_tokens": 4096,
                                        "system": system, "tools": claude_tools,
                                        "tool_choice": {"type": "auto"},
                                        "messages": current_messages,
                                    },
                                )
                                resp_data = r.json()
                                stop_reason = resp_data.get("stop_reason", "")
                                content_blocks = resp_data.get("content", [])

                                for block in content_blocks:
                                    if block.get("type") == "text" and block.get("text"):
                                        await ws.send_text(json.dumps({"type": "token", "text": block["text"]}))

                                if stop_reason != "tool_use":
                                    break

                                tool_results = []
                                for block in content_blocks:
                                    if block.get("type") == "tool_use":
                                        name = block["name"]
                                        args = block.get("input", {})
                                        tool_id = block.get("id", "")
                                        await ws.send_text(json.dumps({"type": "tool_start", "tool": name, "args": args}))
                                        result = await execute_tool(name, args, ws)
                                        await ws.send_text(json.dumps({"type": "tool_end", "tool": name, "output": result}))
                                        tool_results.append({"type": "tool_result", "tool_use_id": tool_id, "content": result})

                                current_messages.append({"role": "assistant", "content": content_blocks})
                                current_messages.append({"role": "user", "content": tool_results})
                                if i == max_iterations - 1:
                                    await ws.send_text(json.dumps({"type": "token", "text": "\n\n*(Max agent iterations reached)*"}))
                        else:
                            # ── Claude Ask/Plan — streaming with thinking support ─────────
                            use_thinking = req.thinking or should_use_thinking(
                                req.messages[-1].get("content","") if req.messages else "", req.mode)

                            claude_payload: dict = {
                                "model": claude_model, "max_tokens": 4096, "stream": True,
                                "system": system, "messages": req.messages,
                            }

                            # Claude native extended thinking
                            if use_thinking and "claude" in claude_model:
                                claude_payload["thinking"] = {"type": "enabled", "budget_tokens": 5000}
                                claude_payload["max_tokens"] = 8000  # thinking needs headroom
                                claude_payload["stream"] = False    # streaming + thinking not yet stable
                                await ws.send_text(json.dumps({"type": "thinking_start"}))
                                r = await client.post(
                                    "https://api.anthropic.com/v1/messages",
                                    headers={"x-api-key": req.api_key, "anthropic-version": "2023-06-01",
                                             "content-type": "application/json",
                                             "anthropic-beta": "interleaved-thinking-2025-05-14"},
                                    json=claude_payload,
                                )
                                resp_data = r.json()
                                for block in resp_data.get("content", []):
                                    if block.get("type") == "thinking":
                                        await ws.send_text(json.dumps({"type": "thinking", "text": block.get("thinking", "")}))
                                    elif block.get("type") == "text":
                                        await ws.send_text(json.dumps({"type": "token", "text": block.get("text", "")}))
                                if was_response_truncated(resp_data.get("stop_reason",""), "claude"):
                                    await ws.send_text(json.dumps({"type": "truncated", "finish_reason": resp_data.get("stop_reason","")}))
                            else:
                                finish_reason = ""
                                async with client.stream(
                                    "POST", "https://api.anthropic.com/v1/messages",
                                    headers={"x-api-key": req.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                                    json=claude_payload,
                                ) as resp:
                                    async for line in resp.aiter_lines():
                                        if line.startswith("data: "):
                                            try:
                                                chunk = json.loads(line[6:])
                                                if chunk.get("type") == "content_block_delta":
                                                    token = chunk["delta"].get("text", "")
                                                    if token:
                                                        await ws.send_text(json.dumps({"type": "token", "text": token}))
                                                elif chunk.get("type") == "message_delta":
                                                    finish_reason = chunk.get("delta", {}).get("stop_reason", "")
                                            except: pass
                                if was_response_truncated(finish_reason, "claude"):
                                    await ws.send_text(json.dumps({"type": "truncated", "finish_reason": finish_reason}))

                    elif req.provider == "ollama":
                        # ── Ollama: prompt-injection agent loop ──────────────────────────
                        ollama_model = req.model or "llama3"

                        if req.mode == "agent":
                            agent_system = system + AGENT_TOOL_PROMPT
                            current_messages = [{"role": "system", "content": agent_system}] + req.messages
                            max_iterations = 8
                            for i in range(max_iterations):
                                r = await client.post(
                                    f"{req.host}/api/chat",
                                    json={"model": ollama_model, "stream": False, "messages": current_messages},
                                )
                                reply = r.json().get("message", {}).get("content", "")
                                current_messages.append({"role": "assistant", "content": reply})
                                tool_called = False
                                for ln in reply.splitlines():
                                    ln = ln.strip()
                                    if ln.startswith("{") and '"tool"' in ln:
                                        try:
                                            call = json.loads(ln)
                                            name = call.get("tool", "")
                                            args = call.get("args", {})
                                            if name:
                                                tool_called = True
                                                await ws.send_text(json.dumps({"type": "tool_start", "tool": name, "args": args}))
                                                result = await execute_tool(name, args, ws)
                                                await ws.send_text(json.dumps({"type": "tool_end", "tool": name, "output": result}))
                                                current_messages.append({"role": "user", "content": f"[TOOL RESULT for {name}]\n{result}"})
                                        except: pass
                                if not tool_called:
                                    await ws.send_text(json.dumps({"type": "token", "text": reply}))
                                    break
                                if i == max_iterations - 1:
                                    await ws.send_text(json.dumps({"type": "token", "text": "\n\n*(Max agent iterations reached)*"}))
                        else:
                            # ── Ollama Ask/Plan — streaming with thinking support ─────────
                            use_thinking = req.thinking or should_use_thinking(
                                req.messages[-1].get("content","") if req.messages else "", req.mode)
                            native_think_ol = is_native_thinking_model(ollama_model)
                            ollama_system = system
                            if use_thinking and not native_think_ol:
                                ollama_system = inject_cot_into_system(system)
                            if use_thinking:
                                await ws.send_text(json.dumps({"type": "thinking_start"}))
                            async with client.stream(
                                "POST", f"{req.host}/api/chat",
                                json={"model": ollama_model, "stream": True,
                                      "messages": [{"role": "system", "content": ollama_system}] + req.messages},
                            ) as resp:
                                full_ol = ""
                                async for line in resp.aiter_lines():
                                    if line.strip():
                                        try:
                                            chunk = json.loads(line)
                                            token = chunk.get("message", {}).get("content", "")
                                            if token:
                                                full_ol += token
                                                await ws.send_text(json.dumps({"type": "token", "text": token}))
                                            if chunk.get("done") and was_response_truncated(chunk.get("done_reason",""), "ollama"):
                                                await ws.send_text(json.dumps({"type": "truncated", "finish_reason": chunk.get("done_reason","")}))
                                        except: pass
                            if use_thinking and native_think_ol:
                                thinking, _ = extract_think_tags(full_ol)
                                if thinking:
                                    await ws.send_text(json.dumps({"type": "thinking", "text": thinking}))

                    else:  # gemini
                        # ── Gemini: prompt-injection agent loop ──────────────────────────
                        gemini_model = req.model or "gemini-1.5-pro"

                        if req.mode == "agent":
                            agent_system = system + AGENT_TOOL_PROMPT
                            gemini_messages = list(req.messages)
                            max_iterations = 8
                            for i in range(max_iterations):
                                r = await client.post(
                                    f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent",
                                    params={"key": req.api_key},
                                    json={
                                        "system_instruction": {"parts": [{"text": agent_system}]},
                                        "contents": gemini_messages,
                                    },
                                )
                                reply = r.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                                gemini_messages.append({"role": "model", "parts": [{"text": reply}]})
                                tool_called = False
                                for ln in reply.splitlines():
                                    ln = ln.strip()
                                    if ln.startswith("{") and '"tool"' in ln:
                                        try:
                                            call = json.loads(ln)
                                            name = call.get("tool", "")
                                            args = call.get("args", {})
                                            if name:
                                                tool_called = True
                                                await ws.send_text(json.dumps({"type": "tool_start", "tool": name, "args": args}))
                                                result = await execute_tool(name, args, ws)
                                                await ws.send_text(json.dumps({"type": "tool_end", "tool": name, "output": result}))
                                                gemini_messages.append({"role": "user", "parts": [{"text": f"[TOOL RESULT for {name}]\n{result}"}]})
                                        except: pass
                                if not tool_called:
                                    await ws.send_text(json.dumps({"type": "token", "text": reply}))
                                    break
                                if i == max_iterations - 1:
                                    await ws.send_text(json.dumps({"type": "token", "text": "\n\n*(Max agent iterations reached)*"}))
                        else:
                            # ── Gemini Ask/Plan with thinking support ─────────────────────
                            use_thinking_gem = req.thinking or should_use_thinking(
                                req.messages[-1].get("content","") if req.messages else "", req.mode)
                            native_think_gem = is_native_thinking_model(gemini_model)

                            gem_json: dict = {
                                "system_instruction": {"parts": [{"text": system}]},
                                "contents": req.messages,
                            }
                            # Gemini 2.0 flash-thinking / 2.5 support thinking budget
                            if use_thinking_gem and native_think_gem:
                                gem_json["generationConfig"] = {"thinkingConfig": {"thinkingBudget": 8192}}
                                await ws.send_text(json.dumps({"type": "thinking_start"}))
                            elif use_thinking_gem:
                                gem_json["system_instruction"]["parts"][0]["text"] = inject_cot_into_system(system)
                                await ws.send_text(json.dumps({"type": "thinking_start"}))

                            r = await client.post(
                                f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent",
                                params={"key": req.api_key},
                                json=gem_json,
                            )
                            data = r.json()
                            candidate = data.get("candidates", [{}])[0]
                            finish = candidate.get("finishReason", "")
                            for part in candidate.get("content", {}).get("parts", []):
                                part_text = part.get("text", "")
                                if not part_text:
                                    continue
                                if part.get("thought"):
                                    await ws.send_text(json.dumps({"type": "thinking", "text": part_text}))
                                else:
                                    if use_thinking_gem and not native_think_gem:
                                        # CoT: extract <thinking> tags from plain text
                                        thinking, answer = extract_think_tags(part_text)
                                        if thinking:
                                            await ws.send_text(json.dumps({"type": "thinking", "text": thinking}))
                                        await ws.send_text(json.dumps({"type": "token", "text": answer}))
                                    else:
                                        await ws.send_text(json.dumps({"type": "token", "text": part_text}))
                            if was_response_truncated(finish, "gemini"):
                                await ws.send_text(json.dumps({"type": "truncated", "finish_reason": finish}))

                await ws.send_text(json.dumps({"type": "done"}))

            except Exception as e:
                await ws.send_text(json.dumps({"type": "error", "message": str(e)}))

    except WebSocketDisconnect:
        pass


# ─── Auto-Fix Helpers ─────────────────────────────────────────────────────────

async def _get_ai_fix(
    api_key: str, provider: str, model: str, host: str,
    file_path: str, file_content: str, error: dict, command: str,
) -> str:
    """Call the AI to get a surgical fix for a broken file. Returns corrected file content."""
    fix_prompt = f"""You are an expert debugger. Fix the following file.

File: {file_path}
Line: {error.get('line_number', 'unknown')}
Error type: {error.get('error_type', 'unknown')}
Error message: {error.get('error_message', 'unknown')}
Command run: {command}

Rules:
1. Identify the exact root cause
2. Make the minimal surgical fix — change only what is broken
3. Do NOT refactor, rename, or restructure anything else
4. Return ONLY the corrected full file content — no explanation, no markdown fences

File content:
{file_content}"""

    messages = [{"role": "user", "content": fix_prompt}]
    system = "You are an expert debugger. Return ONLY corrected file content, nothing else."

    async with httpx.AsyncClient(timeout=60) as client:
        if provider == "groq":
            m = model or "llama3-70b-8192"
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": m, "max_tokens": GROQ_MAX_TOKENS.get(m, 8192),
                      "messages": [{"role": "system", "content": system}] + messages},
            )
            return r.json()["choices"][0]["message"]["content"]

        elif provider == "claude":
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json={"model": model or "claude-sonnet-4-20250514", "max_tokens": 4096,
                      "system": system, "messages": messages},
            )
            return r.json()["content"][0]["text"]

        elif provider == "gemini":
            r = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model or 'gemini-1.5-pro'}:generateContent",
                params={"key": api_key},
                json={"system_instruction": {"parts": [{"text": system}]},
                      "contents": [{"role": "user", "parts": [{"text": fix_prompt}]}]},
            )
            return r.json()["candidates"][0]["content"]["parts"][0]["text"]

        else:  # ollama
            r = await client.post(f"{host}/api/chat", json={
                "model": model or "llama3", "stream": False,
                "messages": [{"role": "system", "content": system}] + messages,
            })
            return r.json()["message"]["content"]


async def _run_command_capture(command: str, workspace: str) -> dict:
    """Run a shell command and return structured result with error detection."""
    cwd = workspace or _workspace_root or None
    proc = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=cwd,
    )
    try:
        stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=60)
    except asyncio.TimeoutError:
        proc.kill()
        return {"stdout": "", "stderr": "Timed out", "exit_code": -1, "had_error": True}
    stdout = stdout_b.decode(errors="replace")
    stderr = stderr_b.decode(errors="replace")
    combined = stdout + stderr
    had_error = (proc.returncode != 0) or bool(stderr.strip())
    return {
        "stdout": stdout[:3000],
        "stderr": stderr[:3000],
        "exit_code": proc.returncode,
        "had_error": had_error,
        "output": combined[:4000],
    }


# ─── /ws/agent-fix WebSocket ──────────────────────────────────────────────────
class AgentFixRequest(BaseModel):
    command: str                  # The command to run (and re-run after fixes)
    workspace: str = ""           # Workspace root path
    file_path: str = ""           # Optional: specific file to fix (if known)
    error_text: str = ""          # Optional: pre-pasted error text
    provider: str = "groq"
    api_key: str = ""
    model: str = ""
    host: str = "http://localhost:11434"


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


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    import uvicorn
    print(f"[CodeDroid Sidecar] Starting on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")