"""Split raw text into ~500-word chunks."""
from __future__ import annotations

import config


def split(text: str, words_per_chunk: int | None = None) -> list[str]:
    words_per_chunk = words_per_chunk or config.CHUNK_WORDS
    words = text.split()
    if not words:
        return []
    chunks = [
        " ".join(words[i : i + words_per_chunk])
        for i in range(0, len(words), words_per_chunk)
    ]
    return chunks
