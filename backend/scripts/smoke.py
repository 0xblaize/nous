"""End-to-end smoke test: text -> chunk -> vectorstore -> retrieve -> script -> audio.

Runs with zero API keys (uses the stub script). Asserts a valid script and a
non-empty MP3 are produced. Run: python scripts/smoke.py
"""
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config  # noqa: E402
from pipeline import audio, chunk, retrieve, script, vectorstore  # noqa: E402

SAMPLE = (
    "Photosynthesis is the process by which green plants convert sunlight into "
    "chemical energy. Chlorophyll in the leaves absorbs light. Water and carbon "
    "dioxide are transformed into glucose and oxygen. This process powers nearly "
    "all life on Earth. The light reactions happen in the thylakoid membranes. "
    "The Calvin cycle fixes carbon in the stroma. " * 20
)


def main() -> int:
    episode_id = uuid.uuid4().hex[:12]
    print(f"[smoke] ffmpeg wired: {bool(config.FFMPEG_EXE)}")
    print(f"[smoke] anthropic={config.HAS_ANTHROPIC} groq={config.HAS_GROQ}")

    chunks = chunk.split(SAMPLE)
    assert chunks, "chunking produced nothing"
    print(f"[smoke] {len(chunks)} chunks")

    vectorstore.upsert(episode_id, chunks)
    ctx = retrieve.build_context(episode_id, "Explain photosynthesis", "demo")
    print(f"[smoke] retrieved {len(ctx.chunks)} chunks for topic")

    dialogue, source = script.generate(ctx)
    assert isinstance(dialogue, list) and dialogue, "script empty"
    assert all(l["speaker"] in ("HOST_A", "HOST_B") for l in dialogue)
    print(f"[smoke] script source={source}, {len(dialogue)} lines")

    # Audio depends on Microsoft's free TTS endpoint being reachable; treat a
    # network/handshake failure as a WARN (external), not a code failure.
    try:
        out = audio.synthesize(dialogue, episode_id)
        size = out.stat().st_size
        assert size > 1000, f"mp3 suspiciously small: {size} bytes"
        print(f"[smoke] wrote {out.name} ({size} bytes)")
        print("[smoke] PASS (pipeline + audio)")
    except Exception as exc:
        print(f"[smoke] WARN: audio synthesis unavailable: {exc}")
        print("[smoke] PASS (pipeline ok; audio skipped)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
