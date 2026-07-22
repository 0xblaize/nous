"""Persistence: users, episodes, spaced-repetition confusions.

Two backends, chosen by config.DATABASE_URL:
  - Empty (default): local SQLite file under STORAGE_DIR. Zero setup, but
    wiped on any host with an ephemeral disk (Render/Railway free tiers).
  - Set to a Postgres URL (e.g. Neon): persists across redeploys. Free tier
    fix for accounts disappearing after every deploy.

The public functions below (create_user, get_user, save_episode, ...) behave
identically either way; only this module knows which engine is underneath.
"""
from __future__ import annotations

import json
import sqlite3
import time
from contextlib import contextmanager
from typing import Any, Iterator

import config

USING_POSTGRES = bool(config.DATABASE_URL)

if USING_POSTGRES:
    import psycopg2
    import psycopg2.extras
else:
    DB_PATH = config.STORAGE_DIR / "nous.db"

_SCHEMA_SQLITE = """
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

# Postgres has no COLLATE NOCASE; the app always lowercases emails before
# storing/looking them up (see main.py), so a plain UNIQUE constraint is
# enough for correctness.
_SCHEMA_POSTGRES = """
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS episodes (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    topic           TEXT NOT NULL,
    source          TEXT NOT NULL,
    transcript_json TEXT NOT NULL,
    audio_available INTEGER NOT NULL DEFAULT 0,
    created_at      DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_episodes_user ON episodes(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS confusions (
    user_id    TEXT NOT NULL,
    concept    TEXT NOT NULL,
    created_at DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (user_id, concept)
);
"""


class _PGConn:
    """Wraps a psycopg2 connection so calling code can use .execute(...) /
    .executescript(...) exactly like sqlite3.Connection, regardless of which
    backend is active."""

    def __init__(self, raw):
        self._raw = raw
        self._cur = raw.cursor()

    def execute(self, sql: str, params: tuple = ()):
        self._cur.execute(sql.replace("?", "%s"), params)
        return self._cur

    def executescript(self, sql: str) -> None:
        self._cur.execute(sql)

    def commit(self) -> None:
        self._raw.commit()

    def close(self) -> None:
        self._cur.close()
        self._raw.close()


@contextmanager
def _conn() -> Iterator[Any]:
    if USING_POSTGRES:
        raw = psycopg2.connect(
            config.DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor
        )
        con = _PGConn(raw)
        try:
            yield con
            con.commit()
        finally:
            con.close()
    else:
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
        con.executescript(_SCHEMA_POSTGRES if USING_POSTGRES else _SCHEMA_SQLITE)


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
    transcript_json = json.dumps(transcript, ensure_ascii=False)
    created_at = time.time()
    with _conn() as con:
        if USING_POSTGRES:
            con.execute(
                "INSERT INTO episodes "
                "(id, user_id, topic, source, transcript_json, audio_available, created_at) "
                "VALUES (?,?,?,?,?,?,?) "
                "ON CONFLICT (id) DO UPDATE SET "
                "user_id=EXCLUDED.user_id, topic=EXCLUDED.topic, source=EXCLUDED.source, "
                "transcript_json=EXCLUDED.transcript_json, "
                "audio_available=EXCLUDED.audio_available, created_at=EXCLUDED.created_at",
                (episode_id, user_id, topic, source, transcript_json, int(audio_available), created_at),
            )
        else:
            con.execute(
                "INSERT OR REPLACE INTO episodes "
                "(id, user_id, topic, source, transcript_json, audio_available, created_at) "
                "VALUES (?,?,?,?,?,?,?)",
                (episode_id, user_id, topic, source, transcript_json, int(audio_available), created_at),
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
        if USING_POSTGRES:
            con.execute(
                "INSERT INTO confusions (user_id, concept, created_at) VALUES (?,?,?) "
                "ON CONFLICT (user_id, concept) DO UPDATE SET created_at=EXCLUDED.created_at",
                (user_id, concept, time.time()),
            )
        else:
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
