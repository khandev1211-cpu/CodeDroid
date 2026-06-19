"""
CodeDroid Thinking Detector
Determines when to use extended reasoning, and per-provider thinking implementations.
"""
import re
from typing import Optional

# ─── Trigger keyword lists ────────────────────────────────────────────────────
COMPLEXITY_KEYWORDS = [
    "architect", "design system", "refactor entire", "optimize",
    "debug", "why is this", "best approach", "how should i",
    "compare", "tradeoff", "performance issue", "race condition",
    "memory leak", "security vulnerability", "algorithm",
]
TASK_KEYWORDS = [
    "multi-file", "entire codebase", "from scratch",
    "production ready", "scalable", "enterprise",
]
QUESTION_INDICATORS = [
    "why", "how", "what is the best", "should i",
    "explain", "help me understand", "what causes",
]

# Models that have native <think>...</think> token output
NATIVE_THINKING_MODELS = {
    # Groq
    "deepseek-r1-distill-llama-70b", "deepseek-r1-distill-llama-8b",
    "qwen-qwq-32b", "qwen-qwq-32b-preview",
    # Ollama (partial names — checked with `in`)
    "deepseek-r1", "qwq", "phi4-reasoning", "phi4", "qwq-32b",
    # Gemini
    "gemini-2.0-flash-thinking", "gemini-2.5-flash", "gemini-2.5-pro",
}

# CoT system prompt prefix injected for non-native models
COT_SYSTEM_PREFIX = (
    "Before answering, reason step-by-step inside <thinking> tags:\n"
    "<thinking>\n"
    "1. What exactly is being asked?\n"
    "2. What are the key constraints and requirements?\n"
    "3. What approach would work best and why?\n"
    "4. What edge cases should I consider?\n"
    "5. What is my step-by-step plan?\n"
    "</thinking>\n\n"
    "Now provide your answer based on your analysis above:\n"
)


def should_use_thinking(prompt: str, mode: str) -> bool:
    """Return True when the request is complex enough to benefit from thinking mode."""
    p = prompt.lower()

    # Agent mode: think if prompt is more than 20 words
    if mode == "agent" and len(prompt.split()) > 20:
        return True

    count = sum(
        1 for kw in COMPLEXITY_KEYWORDS + TASK_KEYWORDS + QUESTION_INDICATORS
        if kw in p
    )
    return count >= 2


def is_native_thinking_model(model: str) -> bool:
    """Check if a model outputs <think> tags natively."""
    m = model.lower()
    return any(nm in m for nm in NATIVE_THINKING_MODELS)


def extract_think_tags(raw: str) -> tuple[str, str]:
    """
    Split raw model output into (thinking, answer).
    Handles <think>...</think> and <thinking>...</thinking>.
    """
    # Try <think> first, then <thinking>
    for tag in ("think", "thinking"):
        pattern = rf"<{tag}>(.*?)</{tag}>"
        m = re.search(pattern, raw, re.DOTALL | re.IGNORECASE)
        if m:
            thinking = m.group(1).strip()
            answer = raw[:m.start()] + raw[m.end():]
            return thinking, answer.strip()
    return "", raw.strip()


def inject_cot_into_system(system: str) -> str:
    """Prepend CoT instructions to a system prompt for non-native models."""
    return COT_SYSTEM_PREFIX + system


# ─── Token limit / truncation detection ──────────────────────────────────────

def was_response_truncated(finish_reason: str, provider: str) -> bool:
    """
    Given the finish_reason string from a provider response,
    return True if the response was cut off by the token limit.
    """
    truncation_reasons = {
        "groq":   {"length"},
        "claude": {"max_tokens"},
        "gemini": {"MAX_TOKENS", "max_tokens"},
        "ollama": {"length"},
    }
    reasons = truncation_reasons.get(provider, set())
    return finish_reason in reasons


def has_incomplete_code_block(text: str) -> bool:
    """Return True if text has an unclosed ``` code block."""
    return text.count("```") % 2 != 0


def merge_continuations(part1: str, part2: str) -> str:
    """Merge a truncated response with its continuation cleanly."""
    if has_incomplete_code_block(part1):
        return part1 + part2
    # Strip leading blank lines from continuation
    return part1 + "\n" + part2.lstrip("\n")