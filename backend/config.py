"""Central config: paths, keys, model ids, voice map, and local ffmpeg wiring."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

# Single project-wide .env at the repo root is the source of truth. A
# backend-local .env still wins if present (for per-service overrides).
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BASE_DIR / ".env", override=True)

# --- Storage paths ---
# Defaults to a folder inside the repo. On a host with an ephemeral
# filesystem (Render, Railway free tiers), every redeploy wipes this unless
# STORAGE_DIR is pointed at a mounted persistent disk, e.g. on Render:
#   Dashboard -> service -> Disks -> Add Disk -> mount path /var/data
#   then set STORAGE_DIR=/var/data
# Without a persistent disk, accounts/episodes are lost on each deploy —
# that's a hosting/infra choice, not an app bug.
STORAGE_DIR = Path(os.getenv("STORAGE_DIR", str(BASE_DIR / "storage")))
AUDIO_DIR = STORAGE_DIR / "audio"
UPLOAD_DIR = STORAGE_DIR / "uploads"
CHROMA_DIR = STORAGE_DIR / "chroma"
MEMORY_FILE = STORAGE_DIR / "user_memory.json"  # spaced-repetition record

for _d in (STORAGE_DIR, AUDIO_DIR, UPLOAD_DIR, CHROMA_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# --- Database ---
# Empty = local SQLite file under STORAGE_DIR (default, zero setup, but wiped
# on any host with an ephemeral disk). Set DATABASE_URL to a Postgres
# connection string (e.g. from Neon, Supabase) to persist accounts/episodes
# across redeploys on free-tier hosting.
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# --- API keys ---
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()

# --- Auth ---
SECRET_KEY = os.getenv("SECRET_KEY", "").strip()
TOKEN_TTL_DAYS = int(os.getenv("TOKEN_TTL_DAYS", "7"))
MIN_PASSWORD_LENGTH = int(os.getenv("MIN_PASSWORD_LENGTH", "6"))
ALLOW_SIGNUPS = os.getenv("ALLOW_SIGNUPS", "true").strip().lower() not in (
    "false",
    "0",
    "no",
)

# --- CORS ---
# Comma-separated list of browser origins allowed to call this backend.
# In production set CORS_ORIGINS to your Vercel domain(s), e.g.
#   CORS_ORIGINS=https://nous.vercel.app,https://nous-yourname.vercel.app
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if o.strip()
]

# --- Models ---
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-5")
CLAUDE_FALLBACK_MODEL = os.getenv("CLAUDE_FALLBACK_MODEL", "claude-haiku-4-5")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_WHISPER_MODEL = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3")

# --- TTS voices ---
# Andrew/Ava are newer, warmer neural voices; Guy/Jenny (the old defaults)
# read noticeably flatter and more robotic on longer conversational lines.
HOST_A_VOICE = os.getenv("HOST_A_VOICE", "en-US-AndrewNeural")  # Expert (male)
HOST_B_VOICE = os.getenv("HOST_B_VOICE", "en-US-AvaNeural")  # Learner (female)

# --- Pipeline knobs ---
CHUNK_WORDS = 500
TOP_K = 3

# --- Point pydub at the bundled static ffmpeg (no system install needed) ---
def _wire_ffmpeg() -> str | None:
    """Make the bundled imageio-ffmpeg binary discoverable as bare `ffmpeg`.

    pydub shells out to `ffmpeg` (and sometimes `ffprobe`) by name, but the
    imageio binary is named ffmpeg-win64-vX.Y.Z.exe. We copy it to bin/ffmpeg.exe,
    prepend that dir to PATH, and set pydub's converter explicitly.
    """
    import os
    import shutil

    try:
        import imageio_ffmpeg
        from pydub import AudioSegment

        src = imageio_ffmpeg.get_ffmpeg_exe()
        bin_dir = BASE_DIR / "bin"
        bin_dir.mkdir(parents=True, exist_ok=True)

        exe_name = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
        local_exe = bin_dir / exe_name
        if not local_exe.exists():
            shutil.copy2(src, local_exe)

        # Prepend our bin dir so bare `ffmpeg` resolves to the bundled binary.
        os.environ["PATH"] = str(bin_dir) + os.pathsep + os.environ.get("PATH", "")

        AudioSegment.converter = str(local_exe)
        AudioSegment.ffmpeg = str(local_exe)

        # imageio-ffmpeg ships ffmpeg but NOT ffprobe. pydub probes media via
        # ffprobe when reading a file object; with no ffprobe that raises
        # WinError 2. Neutralize the probe — ffmpeg decodes fine from an explicit
        # format hint, so empty probe info is harmless.
        import pydub.utils
        import pydub.audio_segment

        def _no_probe(*_args, **_kwargs):
            return {}

        pydub.utils.mediainfo_json = _no_probe
        pydub.audio_segment.mediainfo_json = _no_probe

        return str(local_exe)
    except Exception:
        return None


FFMPEG_EXE = _wire_ffmpeg()

HAS_ANTHROPIC = bool(ANTHROPIC_API_KEY)
HAS_GROQ = bool(GROQ_API_KEY)
