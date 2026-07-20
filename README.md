# Nous — the zero-cost micro-learning podcast

Upload a PDF (or a voice note); Nous turns it into a short, two-host audio
conversation — an **Expert** and a **Learner** — that walks you through the
material. RAG over your document keeps the hosts on-topic, and a lightweight
memory lets today's episode address what confused you yesterday.

Built to run entirely on free tiers, inside this one folder.

```
Upload ─▶ Extract (pypdf / Groq Whisper) ─▶ Chunk (500 words)
      ─▶ Embed + store (ChromaDB, local) ─▶ Retrieve top-3 + prior confusion
      ─▶ Script (Claude ▸ Groq ▸ stub) ─▶ Voices (edge-tts) ─▶ Stitch (pydub) ─▶ MP3
```

## Stack

| Layer     | Tech                                                        |
|-----------|-------------------------------------------------------------|
| Backend   | Python · FastAPI                                            |
| Ingest    | pypdf (PDF) · Groq Whisper (voice)                          |
| Vectors   | ChromaDB (local, persistent, free local embeddings)        |
| Script    | Claude API (primary) → Groq Llama-3 (fallback) → stub       |
| Audio     | edge-tts (two voices) + pydub → single MP3                 |
| Frontend  | Next.js · React · Tailwind (dark aurora / glass UI)        |

The app runs **without any API keys** using a built-in demo script, so the whole
pipeline and UI are demonstrable offline. Add keys to light up real generation.

---

## Run it

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows  (source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
copy .env.example .env           # then add ANTHROPIC_API_KEY / GROQ_API_KEY (optional)
uvicorn main:app --reload --port 8000
```

- Health check: <http://127.0.0.1:8000/health>
- Pipeline smoke test: `python scripts/smoke.py`

> **ffmpeg** is provided automatically by `imageio-ffmpeg` — no system install.
> On Python 3.13+, `audioop-lts` backfills the stdlib module pydub needs.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>. The frontend proxies `/api/*` to the backend
(`next.config.mjs`), so no CORS setup is needed in dev.

---

## API

| Method | Route              | Purpose                                        |
|--------|--------------------|------------------------------------------------|
| GET    | `/health`          | status + which engines/keys are available      |
| POST   | `/generate`        | multipart `file` + `topic` → transcript + audio |
| GET    | `/audio/{id}`      | stream/download the episode MP3                 |
| POST   | `/feedback`        | record a struggled concept (spaced repetition)  |

## Notes

- **Graceful audio fallback:** edge-tts talks to a free Microsoft endpoint that
  can intermittently 403 / rate-limit. Each line is retried; if audio still
  fails, `/generate` returns the transcript with a `note` so the experience
  never hard-fails.
- **Spaced repetition** is a small per-user JSON record (`storage/user_memory.json`)
  of struggled concepts, woven into the opening lines of the next episode.
- Everything (Chroma DB, uploads, generated MP3s) is written under
  `backend/storage/` and git-ignored.
