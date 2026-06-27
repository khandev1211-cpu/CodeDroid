"""
memory.py — SQLite-backed agent memory for CodeDroid v4.

Stores chat history, agent sessions, and file-touch logs so the agent
remembers what it worked on across restarts.

Tables:
  sessions   — one row per agent session (project + timestamp + summary)
  messages   — chat messages linked to a session
  file_log   — every file the agent touched, when, and what it did
  kv         — arbitrary key-value store for lightweight state
"""

import sqlite3
import json
import time
import os
from pathlib import Path
from typing import Optional

# DB lives alongside main.py so it's always found
_DB_PATH = Path(__file__).parent / "codedroid_memory.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # better concurrent writes
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Create tables if they don't exist. Safe to call on every startup."""
    with _connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                project     TEXT NOT NULL DEFAULT '',
                started_at  REAL NOT NULL,
                ended_at    REAL,
                summary     TEXT DEFAULT '',
                provider    TEXT DEFAULT '',
                model       TEXT DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS messages (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                role        TEXT NOT NULL,        -- user / assistant / tool
                content     TEXT NOT NULL,
                tool_name   TEXT,                 -- set for role=tool
                created_at  REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS file_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                file_path   TEXT NOT NULL,
                action      TEXT NOT NULL,        -- read / write / create / delete
                created_at  REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS kv (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_messages_session  ON messages(session_id);
            CREATE INDEX IF NOT EXISTS idx_file_log_session  ON file_log(session_id);
            CREATE INDEX IF NOT EXISTS idx_file_log_path     ON file_log(file_path);
        """)


# ── Session management ─────────────────────────────────────────────────────────

def start_session(project: str, provider: str = "", model: str = "") -> int:
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO sessions (project, started_at, provider, model) VALUES (?,?,?,?)",
            (project, time.time(), provider, model)
        )
        return cur.lastrowid  # type: ignore


def end_session(session_id: int, summary: str = "") -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE sessions SET ended_at=?, summary=? WHERE id=?",
            (time.time(), summary, session_id)
        )


def get_recent_sessions(project: str, limit: int = 5) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            """SELECT id, project, started_at, ended_at, summary, provider, model
               FROM sessions WHERE project=? ORDER BY started_at DESC LIMIT ?""",
            (project, limit)
        ).fetchall()
        return [dict(r) for r in rows]


# ── Message logging ────────────────────────────────────────────────────────────

def log_message(session_id: int, role: str, content: str, tool_name: str = "") -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO messages (session_id, role, content, tool_name, created_at) VALUES (?,?,?,?,?)",
            (session_id, role, content[:8000], tool_name, time.time())   # cap at 8k chars
        )


def get_session_messages(session_id: int) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT role, content, tool_name, created_at FROM messages WHERE session_id=? ORDER BY created_at",
            (session_id,)
        ).fetchall()
        return [dict(r) for r in rows]


# ── File touch log ─────────────────────────────────────────────────────────────

def log_file_action(session_id: int, file_path: str, action: str) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO file_log (session_id, file_path, action, created_at) VALUES (?,?,?,?)",
            (session_id, file_path, action, time.time())
        )


def get_recently_touched_files(project: str, limit: int = 20) -> list[dict]:
    """Returns files the agent touched in the last 5 sessions for this project."""
    with _connect() as conn:
        rows = conn.execute(
            """SELECT DISTINCT fl.file_path, fl.action, fl.created_at
               FROM file_log fl
               JOIN sessions s ON fl.session_id = s.id
               WHERE s.project = ?
               ORDER BY fl.created_at DESC
               LIMIT ?""",
            (project, limit)
        ).fetchall()
        return [dict(r) for r in rows]


def get_file_history(file_path: str, limit: int = 10) -> list[dict]:
    """Returns the action history for a specific file path."""
    with _connect() as conn:
        rows = conn.execute(
            """SELECT fl.action, fl.created_at, s.project, s.summary
               FROM file_log fl
               JOIN sessions s ON fl.session_id = s.id
               WHERE fl.file_path = ?
               ORDER BY fl.created_at DESC
               LIMIT ?""",
            (file_path, limit)
        ).fetchall()
        return [dict(r) for r in rows]


# ── KV store ───────────────────────────────────────────────────────────────────

def kv_set(key: str, value: any) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO kv (key, value) VALUES (?,?)",
            (key, json.dumps(value))
        )


def kv_get(key: str, default=None):
    with _connect() as conn:
        row = conn.execute("SELECT value FROM kv WHERE key=?", (key,)).fetchone()
        return json.loads(row["value"]) if row else default


def kv_delete(key: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM kv WHERE key=?", (key,))


# ── Context builder ────────────────────────────────────────────────────────────

def build_memory_context(project: str) -> str:
    """
    Returns a short memory block injected into the agent's system prompt.
    Gives the agent awareness of what it worked on previously.
    """
    sessions = get_recent_sessions(project, limit=3)
    files = get_recently_touched_files(project, limit=10)

    if not sessions and not files:
        return ""

    lines = ["## Agent memory (from previous sessions)\n"]

    if sessions:
        lines.append("**Recent sessions:**")
        for s in sessions:
            ts = time.strftime("%Y-%m-%d %H:%M", time.localtime(s["started_at"]))
            summary = s["summary"] or "(no summary)"
            lines.append(f"- {ts} [{s['provider']}/{s['model']}]: {summary}")

    if files:
        lines.append("\n**Recently touched files:**")
        for f in files[:10]:
            ts = time.strftime("%m-%d %H:%M", time.localtime(f["created_at"]))
            lines.append(f"- {f['action'].upper()} {f['file_path']} ({ts})")

    return "\n".join(lines)