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

app = FastAPI(title="CodeDroid AI Sidecar", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Models ──────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    messages: list[dict]
    provider: str = "groq"
    api_key: str = ""
    model: str = ""
    host: str = "http://localhost:11434"
    system: str = ""

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

# ─── Tool executor ─────────────────────────────────────────────────────────────
async def execute_tool(tool_name: str, args: dict) -> str:
    try:
        if tool_name == "read_file":
            p = Path(args["path"])
            return p.read_text(encoding="utf-8") if p.exists() else f"Error: File not found: {args['path']}"

        elif tool_name == "write_file" or tool_name == "create_file":
            p = Path(args["path"])
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(args.get("content", ""), encoding="utf-8")
            return f"Written: {args['path']}"

        elif tool_name == "delete_file":
            import shutil
            p = Path(args["path"])
            if p.is_dir(): shutil.rmtree(p)
            elif p.exists(): p.unlink()
            return f"Deleted: {args['path']}"

        elif tool_name == "make_dir":
            Path(args["path"]).mkdir(parents=True, exist_ok=True)
            return f"Created directory: {args['path']}"

        elif tool_name == "list_files":
            p = Path(args["path"])
            if not p.exists(): return f"Error: Directory not found"
            entries = []
            for e in sorted(p.iterdir()):
                entries.append(f"{'[DIR]' if e.is_dir() else '[FILE]'} {e.name}")
            return "\n".join(entries) or "(empty)"

        elif tool_name == "run_command":
            result = subprocess.run(
                args["command"], shell=True, capture_output=True, text=True,
                cwd=args.get("cwd") or None, timeout=30
            )
            out = result.stdout + result.stderr
            return out[:4000] if out else "(no output)"

        elif tool_name == "run_python":
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False, encoding="utf-8") as f:
                f.write(args["code"])
                tmp = f.name
            try:
                result = subprocess.run(
                    [sys.executable, tmp], capture_output=True, text=True,
                    cwd=args.get("cwd") or None, timeout=30
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
            result = subprocess.run(
                ["git"] + args["args"], capture_output=True, text=True,
                cwd=args.get("cwd") or None, timeout=30
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
@app.get("/health")
async def health():
    return {"status": "ok", "version": "3.0.0"}


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


# ─── WebSocket streaming AI ───────────────────────────────────────────────────
@app.websocket("/ws/chat")
async def websocket_chat(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await ws.receive_text()
            req = ChatRequest(**json.loads(data))

            system = req.system or (
                "You are CodeDroid AI Copilot, an expert coding assistant. "
                "Be concise, technical, and precise. Format code with markdown."
            )

            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    if req.provider == "groq":
                        async with client.stream(
                            "POST",
                            "https://api.groq.com/openai/v1/chat/completions",
                            headers={"Authorization": f"Bearer {req.api_key}"},
                            json={
                                "model": req.model or "llama3-70b-8192",
                                "stream": True,
                                "messages": [{"role": "system", "content": system}] + req.messages,
                            },
                        ) as resp:
                            async for line in resp.aiter_lines():
                                if line.startswith("data: ") and line != "data: [DONE]":
                                    try:
                                        chunk = json.loads(line[6:])
                                        token = chunk["choices"][0]["delta"].get("content", "")
                                        if token:
                                            await ws.send_text(json.dumps({"type": "token", "text": token}))
                                    except: pass

                    elif req.provider == "claude":
                        async with client.stream(
                            "POST",
                            "https://api.anthropic.com/v1/messages",
                            headers={
                                "x-api-key": req.api_key,
                                "anthropic-version": "2023-06-01",
                                "content-type": "application/json",
                            },
                            json={
                                "model": req.model or "claude-sonnet-4-20250514",
                                "max_tokens": 4096,
                                "stream": True,
                                "system": system,
                                "messages": req.messages,
                            },
                        ) as resp:
                            async for line in resp.aiter_lines():
                                if line.startswith("data: "):
                                    try:
                                        chunk = json.loads(line[6:])
                                        if chunk.get("type") == "content_block_delta":
                                            token = chunk["delta"].get("text", "")
                                            if token:
                                                await ws.send_text(json.dumps({"type": "token", "text": token}))
                                    except: pass

                    elif req.provider == "ollama":
                        async with client.stream(
                            "POST",
                            f"{req.host}/api/chat",
                            json={
                                "model": req.model or "llama3",
                                "stream": True,
                                "messages": [{"role": "system", "content": system}] + req.messages,
                            },
                        ) as resp:
                            async for line in resp.aiter_lines():
                                if line.strip():
                                    try:
                                        chunk = json.loads(line)
                                        token = chunk.get("message", {}).get("content", "")
                                        if token:
                                            await ws.send_text(json.dumps({"type": "token", "text": token}))
                                    except: pass

                    else:  # gemini
                        r = await client.post(
                            f"https://generativelanguage.googleapis.com/v1beta/models/{req.model or 'gemini-1.5-pro'}:generateContent",
                            params={"key": req.api_key},
                            json={
                                "system_instruction": {"parts": [{"text": system}]},
                                "contents": req.messages,
                            },
                        )
                        data = r.json()
                        text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        if text:
                            await ws.send_text(json.dumps({"type": "token", "text": text}))

                await ws.send_text(json.dumps({"type": "done"}))

            except Exception as e:
                await ws.send_text(json.dumps({"type": "error", "message": str(e)}))

    except WebSocketDisconnect:
        pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    import uvicorn
    print(f"[CodeDroid Sidecar] Starting on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
