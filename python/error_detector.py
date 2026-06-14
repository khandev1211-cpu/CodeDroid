"""
CodeDroid Error Detector — parses terminal output into structured error info.
Used by the agent auto-fix loop in main.py.
"""
import re
from typing import Optional

# ─── Error patterns ────────────────────────────────────────────────────────────
ERROR_PATTERNS: dict[str, list[str]] = {
    "syntax_error": [
        r"SyntaxError", r"IndentationError", r"ParseError",
        r"Unexpected token", r"Cannot parse", r"unexpected EOF",
    ],
    "runtime_error": [
        r"TypeError", r"ValueError", r"AttributeError",
        r"ReferenceError", r"NullPointerException", r"Segmentation fault",
        r"ZeroDivisionError", r"KeyError", r"IndexError", r"NameError",
    ],
    "import_error": [
        r"ModuleNotFoundError", r"ImportError", r"Cannot find module",
        r"No module named", r"Module not found",
    ],
    "dependency_error": [
        r"npm ERR!", r"pip.*error", r"Package.*not found",
        r"ENOENT.*node_modules", r"yarn error",
    ],
    "permission_error": [
        r"Permission denied", r"EACCES", r"Access is denied",
    ],
    "port_error": [
        r"EADDRINUSE", r"address already in use", r"port.*in use",
    ],
    "build_error": [
        r"error TS\d+", r"Build failed", r"Compilation error",
        r"webpack.*error", r"vite.*error", r"error\[E\d+\]",
    ],
    "test_error": [
        r"FAIL ", r"✕ ", r"● ", r"AssertionError", r"Expected.*received",
        r"FAILED.*::", r"pytest.*failed",
    ],
}

# ─── File location extraction patterns ────────────────────────────────────────
# Each tuple: (regex, group mapping)
_LOCATION_PATTERNS = [
    # Python:  File "src/main.py", line 42, in <module>
    (r'File "([^"]+)", line (\d+)', {"file": 1, "line": 2, "col": None}),
    # Node/TS: src/utils/helper.ts:24:8 - error TS2345
    (r'([^\s:]+\.[a-z]{2,4}):(\d+):(\d+)', {"file": 1, "line": 2, "col": 3}),
    # Rust:    error[E0382]: src/lib.rs:15:5
    (r'error\[E\d+\]:[^\n]*?([^\s:]+\.[a-z]{2,4}):(\d+):(\d+)', {"file": 1, "line": 2, "col": 3}),
    # Generic: at line 10, column 3
    (r'at line (\d+), column (\d+)', {"file": None, "line": 1, "col": 2}),
    # Java:    at com.example.Main.main(Main.java:42)
    (r'at \S+\((\S+\.java):(\d+)\)', {"file": 1, "line": 2, "col": None}),
    # Generic "error at X:Y"
    (r'([^\s]+\.[a-z]{2,4}) line (\d+)', {"file": 1, "line": 2, "col": None}),
]

# ─── Error message extraction ──────────────────────────────────────────────────
_MESSAGE_PATTERNS = [
    # Python full error line
    r"((?:Syntax|Type|Value|Attribute|Name|Import|Module|Key|Index|Zero)Error[:\s][^\n]+)",
    # TypeScript  "error TS2345: ..."
    r"error TS\d+:\s*([^\n]+)",
    # Rust   "error[E0382]: ..."
    r"error\[E\d+\]:\s*([^\n]+)",
    # npm    "npm ERR! ..."
    r"npm ERR!\s*([^\n]+)",
    # Generic  "Error: ..."
    r"Error:\s*([^\n]+)",
    # Jest  "● Test..."
    r"●\s+([^\n]+)",
]

# ─── Public API ───────────────────────────────────────────────────────────────

def detect_error(output: str) -> dict:
    """
    Returns:
      {
        has_error: bool,
        error_type: str | None,
        error_message: str | None,
        file_path: str | None,
        line_number: int | None,
        column: int | None,
        stack_trace: str | None,
      }
    """
    if not output or not output.strip():
        return _no_error()

    error_type = _classify(output)
    if error_type is None:
        return _no_error()

    location = _extract_location(output)
    message  = _extract_message(output)
    trace    = _extract_trace(output)

    return {
        "has_error":     True,
        "error_type":    error_type,
        "error_message": message,
        "file_path":     location.get("file"),
        "line_number":   location.get("line"),
        "column":        location.get("col"),
        "stack_trace":   trace,
    }


def is_error_paste(text: str) -> bool:
    """Return True if text looks like a pasted error (≥2 pattern categories match)."""
    matches = 0
    for patterns in ERROR_PATTERNS.values():
        if any(re.search(p, text, re.IGNORECASE) for p in patterns):
            matches += 1
            if matches >= 2:
                return True
    return False


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _no_error() -> dict:
    return {
        "has_error": False, "error_type": None, "error_message": None,
        "file_path": None, "line_number": None, "column": None, "stack_trace": None,
    }


def _classify(output: str) -> Optional[str]:
    for error_type, patterns in ERROR_PATTERNS.items():
        for p in patterns:
            if re.search(p, output, re.IGNORECASE):
                return error_type
    return None


def _extract_location(output: str) -> dict:
    for pattern, groups in _LOCATION_PATTERNS:
        m = re.search(pattern, output, re.IGNORECASE)
        if m:
            result: dict = {}
            if groups["file"] is not None:
                result["file"] = m.group(groups["file"])
            if groups["line"] is not None:
                try:
                    result["line"] = int(m.group(groups["line"]))
                except (IndexError, ValueError):
                    pass
            if groups["col"] is not None:
                try:
                    result["col"] = int(m.group(groups["col"]))
                except (IndexError, ValueError):
                    pass
            return result
    return {}


def _extract_message(output: str) -> Optional[str]:
    for pattern in _MESSAGE_PATTERNS:
        m = re.search(pattern, output, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    # Fallback: first non-empty line that contains "error"
    for line in output.splitlines():
        if "error" in line.lower() and line.strip():
            return line.strip()[:200]
    return None


def _extract_trace(output: str) -> Optional[str]:
    """Return the portion of output that looks like a stack trace (up to 2000 chars)."""
    lines = output.splitlines()
    trace_lines = []
    in_trace = False
    for line in lines:
        if re.search(r'Traceback|stack trace|at \S+\(|^\s+at ', line, re.IGNORECASE):
            in_trace = True
        if in_trace:
            trace_lines.append(line)
            if len("\n".join(trace_lines)) > 2000:
                break
    return "\n".join(trace_lines) if trace_lines else None