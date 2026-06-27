"""
agent_core.py — Proper agentic loop for CodeDroid v4.

Architecture:
  plan → stream → [tool confirm] → execute → observe → replan

Supports: Groq (native function-calling), Claude (tool_use API),
          Gemini (JSON tool parsing), Ollama (JSON tool parsing).

Key improvements over v3:
  - Confirmation gate for destructive tools (via tools.py)
  - Context window management (via context_manager.py)
  - SQLite session memory (via memory.py)
  - Prompt injection sanitization
  - Proper error recovery in agent loop
  - session_id threaded through all tool calls
"""

import asyncio
import json
import time
from typing import Optional, AsyncIterator

import httpx

from tools import execute_tool, TOOLS, resolve_confirmation
from mcp_bus import get_bus
from context_manager import (
    trim_messages, build_system_prompt, sanitize_user_input,
    get_output_limit, get_input_limit,
)
from memory import (
    init_db, start_session, end_session, log_message,
    build_memory_context, kv_get, kv_set,
)

try:
    from thinking_detector import (
        should_use_thinking, is_native_thinking_model,
        extract_think_tags, inject_cot_into_system,
        was_response_truncated,
    )
except ImportError:
    def should_use_thinking(p, m): return False
    def is_native_thinking_model(m): return False
    def extract_think_tags(r): return "", r
    def inject_cot_into_system(s): return s
    def was_response_truncated(r, p): return False


# ── Groq output token limits ───────────────────────────────────────────────────
GROQ_MAX_TOKENS: dict[str, int] = {
    "openai/gpt-oss-120b":                   2000,
    "openai/gpt-oss-20b":                    2000,
    "llama-3.3-70b-versatile":               2000,
    "llama-3.1-70b-versatile":               2000,
    "llama-3.1-8b-instant":                  2000,
    "llama3-70b-8192":                       2000,
    "llama3-8b-8192":                        2000,
    "llama3-groq-70b-8192-tool-use-preview": 2000,
    "llama3-groq-8b-8192-tool-use-preview":  2000,
    "mixtral-8x7b-32768":                    2000,
    "gemma2-9b-it":                          2000,
    "gemma-7b-it":                           2000,
    "default":                               1500,
}

MAX_AGENT_ITERATIONS = 10


# ── Tool description string (for providers that don't support native tool-calling) ─
async def _execute_any_tool(tool_name: str, args: dict, ws=None, session_id=None) -> str:
    """
    Route tool calls to either built-in tools or MCP servers.
    MCP tools are prefixed: mcp_{server_id}_{tool_name}
    """
    if tool_name.startswith("mcp_"):
        # Parse: mcp_{server_id}_{tool_name} — server_id may contain underscores
        # so we match against known servers
        bus = get_bus()
        all_tools = bus.list_all_tools()
        match = next((t for t in all_tools if t["name"] == tool_name), None)
        if match:
            return await bus.call_tool(match["server_id"], match["tool_name"], args)
        return f"Error: MCP tool '{tool_name}' not found"
    return await execute_tool(tool_name, args, ws, session_id)


def _get_all_tools() -> list[dict]:
    """Return built-in tools + all connected MCP tools for function-calling."""
    all_tools = list(TOOLS)
    bus = get_bus()
    for mcp_tool in bus.list_all_tools():
        all_tools.append({
            "type": "function",
            "function": {
                "name": mcp_tool["name"],
                "description": mcp_tool["description"],
                "parameters": mcp_tool.get("input_schema", {
                    "type": "object", "properties": {}, "required": []
                }),
            }
        })
    return all_tools


def _tools_description() -> str:
    lines = [
        f"- {t['function']['name']}: {t['function']['description']}"
        for t in _get_all_tools()
    ]
    return "\n".join(lines)

AGENT_TOOL_PROMPT = (
    "\n\nYou have access to tools. To call a tool, output ONLY a JSON object on its own "
    "line with no markdown or backticks:\n"
    '{{"tool":"<name>","args":{{<args>}}}}\n'
    "After each tool call you will receive a [TOOL RESULT] message. "
    "Continue calling tools as needed. When done, write your final answer.\n\n"
    "Available tools:\n{tools}"
)


# ── WebSocket helpers ──────────────────────────────────────────────────────────
async def _send(ws, payload: dict) -> None:
    try:
        await ws.send_text(json.dumps(payload))
    except Exception:
        pass


# ── Ollama/Gemini JSON tool parser ─────────────────────────────────────────────
def _parse_json_tool_call(text: str) -> Optional[tuple[str, dict]]:
    """
    Try to extract a JSON tool call from the model's raw text output.
    Returns (tool_name, args) or None.
    """
    import re
    # Look for a JSON object containing "tool" key on its own line
    for line in text.strip().splitlines():
        line = line.strip()
        if line.startswith("{") and '"tool"' in line:
            try:
                obj = json.loads(line)
                if "tool" in obj:
                    return obj["tool"], obj.get("args", {})
            except json.JSONDecodeError:
                pass
    # Fallback: find JSON block in the text
    matches = re.findall(r'\{[^{}]*"tool"[^{}]*\}', text, re.DOTALL)
    for m in matches:
        try:
            obj = json.loads(m)
            if "tool" in obj:
                return obj["tool"], obj.get("args", {})
        except json.JSONDecodeError:
            pass
    return None


# ── Main agent runner ──────────────────────────────────────────────────────────
async def run_agent(
    ws,
    provider: str,
    api_key: str,
    model: str,
    messages: list[dict],
    system: str,
    mode: str,
    thinking: bool,
    skills: list[str],
    workspace: str,
    ollama_host: str = "http://localhost:11434",
) -> None:
    """
    Main entry point called from the WebSocket handler.
    Handles all providers and modes (ask / plan / agent).
    """
    # ── Init memory ────────────────────────────────────────────────────────────
    init_db()
    session_id = start_session(project=workspace, provider=provider, model=model)

    # ── Sanitize last user message ─────────────────────────────────────────────
    if messages and messages[-1].get("role") == "user":
        content = messages[-1].get("content", "")
        if isinstance(content, str):
            messages[-1] = {**messages[-1], "content": sanitize_user_input(content)}

    # Log user message
    if messages:
        last = messages[-1]
        log_message(session_id, last.get("role", "user"),
                    last.get("content", "") if isinstance(last.get("content"), str) else "[complex]")

    # ── Build memory context ───────────────────────────────────────────────────
    memory_ctx = build_memory_context(workspace) if workspace else ""

    # ── Build system prompt ────────────────────────────────────────────────────
    tools_desc = _tools_description() if mode == "agent" else ""
    full_system = build_system_prompt(
        base_system=system or (
            "You are CodeDroid AI Copilot, an expert coding assistant. "
            "Be concise, technical, and precise. Format code in markdown."
        ),
        memory_context=memory_ctx,
        skill_context="",           # skills injected by caller
        mode=mode,
        tools_description=tools_desc,
    )

    # ── Trim messages to fit context window ────────────────────────────────────
    trimmed_messages = trim_messages(
        messages,
        provider=provider,
        system_prompt=full_system,
        keep_last_n=20,
    )

    summary_parts: list[str] = []

    try:
        async with httpx.AsyncClient(timeout=120) as client:

            # ═══════════════════════════════════════════════════════════════════
            # GROQ
            # ═══════════════════════════════════════════════════════════════════
            if provider == "groq":
                groq_model = model or "llama-3.3-70b-versatile"

                if groq_model.startswith("compound"):
                    await _send(ws, {"type": "token", "text":
                        f'⚠️ "{groq_model}" is a Groq system agent, not a chat model.\n'
                        'Please select: openai/gpt-oss-120b · llama-3.3-70b-versatile · mixtral-8x7b-32768'})
                    await _send(ws, {"type": "done"})
                    return

                max_out = GROQ_MAX_TOKENS.get(groq_model, GROQ_MAX_TOKENS["default"])
                use_thinking = thinking or should_use_thinking(
                    messages[-1].get("content", "") if messages else "", mode)
                native_think = is_native_thinking_model(groq_model)

                groq_system = inject_cot_into_system(full_system) if (use_thinking and not native_think) else full_system
                if use_thinking:
                    await _send(ws, {"type": "thinking_start"})

                current_msgs = [{"role": "system", "content": groq_system}] + trimmed_messages
                max_iters = MAX_AGENT_ITERATIONS if mode == "agent" else 1

                for iteration in range(max_iters):
                    payload: dict = {
                        "model": groq_model,
                        "stream": True,
                        "max_tokens": max_out,
                        "messages": current_msgs,
                    }
                    if mode == "agent":
                        payload["tools"] = TOOLS
                        payload["tool_choice"] = "auto"

                    tool_calls: list[dict] = []
                    full_content = ""
                    finish_reason = ""

                    async with client.stream(
                        "POST", "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {api_key}"},
                        json=payload,
                    ) as resp:
                        async for line in resp.aiter_lines():
                            if not line.startswith("data: ") or line == "data: [DONE]":
                                continue
                            try:
                                chunk = json.loads(line[6:])
                                choice = chunk["choices"][0]
                                delta = choice["delta"]
                                finish_reason = choice.get("finish_reason") or finish_reason

                                if delta.get("content"):
                                    full_content += delta["content"]
                                    await _send(ws, {"type": "token", "text": delta["content"]})

                                if "tool_calls" in delta:
                                    for tc in delta["tool_calls"]:
                                        idx = tc["index"]
                                        while len(tool_calls) <= idx:
                                            tool_calls.append({"id": "", "type": "function",
                                                               "function": {"name": "", "arguments": ""}})
                                        if "id" in tc:
                                            tool_calls[idx]["id"] += tc["id"]
                                        if "function" in tc:
                                            if "name" in tc["function"]:
                                                tool_calls[idx]["function"]["name"] += tc["function"]["name"]
                                            if "arguments" in tc["function"]:
                                                tool_calls[idx]["function"]["arguments"] += tc["function"]["arguments"]
                            except Exception:
                                pass

                    # Thinking extraction
                    if use_thinking and native_think and full_content:
                        thinking_text, full_content = extract_think_tags(full_content)
                        if thinking_text:
                            await _send(ws, {"type": "thinking", "text": thinking_text})

                    # Truncation detection
                    if was_response_truncated(finish_reason, "groq"):
                        if mode != "agent" or not tool_calls:
                            await _send(ws, {"type": "truncated", "finish_reason": finish_reason})

                    if not tool_calls:
                        summary_parts.append(full_content[:200])
                        log_message(session_id, "assistant", full_content)
                        break

                    # Process tool calls
                    current_msgs.append({
                        "role": "assistant",
                        "content": full_content,
                        "tool_calls": tool_calls,
                    })

                    for tc in tool_calls:
                        name = tc["function"]["name"]
                        try:
                            args = json.loads(tc["function"]["arguments"])
                        except Exception:
                            args = {}

                        await _send(ws, {"type": "tool_start", "tool": name, "args": args})
                        result = await _execute_any_tool(name, args, ws, session_id)
                        await _send(ws, {"type": "tool_end", "tool": name, "output": result})
                        log_message(session_id, "tool", result[:500], tool_name=name)
                        summary_parts.append(f"{name}({list(args.keys())})")

                        current_msgs.append({
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "name": name,
                            "content": result,
                        })

                    if iteration == max_iters - 1:
                        await _send(ws, {"type": "token", "text": "\n\n*(Max agent iterations reached)*"})

            # ═══════════════════════════════════════════════════════════════════
            # CLAUDE
            # ═══════════════════════════════════════════════════════════════════
            elif provider == "claude":
                claude_model = model or "claude-sonnet-4-6"
                headers = {
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                }

                if mode == "agent":
                    claude_tools = [
                        {
                            "name": t["function"]["name"],
                            "description": t["function"]["description"],
                            "input_schema": t["function"]["parameters"],
                        }
                        for t in TOOLS
                    ]
                    current_msgs = list(trimmed_messages)
                    max_iters = MAX_AGENT_ITERATIONS

                    for iteration in range(max_iters):
                        r = await client.post(
                            "https://api.anthropic.com/v1/messages",
                            headers=headers,
                            json={
                                "model": claude_model,
                                "max_tokens": 4096,
                                "system": full_system,
                                "tools": claude_tools,
                                "tool_choice": {"type": "auto"},
                                "messages": current_msgs,
                            },
                        )
                        resp_data = r.json()
                        stop_reason = resp_data.get("stop_reason", "")
                        content_blocks = resp_data.get("content", [])
                        full_text = ""

                        for block in content_blocks:
                            if block.get("type") == "text" and block.get("text"):
                                full_text += block["text"]
                                await _send(ws, {"type": "token", "text": block["text"]})

                        log_message(session_id, "assistant", full_text)

                        if stop_reason != "tool_use":
                            if was_response_truncated(stop_reason, "claude"):
                                await _send(ws, {"type": "truncated", "finish_reason": stop_reason})
                            summary_parts.append(full_text[:200])
                            break

                        tool_results = []
                        for block in content_blocks:
                            if block.get("type") == "tool_use":
                                name = block["name"]
                                args = block.get("input", {})
                                tool_id = block.get("id", "")
                                await _send(ws, {"type": "tool_start", "tool": name, "args": args})
                                result = await _execute_any_tool(name, args, ws, session_id)
                                await _send(ws, {"type": "tool_end", "tool": name, "output": result})
                                log_message(session_id, "tool", result[:500], tool_name=name)
                                summary_parts.append(f"{name}({list(args.keys())})")
                                tool_results.append({
                                    "type": "tool_result",
                                    "tool_use_id": tool_id,
                                    "content": result,
                                })

                        current_msgs.append({"role": "assistant", "content": content_blocks})
                        current_msgs.append({"role": "user", "content": tool_results})

                        if iteration == max_iters - 1:
                            await _send(ws, {"type": "token", "text": "\n\n*(Max agent iterations reached)*"})

                else:
                    # Ask/Plan — streaming with optional thinking
                    use_thinking = thinking or should_use_thinking(
                        messages[-1].get("content", "") if messages else "", mode)

                    payload: dict = {
                        "model": claude_model,
                        "max_tokens": 4096,
                        "system": full_system,
                        "messages": trimmed_messages,
                    }

                    if use_thinking:
                        payload["thinking"] = {"type": "enabled", "budget_tokens": 5000}
                        payload["max_tokens"] = 8000
                        await _send(ws, {"type": "thinking_start"})
                        r = await client.post(
                            "https://api.anthropic.com/v1/messages",
                            headers={**headers, "anthropic-beta": "interleaved-thinking-2025-05-14"},
                            json=payload,
                        )
                        resp_data = r.json()
                        full_text = ""
                        for block in resp_data.get("content", []):
                            if block.get("type") == "thinking":
                                await _send(ws, {"type": "thinking", "text": block.get("thinking", "")})
                            elif block.get("type") == "text":
                                full_text += block.get("text", "")
                                await _send(ws, {"type": "token", "text": block.get("text", "")})
                        if was_response_truncated(resp_data.get("stop_reason", ""), "claude"):
                            await _send(ws, {"type": "truncated", "finish_reason": resp_data.get("stop_reason", "")})
                    else:
                        payload["stream"] = True
                        full_text = ""
                        async with client.stream(
                            "POST", "https://api.anthropic.com/v1/messages",
                            headers=headers, json=payload,
                        ) as resp:
                            async for line in resp.aiter_lines():
                                if line.startswith("data: "):
                                    try:
                                        ev = json.loads(line[6:])
                                        if ev.get("type") == "content_block_delta":
                                            text = ev.get("delta", {}).get("text", "")
                                            if text:
                                                full_text += text
                                                await _send(ws, {"type": "token", "text": text})
                                        elif ev.get("type") == "message_delta":
                                            fr = ev.get("delta", {}).get("stop_reason", "")
                                            if was_response_truncated(fr, "claude"):
                                                await _send(ws, {"type": "truncated", "finish_reason": fr})
                                    except Exception:
                                        pass

                    log_message(session_id, "assistant", full_text)
                    summary_parts.append(full_text[:200])

            # ═══════════════════════════════════════════════════════════════════
            # GEMINI
            # ═══════════════════════════════════════════════════════════════════
            elif provider == "gemini":
                gemini_model = model or "gemini-1.5-pro"
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={api_key}"

                # Build contents from messages
                def to_gemini(msgs: list[dict]) -> list[dict]:
                    out = []
                    for m in msgs:
                        role = "user" if m.get("role") == "user" else "model"
                        content = m.get("content", "")
                        if isinstance(content, str):
                            out.append({"role": role, "parts": [{"text": content}]})
                    return out

                gemini_contents = to_gemini(trimmed_messages)
                if full_system:
                    # Prepend system as a user turn (Gemini doesn't have system role)
                    gemini_contents.insert(0, {
                        "role": "user",
                        "parts": [{"text": f"[System instructions]\n{full_system}"}]
                    })
                    gemini_contents.insert(1, {
                        "role": "model",
                        "parts": [{"text": "Understood. I'll follow those instructions."}]
                    })

                max_iters = MAX_AGENT_ITERATIONS if mode == "agent" else 1

                for iteration in range(max_iters):
                    r = await client.post(url, json={
                        "contents": gemini_contents,
                        "generationConfig": {"maxOutputTokens": 4096},
                    })
                    resp_data = r.json()
                    text = ""
                    try:
                        text = resp_data["candidates"][0]["content"]["parts"][0]["text"]
                    except (KeyError, IndexError):
                        await _send(ws, {"type": "token", "text": f"Error: {resp_data.get('error', {}).get('message', 'Unknown Gemini error')}"})
                        break

                    # Check for JSON tool call in text
                    tool_call = _parse_json_tool_call(text) if mode == "agent" else None

                    if tool_call:
                        name, args = tool_call
                        await _send(ws, {"type": "tool_start", "tool": name, "args": args})
                        result = await _execute_any_tool(name, args, ws, session_id)
                        await _send(ws, {"type": "tool_end", "tool": name, "output": result})
                        log_message(session_id, "tool", result[:500], tool_name=name)
                        summary_parts.append(f"{name}({list(args.keys())})")
                        gemini_contents.append({"role": "model", "parts": [{"text": text}]})
                        gemini_contents.append({"role": "user",  "parts": [{"text": f"[TOOL RESULT]\n{result}"}]})
                    else:
                        # Clean up any partial JSON from the output before streaming
                        clean_text = text
                        for line in text.splitlines():
                            if line.strip().startswith("{") and '"tool"' in line:
                                clean_text = clean_text.replace(line, "").strip()
                        await _send(ws, {"type": "token", "text": clean_text})
                        log_message(session_id, "assistant", clean_text)
                        summary_parts.append(clean_text[:200])
                        break

                    if iteration == max_iters - 1:
                        await _send(ws, {"type": "token", "text": "\n\n*(Max agent iterations reached)*"})

            # ═══════════════════════════════════════════════════════════════════
            # OLLAMA
            # ═══════════════════════════════════════════════════════════════════
            elif provider == "ollama":
                ollama_model = model or "llama3"

                # Inject tool instructions into system for agent mode
                agent_system = (
                    full_system + AGENT_TOOL_PROMPT.format(tools=_tools_description())
                ) if mode == "agent" else full_system

                max_iters = MAX_AGENT_ITERATIONS if mode == "agent" else 1
                current_msgs = list(trimmed_messages)

                for iteration in range(max_iters):
                    r = await client.post(
                        f"{ollama_host}/api/chat",
                        json={
                            "model": ollama_model,
                            "stream": True,
                            "messages": [{"role": "system", "content": agent_system}] + current_msgs,
                        },
                        timeout=None,
                    )

                    full_text = ""
                    async for line in r.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            token = chunk.get("message", {}).get("content", "")
                            if token:
                                full_text += token
                                # Buffer and only stream non-tool-call parts
                                if not (full_text.strip().startswith("{") and '"tool"' in full_text):
                                    await _send(ws, {"type": "token", "text": token})
                        except Exception:
                            pass

                    tool_call = _parse_json_tool_call(full_text) if mode == "agent" else None

                    if tool_call:
                        name, args = tool_call
                        # Suppress the raw JSON from being shown in UI
                        await _send(ws, {"type": "clear_last_token"})
                        await _send(ws, {"type": "tool_start", "tool": name, "args": args})
                        result = await _execute_any_tool(name, args, ws, session_id)
                        await _send(ws, {"type": "tool_end", "tool": name, "output": result})
                        log_message(session_id, "tool", result[:500], tool_name=name)
                        summary_parts.append(f"{name}({list(args.keys())})")
                        current_msgs.append({"role": "assistant", "content": full_text})
                        current_msgs.append({"role": "user", "content": f"[TOOL RESULT]\n{result}"})
                    else:
                        log_message(session_id, "assistant", full_text)
                        summary_parts.append(full_text[:200])
                        break

                    if iteration == max_iters - 1:
                        await _send(ws, {"type": "token", "text": "\n\n*(Max agent iterations reached)*"})

    except Exception as e:
        await _send(ws, {"type": "token", "text": f"\n\n⚠️ Agent error: {type(e).__name__}: {e}"})

    finally:
        # End session with a brief summary
        summary = " → ".join(summary_parts[:5]) if summary_parts else ""
        end_session(session_id, summary=summary[:200])
        await _send(ws, {"type": "done"})