"""Nous FastAPI backend — the zero-cost micro-learning podcast pipeline."""
from __future__ import annotations

import asyncio
import re
import uuid
from pathlib import Path

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import auth
import config
import db
from models import (
    AuthResponse,
    EpisodeSummary,
    FeedbackRequest,
    GenerateResponse,
    HealthResponse,
    LoginRequest,
    RegisterRequest,
)
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


# ---------- auth ----------

def current_user(authorization: str = Header(default="")) -> dict:
    """Bearer-token auth dependency. Raises 401 when missing/invalid."""
    token = authorization.removeprefix("Bearer ").strip()
    uid = auth.verify_token(token) if token else None
    user = db.get_user(uid) if uid else None
    if user is None:
        raise HTTPException(status_code=401, detail="Not signed in.")
    return user


def optional_user(authorization: str = Header(default="")) -> dict | None:
    """Like current_user but returns None instead of raising (guest mode)."""
    token = authorization.removeprefix("Bearer ").strip()
    uid = auth.verify_token(token) if token else None
    return db.get_user(uid) if uid else None


@app.post("/auth/register", response_model=AuthResponse)
def register(req: RegisterRequest) -> AuthResponse:
    email = req.email.strip().lower()
    if "@" not in email or len(email) < 4:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    if len(req.password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters.")
    if db.get_user_by_email(email) is not None:
        raise HTTPException(status_code=409, detail="That email is already registered.")
    user_id = uuid.uuid4().hex[:16]
    db.create_user(user_id, email, auth.hash_password(req.password))
    return AuthResponse(token=auth.issue_token(user_id), user_id=user_id, email=email)


@app.post("/auth/login", response_model=AuthResponse)
def login(req: LoginRequest) -> AuthResponse:
    user = db.get_user_by_email(req.email.strip().lower())
    if user is None or not auth.verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Wrong email or password.")
    return AuthResponse(
        token=auth.issue_token(user["id"]), user_id=user["id"], email=user["email"]
    )


@app.get("/auth/me")
def me(user: dict = Depends(current_user)) -> dict:
    return {"user_id": user["id"], "email": user["email"]}


@app.get("/episodes", response_model=list[EpisodeSummary])
def episodes(user: dict = Depends(current_user)) -> list[EpisodeSummary]:
    return [EpisodeSummary(**e) for e in db.list_episodes(user["id"])]


@app.get("/episodes/{episode_id}")
def episode_detail(episode_id: str, user: dict = Depends(current_user)) -> dict:
    ep = db.get_episode(episode_id, user["id"])
    if ep is None:
        raise HTTPException(status_code=404, detail="Episode not found.")
    audio_ok = bool(ep["audio_available"]) and (config.AUDIO_DIR / f"{episode_id}.mp3").exists()
    return {
        "id": ep["id"],
        "topic": ep["topic"],
        "source": ep["source"],
        "transcript": ep["transcript"],
        "audio_available": audio_ok,
        "audio_url": f"/audio/{episode_id}" if audio_ok else None,
        "created_at": ep["created_at"],
        "note": None,
    }


@app.post("/generate", response_model=GenerateResponse)
async def generate(
    file: UploadFile = File(...),
    topic: str = Form(...),
    user_id: str = Form("demo"),
    user: dict | None = Depends(optional_user),
) -> GenerateResponse:
    if not topic.strip():
        raise HTTPException(status_code=400, detail="A learning topic is required.")
    if user is not None:
        user_id = user["id"]  # signed-in identity wins over the form value

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

    if user is not None:
        db.save_episode(episode_id, user["id"], topic, source, dialogue, audio_available)

    return GenerateResponse(
        id=episode_id,
        audio_url=f"/audio/{episode_id}" if audio_available else None,
        audio_available=audio_available,
        transcript=dialogue,  # type: ignore[arg-type]
        topic=topic,
        source=source,
        note=note,
    )


@app.post("/upload")
async def upload(file: UploadFile = File(...)) -> dict:
    """Stage a file for a subsequent WS generation. WebSockets can't carry a
    multipart upload cleanly, so the browser POSTs the file here first, gets an
    episode_id, then opens /ws/generate to stream progress."""
    episode_id = uuid.uuid4().hex[:12]
    upload_path = config.UPLOAD_DIR / f"{episode_id}_{_safe_name(file.filename)}"
    upload_path.write_bytes(await file.read())
    return {"episode_id": episode_id, "filename": upload_path.name}


def _find_upload(episode_id: str) -> Path | None:
    """Locate the staged upload for an episode id (requires a hex id so the
    glob can't be steered by hostile input)."""
    if not re.fullmatch(r"[0-9a-f]{12}", episode_id):
        return None
    matches = sorted(config.UPLOAD_DIR.glob(f"{episode_id}_*"))
    return matches[0] if matches else None


async def _run_pipeline(
    episode_id: str,
    upload_path: Path,
    topic: str,
    user_id: str,
    emit,
) -> dict:
    """Pipeline driver for the WS handler. `emit(event, **data)` streams a
    progress event to the client. Blocking steps run on a threadpool so the
    event loop (and the socket) stays responsive. Returns the final payload."""
    await emit("stage", stage="ingest", label="Reading your document")
    raw_text = await asyncio.to_thread(ingest.extract, upload_path)

    await emit("stage", stage="chunk", label="Breaking it into ideas")
    chunks = await asyncio.to_thread(chunk.split, raw_text)
    if not chunks:
        raise ValueError("No usable text found in upload.")

    await emit("stage", stage="embed", label="Building a memory")
    await asyncio.to_thread(vectorstore.upsert, episode_id, chunks)

    await emit("stage", stage="retrieve", label="Finding what matters")
    ctx = await asyncio.to_thread(retrieve.build_context, episode_id, topic, user_id)

    await emit("stage", stage="script", label="Writing the conversation")
    dialogue, source = await asyncio.to_thread(script.generate, ctx)
    await emit("script", transcript=dialogue, source=source)

    audio_available = False
    note: str | None = None
    await emit("stage", stage="audio", label="Giving the hosts a voice")

    async def _tts_progress(done: int, total: int) -> None:
        await emit("tts_progress", done=done, total=total)

    try:
        await audio.synthesize_async(dialogue, episode_id, _tts_progress)
        audio_available = True
    except Exception as exc:  # noqa: BLE001
        note = (
            "Audio could not be generated right now (the free text-to-speech "
            f"service was unreachable): {exc}. The transcript is still available."
        )

    return {
        "id": episode_id,
        "audio_url": f"/audio/{episode_id}" if audio_available else None,
        "audio_available": audio_available,
        "transcript": dialogue,
        "topic": topic,
        "source": source,
        "note": note,
    }


@app.websocket("/ws/generate")
async def ws_generate(websocket: WebSocket) -> None:
    """Stream a generation. Client flow:
      1. POST /upload -> {episode_id}
      2. open this socket, send {"episode_id", "topic", "user_id"?}
      3. receive {"event": ...} messages, ending in `done` or `error`.
    """
    await websocket.accept()

    async def emit(event: str, **data) -> None:
        await websocket.send_json({"event": event, **data})

    try:
        try:
            req = await websocket.receive_json()
        except WebSocketDisconnect:
            return
        except Exception:  # noqa: BLE001 - malformed JSON / wrong frame type
            await emit("error", detail="Expected a JSON object as the first message.")
            return
        if not isinstance(req, dict):
            await emit("error", detail="Expected a JSON object as the first message.")
            return

        episode_id = str(req.get("episode_id", "")).strip()
        topic = str(req.get("topic", "")).strip()
        user_id = str(req.get("user_id", "demo")).strip() or "demo"

        # Signed-in identity (token in the first message) wins over user_id.
        token = str(req.get("token", "")).strip()
        uid = auth.verify_token(token) if token else None
        ws_user = db.get_user(uid) if uid else None
        if ws_user is not None:
            user_id = ws_user["id"]

        if not topic:
            await emit("error", detail="A learning topic is required.")
            return
        upload_path = _find_upload(episode_id)
        if upload_path is None:
            await emit("error", detail="Upload not found — POST /upload first.")
            return

        await emit("accepted", episode_id=episode_id)
        try:
            result = await _run_pipeline(episode_id, upload_path, topic, user_id, emit)
        except ValueError as exc:
            await emit("error", detail=str(exc))
            return
        except WebSocketDisconnect:
            return  # client left mid-pipeline; stop quietly
        except Exception as exc:  # noqa: BLE001
            try:
                await emit("error", detail=f"Generation failed: {exc}")
            except Exception:  # noqa: BLE001 - socket may already be gone
                pass
            return

        if ws_user is not None:
            db.save_episode(
                episode_id,
                ws_user["id"],
                topic,
                result["source"],
                result["transcript"],
                result["audio_available"],
            )

        await emit("done", **result)
    except WebSocketDisconnect:
        return  # client went away mid-stream; nothing to clean up
    finally:
        try:
            await websocket.close()
        except RuntimeError:
            pass  # already closed


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
