"""Ingestion: extract raw text from a PDF, an HTML page, or a voice note
(Groq Whisper)."""
from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import Path

import config


def _extract_pdf(path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    parts = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(parts).strip()


# Elements whose entire content should be dropped, not just the tags.
_HTML_SKIP_TAGS = {"script", "style", "noscript", "template", "svg"}
# Block-level elements — closing one should read like a paragraph break, so
# the extracted text isn't one huge run-on line.
_HTML_BLOCK_TAGS = {
    "p", "div", "section", "article", "header", "footer", "main", "aside",
    "li", "tr", "br", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre",
}


class _HTMLTextExtractor(HTMLParser):
    """Strip tags/scripts/styles from an HTML document, keep the readable
    text. Stdlib only — avoids pulling in a parsing library (bs4/lxml) just
    for this, which matters on this project's flaky pip network."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._chunks: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in _HTML_SKIP_TAGS:
            self._skip_depth += 1
        elif tag in _HTML_BLOCK_TAGS:
            self._chunks.append("\n")

    def handle_startendtag(self, tag: str, attrs) -> None:
        if tag in _HTML_BLOCK_TAGS:
            self._chunks.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in _HTML_SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1
        elif tag in _HTML_BLOCK_TAGS:
            self._chunks.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0 and data.strip():
            self._chunks.append(data)

    def text(self) -> str:
        joined = "".join(self._chunks)
        # Collapse runs of whitespace but keep paragraph breaks.
        joined = re.sub(r"[ \t]+", " ", joined)
        joined = re.sub(r"\n\s*\n+", "\n\n", joined)
        return joined.strip()


def _extract_html(path: Path) -> str:
    raw = path.read_text(encoding="utf-8", errors="ignore")
    parser = _HTMLTextExtractor()
    parser.feed(raw)
    parser.close()
    return parser.text()


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
HTML_EXTS = {".html", ".htm"}
AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac", ".mp4"}


def extract(path: str | Path) -> str:
    """Return raw text for a supported upload (PDF, HTML, or audio)."""
    path = Path(path)
    ext = path.suffix.lower()
    if ext in PDF_EXTS:
        text = _extract_pdf(path)
    elif ext in HTML_EXTS:
        text = _extract_html(path)
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
