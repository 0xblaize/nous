"""Ingestion: extract raw text from a PDF (pypdf) or a voice note (Groq Whisper)."""
from __future__ import annotations

from pathlib import Path

import config


def _extract_pdf(path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    parts = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(parts).strip()


def _transcribe_audio(path: Path) -> str:
    if not config.HAS_GROQ:
        raise RuntimeError(
            "Voice transcription needs GROQ_API_KEY. Add it to backend/.env "
            "or upload a PDF instead."
        )
    from groq import Groq

    client = Groq(api_key=config.GROQ_API_KEY)
    with open(path, "rb") as f:
        result = client.audio.transcriptions.create(
            file=(path.name, f.read()),
            model=config.GROQ_WHISPER_MODEL,
        )
    return (result.text or "").strip()


PDF_EXTS = {".pdf"}
AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac", ".mp4"}


def extract(path: str | Path) -> str:
    """Return raw text for a supported upload (PDF or audio)."""
    path = Path(path)
    ext = path.suffix.lower()
    if ext in PDF_EXTS:
        text = _extract_pdf(path)
    elif ext in AUDIO_EXTS:
        text = _transcribe_audio(path)
    else:
        # Fall back to plain-text read for .txt / .md and anything utf-8 decodable.
        try:
            text = path.read_text(encoding="utf-8", errors="ignore").strip()
        except Exception as exc:  # pragma: no cover - defensive
            raise RuntimeError(f"Unsupported file type: {ext}") from exc

    if not text:
        raise RuntimeError(
            "Could not extract any text from the upload. If it's a scanned PDF, "
            "it may have no embedded text layer."
        )
    return text
