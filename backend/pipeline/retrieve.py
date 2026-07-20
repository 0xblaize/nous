"""RAG retrieval + lightweight spaced-repetition memory.

- Top-K relevant chunks for the user's topic (via ChromaDB).
- Per-user record of concepts they struggled with previously, so the script
  can open by addressing yesterday's confusion.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field

import config
from pipeline import vectorstore


@dataclass
class RetrievedContext:
    topic: str
    chunks: list[str] = field(default_factory=list)
    prior_confusion: list[str] = field(default_factory=list)

    @property
    def joined_chunks(self) -> str:
        return "\n\n---\n\n".join(self.chunks) if self.chunks else "(no source text found)"

    @property
    def joined_confusion(self) -> str:
        return ", ".join(self.prior_confusion) if self.prior_confusion else "(none recorded)"


def _load_memory() -> dict:
    if config.MEMORY_FILE.exists():
        try:
            return json.loads(config.MEMORY_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _save_memory(data: dict) -> None:
    config.MEMORY_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def get_prior_confusion(user_id: str) -> list[str]:
    return _load_memory().get(user_id, {}).get("struggled", [])


def record_confusion(user_id: str, concept: str) -> None:
    data = _load_memory()
    user = data.setdefault(user_id, {"struggled": []})
    if concept and concept not in user["struggled"]:
        user["struggled"].append(concept)
    # Keep the tail bounded to the most recent few concepts.
    user["struggled"] = user["struggled"][-5:]
    _save_memory(data)


def build_context(doc_id: str, topic: str, user_id: str = "demo") -> RetrievedContext:
    chunks = vectorstore.query(doc_id, topic)
    return RetrievedContext(
        topic=topic,
        chunks=chunks,
        prior_confusion=get_prior_confusion(user_id),
    )
