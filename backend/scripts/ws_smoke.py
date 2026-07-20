"""End-to-end test of the WebSocket generation flow.

Usage: python scripts/ws_smoke.py [path-to-file] [topic]
Requires the server running on 127.0.0.1:8000.

Flow: POST /upload -> WS /ws/generate -> print streamed events -> verify audio.
"""
from __future__ import annotations

import asyncio
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

BASE = "http://127.0.0.1:8000"
WS_URL = "ws://127.0.0.1:8000/ws/generate"


def post_upload(path: Path) -> str:
    """Multipart POST without external deps."""
    boundary = "----nousws"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{BASE}/upload",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    print(f"[upload] episode_id={data['episode_id']} filename={data['filename']}")
    return data["episode_id"]


async def run_ws(episode_id: str, topic: str) -> dict:
    import websockets

    async with websockets.connect(WS_URL, max_size=8 * 1024 * 1024) as ws:
        await ws.send(json.dumps({"episode_id": episode_id, "topic": topic, "user_id": "wstest"}))
        last_tts = 0
        async for raw in ws:
            msg = json.loads(raw)
            event = msg.get("event")
            if event == "tts_progress":
                # print sparsely so the log stays readable
                if msg["done"] == msg["total"] or msg["done"] - last_tts >= 10:
                    last_tts = msg["done"]
                    print(f"[tts] {msg['done']}/{msg['total']}")
            elif event == "script":
                print(f"[script] source={msg['source']} lines={len(msg['transcript'])}")
            elif event == "stage":
                print(f"[stage] {msg['stage']}: {msg['label']}")
            elif event == "done":
                print(f"[done] audio_available={msg['audio_available']} url={msg['audio_url']}")
                return msg
            elif event == "error":
                raise SystemExit(f"[error] {msg['detail']}")
            else:
                print(f"[{event}] {msg}")
    raise SystemExit("socket closed without a done event")


def verify_audio(result: dict) -> None:
    if not result["audio_available"]:
        print(f"WARN: no audio ({result.get('note')})")
        return
    with urllib.request.urlopen(f"{BASE}{result['audio_url']}", timeout=30) as resp:
        data = resp.read()
    ok = data[:3] == b"ID3" or (data[0] == 0xFF and (data[1] & 0xE0) == 0xE0)
    print(f"[audio] {len(data)} bytes, valid mp3 header: {ok}")
    if not ok:
        raise SystemExit("downloaded audio is not a valid MP3")


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    topic = sys.argv[2] if len(sys.argv) > 2 else "Explain the key idea simply"
    if src is None:
        src = Path(__file__).parent / "_ws_sample.txt"
        src.write_text(
            "Photosynthesis is the process by which green plants use sunlight, "
            "water and carbon dioxide to create oxygen and energy in the form of "
            "sugar. Chlorophyll in the chloroplasts absorbs light energy, which "
            "drives the light reactions producing ATP and NADPH; the Calvin "
            "cycle then fixes carbon dioxide into glucose.",
            encoding="utf-8",
        )
    episode_id = post_upload(src)
    result = asyncio.run(run_ws(episode_id, topic))
    verify_audio(result)
    print("WS SMOKE PASSED")


if __name__ == "__main__":
    main()
