"""Nous FastAPI backend — the zero-cost micro-learning podcast pipeline."""
from __future__ import annotations

import asyncio
import re
import uuid
from pathlib import Path

from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import config
from models import FeedbackRequest, GenerateResponse, HealthResponse
from pipeline import audio, chunk, ingest, retrieve, script, vectorstore

app = FastAPI(title="Nous", version="0.1.0")


def _safe_name(filename: str | None) -> str:
    """Reduce an upload name to a safe basename (defends against path traversal)."""
    base = Path(filename or "upload").name
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    return base or "upload"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        ffmpeg=bool(config.FFMPEG_EXE),
        anthropic=config.HAS_ANTHROPIC,
        groq=config.HAS_GROQ,
    )


@app.post("/generate", response_model=GenerateResponse)
async def generate(
    file: UploadFile = File(...),
    topic: str = Form(...),
    user_id: str = Form("demo"),
) -> GenerateResponse:
    if not topic.strip():
        raise HTTPException(status_code=400, detail="A learning topic is required.")

    episode_id = uuid.uuid4().hex[:12]
    upload_path = config.UPLOAD_DIR / f"{episode_id}_{_safe_name(file.filename)}"
    upload_path.write_bytes(await file.read())

    try:
        raw_text = ingest.extract(upload_path)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    chunks = chunk.split(raw_text)
    if not chunks:
        raise HTTPException(status_code=422, detail="No usable text found in upload.")

    vectorstore.upsert(episode_id, chunks)
    ctx = retrieve.build_context(episode_id, topic, user_id)

    dialogue, source = script.generate(ctx)

    audio_available = False
    note: str | None = None
    try:
        await asyncio.to_thread(audio.synthesize, dialogue, episode_id)
        audio_available = True
    except Exception as exc:
        # Keep the transcript usable even if the free TTS endpoint is unavailable.
        note = (
            "Audio could not be generated right now (the free text-to-speech "
            f"service was unreachable): {exc}. The transcript is still available."
        )

    return GenerateResponse(
        id=episode_id,
        audio_url=f"/audio/{episode_id}" if audio_available else None,
        audio_available=audio_available,
        transcript=dialogue,  # type: ignore[arg-type]
        topic=topic,
        source=source,
        note=note,
    )


@app.get("/audio/{episode_id}")
def get_audio(episode_id: str) -> FileResponse:
    path = config.AUDIO_DIR / f"{episode_id}.mp3"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Episode not found.")
    return FileResponse(path, media_type="audio/mpeg", filename=f"nous_{episode_id}.mp3")


@app.post("/feedback")
def feedback(req: FeedbackRequest) -> dict:
    retrieve.record_confusion(req.user_id, req.concept.strip())
    return {"ok": True, "struggled": retrieve.get_prior_confusion(req.user_id)}
