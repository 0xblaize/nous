"""Audio synthesis: edge-tts per speaker -> pydub concatenation -> single MP3.

edge-tts talks to Microsoft's public speech websocket, which can intermittently
return 403 (Sec-MS-GEC token) or rate-limit. We retry each line a few times with
backoff. If synthesis ultimately fails, the caller keeps the transcript so the
experience still works.
"""
from __future__ import annotations

import asyncio
import io
from pathlib import Path

import config


class AudioSynthesisError(RuntimeError):
    """Raised when TTS could not produce any audio after retries."""


async def _tts_bytes(text: str, voice: str, attempts: int = 4) -> bytes:
    """Synthesize one line and return the MP3 bytes (avoids Windows file locks)."""
    import edge_tts

    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            communicate = edge_tts.Communicate(text, voice)
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


async def _synthesize_async(dialogue: list[dict], out_path: Path) -> None:
    from pydub import AudioSegment

    combined = AudioSegment.silent(duration=300)
    gap = AudioSegment.silent(duration=250)  # small breath between lines

    for line in dialogue:
        voice = (
            config.HOST_A_VOICE
            if line["speaker"] == "HOST_A"
            else config.HOST_B_VOICE
        )
        mp3_bytes = await _tts_bytes(line["text"], voice)
        segment = AudioSegment.from_file(io.BytesIO(mp3_bytes), format="mp3")
        combined += segment + gap

    combined.export(out_path, format="mp3")


def synthesize(dialogue: list[dict], episode_id: str) -> Path:
    """Render the dialogue to storage/audio/<episode_id>.mp3 and return its path.

    Runs its own event loop via asyncio.run(), so call it from a plain thread
    (e.g. FastAPI's threadpool via asyncio.to_thread), never from inside a
    running loop.

    Raises AudioSynthesisError if no audio could be produced.
    """
    out_path = config.AUDIO_DIR / f"{episode_id}.mp3"
    asyncio.run(_synthesize_async(dialogue, out_path))
    if not out_path.exists() or out_path.stat().st_size == 0:
        raise AudioSynthesisError("No audio file was produced.")
    return out_path
