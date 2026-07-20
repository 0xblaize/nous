"""SQLite persistence: users, episodes, spaced-repetition confusions.

Stdlib sqlite3 only — no new dependencies. One connection per call keeps
things simple and thread-safe enough for this app (uvicorn threadpool);
WAL mode avoids writer/reader lockups.
"""
from __future__ import annotations

import json
import sqlite3
import time
from contextlib import contextmanager
from typing import Any, Iterator

import config

DB_PATH = config.STORAGE_DIR / "nous.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS episodes (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    topic           TEXT NOT NULL,
    source          TEXT NOT NULL,
    transcript_json TEXT NOT NULL,
    audio_available INTEGER NOT NULL DEFAULT 0,
    created_at      REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_episodes_user ON episodes(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS confusions (
    user_id    TEXT NOT NULL,
    concept    TEXT NOT NULL,
    created_at REAL NOT NULL,
    PRIMARY KEY (user_id, concept)
);
"""


@contextmanager
def _conn() -> Iterator[sqlite3.Connection]:
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("PRAGMA foreign_keys=ON")
        yield con
        con.commit()
    finally:
        con.close()


def init() -> None:
    with _conn() as con:
        con.executescript(_SCHEMA)


# ---------- users ----------

def create_user(user_id: str, email: str, password_hash: str) -> None:
    with _conn() as con:
        con.execute(
            "INSERT INTO users (id, email, password_hash, created_at) VALUES (?,?,?,?)",
            (user_id, email, password_hash, time.time()),
        )


def get_user_by_email(email: str) -> dict[str, Any] | None:
    with _conn() as con:
        row = con.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    return dict(row) if row else None


def get_user(user_id: str) -> dict[str, Any] | None:
    with _conn() as con:
        row = con.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


# ---------- episodes ----------

def save_episode(
    episode_id: str,
    user_id: str,
    topic: str,
    source: str,
    transcript: list[dict],
    audio_available: bool,
) -> None:
    with _conn() as con:
        con.execute(
            "INSERT OR REPLACE INTO episodes "
            "(id, user_id, topic, source, transcript_json, audio_available, created_at) "
            "VALUES (?,?,?,?,?,?,?)",
            (
                episode_id,
                user_id,
                topic,
                source,
                json.dumps(transcript, ensure_ascii=False),
                int(audio_available),
                time.time(),
            ),
        )


def list_episodes(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    with _conn() as con:
        rows = con.execute(
            "SELECT id, topic, source, audio_available, created_at "
            "FROM episodes WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def get_episode(episode_id: str, user_id: str) -> dict[str, Any] | None:
    with _conn() as con:
        row = con.execute(
            "SELECT * FROM episodes WHERE id = ? AND user_id = ?",
            (episode_id, user_id),
        ).fetchone()
    if row is None:
        return None
    ep = dict(row)
    ep["transcript"] = json.loads(ep.pop("transcript_json"))
    return ep


# ---------- spaced-repetition confusions ----------

def record_confusion(user_id: str, concept: str) -> None:
    concept = concept.strip()
    if not concept:
        return
    with _conn() as con:
        con.execute(
            "INSERT OR REPLACE INTO confusions (user_id, concept, created_at) VALUES (?,?,?)",
            (user_id, concept, time.time()),
        )
        # Keep only the 5 most recent per user, matching the old JSON behavior.
        con.execute(
            "DELETE FROM confusions WHERE user_id = ? AND concept NOT IN ("
            "  SELECT concept FROM confusions WHERE user_id = ? "
            "  ORDER BY created_at DESC LIMIT 5)",
            (user_id, user_id),
        )


def get_confusions(user_id: str) -> list[str]:
    with _conn() as con:
        rows = con.execute(
            "SELECT concept FROM confusions WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return [r["concept"] for r in rows]


init()
