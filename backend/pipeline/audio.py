"""Audio synthesis: edge-tts per speaker -> pydub concatenation -> single MP3.

edge-tts talks to Microsoft's public speech websocket, which can intermittently
return 403 (Sec-MS-GEC token) or rate-limit. We retry each line a few times with
backoff. If synthesis ultimately fails, the caller keeps the transcript so the
experience still works.
"""
from __future__ import annotations

import asyncio
import io
import random
from pathlib import Path
from typing import Awaitable, Callable

import config


class AudioSynthesisError(RuntimeError):
    """Raised when TTS could not produce any audio after retries."""


# An async progress hook: on_progress(done, total) is awaited after each line.
ProgressHook = Callable[[int, int], Awaitable[None]]

# Slight rate/pitch offsets per host so the two voices feel distinct and less
# like a flat text-to-speech reading, without sounding sped up or slurred.
_VOICE_TUNING = {
    "HOST_A": {"rate": "-4%", "pitch": "-2Hz"},
    "HOST_B": {"rate": "-2%", "pitch": "+3Hz"},
}


async def _tts_bytes(text: str, voice: str, speaker: str, attempts: int = 4) -> bytes:
    """Synthesize one line and return the MP3 bytes (avoids Windows file locks)."""
    import edge_tts

    tuning = _VOICE_TUNING.get(speaker, {})
    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            communicate = edge_tts.Communicate(
                text,
                voice,
                rate=tuning.get("rate", "+0%"),
                pitch=tuning.get("pitch", "+0Hz"),
            )
            buf = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    buf.extend(chunk["data"])
            if buf:
                return bytes(buf)
            raise AudioSynthesisError("edge-tts returned no audio data")
        except Exception as exc:  # noqa: BLE001 - network/handshake errors vary
            last_exc = exc
            await asyncio.sleep(0.6 * (attempt + 1))
    raise AudioSynthesisError(f"TTS failed for a line after {attempts} attempts: {last_exc}")


async def _synthesize_async(
    dialogue: list[dict],
    out_path: Path,
    on_progress: ProgressHook | None = None,
) -> None:
    from pydub import AudioSegment

    combined = AudioSegment.silent(duration=120)
    total = len(dialogue)

    for i, line in enumerate(dialogue, start=1):
        speaker = line["speaker"]
        voice = config.HOST_A_VOICE if speaker == "HOST_A" else config.HOST_B_VOICE
        mp3_bytes = await _tts_bytes(line["text"], voice, speaker)
        segment = AudioSegment.from_file(io.BytesIO(mp3_bytes), format="mp3")
        # Keep the gap between lines short and tight, a real back-and-forth
        # conversation has almost no dead air. A touch more room on a speaker
        # change stops words from running together; same speaker continuing
        # gets barely a breath.
        next_speaker = dialogue[i]["speaker"] if i < total else None
        turn_changes = next_speaker is not None and next_speaker != speaker
        gap_ms = random.randint(70, 110) if turn_changes else random.randint(20, 50)
        combined += segment + AudioSegment.silent(duration=gap_ms)
        if on_progress is not None:
            await on_progress(i, total)

    combined.export(out_path, format="mp3")


async def synthesize_async(
    dialogue: list[dict],
    episode_id: str,
    on_progress: ProgressHook | None = None,
) -> Path:
    """Async render — call this from code that already runs in an event loop
    (e.g. the WebSocket handler). Awaits `on_progress(done, total)` per line so
    callers can stream live TTS progress.

    Raises AudioSynthesisError if no audio could be produced.
    """
    out_path = config.AUDIO_DIR / f"{episode_id}.mp3"
    await _synthesize_async(dialogue, out_path, on_progress)
    if not out_path.exists() or out_path.stat().st_size == 0:
        raise AudioSynthesisError("No audio file was produced.")
    return out_path


def synthesize(dialogue: list[dict], episode_id: str) -> Path:
    """Render the dialogue to storage/audio/<episode_id>.mp3 and return its path.

    Runs its own event loop via asyncio.run(), so call it from a plain thread
    (e.g. FastAPI's threadpool via asyncio.to_thread), never from inside a
    running loop. For code already inside a loop, use synthesize_async().

    Raises AudioSynthesisError if no audio could be produced.
    """
    out_path = config.AUDIO_DIR / f"{episode_id}.mp3"
    asyncio.run(_synthesize_async(dialogue, out_path))
    if not out_path.exists() or out_path.stat().st_size == 0:
        raise AudioSynthesisError("No audio file was produced.")
    return out_path
