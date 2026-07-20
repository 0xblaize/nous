"""RAG retrieval + lightweight spaced-repetition memory.

- Top-K relevant chunks for the user's topic (via ChromaDB).
- Per-user record of concepts they struggled with previously (SQLite), so the
  script can open by addressing yesterday's confusion.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import db
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


def get_prior_confusion(user_id: str) -> list[str]:
    return db.get_confusions(user_id)


def record_confusion(user_id: str, concept: str) -> None:
    db.record_confusion(user_id, concept)


def build_context(doc_id: str, topic: str, user_id: str = "demo") -> RetrievedContext:
    chunks = vectorstore.query(doc_id, topic)
    return RetrievedContext(
        topic=topic,
        chunks=chunks,
        prior_confusion=get_prior_confusion(user_id),
    )
