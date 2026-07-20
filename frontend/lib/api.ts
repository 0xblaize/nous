// Thin fetch wrapper around the FastAPI backend (proxied via /api in dev).

export interface DialogueLine {
  speaker: "HOST_A" | "HOST_B";
  text: string;
}

export interface GenerateResult {
  id: string;
  audio_url: string | null;
  audio_available: boolean;
  transcript: DialogueLine[];
  topic: string;
  source: "claude" | "groq" | "stub";
  note: string | null;
}

export interface HealthResult {
  status: string;
  ffmpeg: boolean;
  anthropic: boolean;
  groq: boolean;
}

// API base. In dev, generation can take 100s+ (LLM + TTS); Next's rewrite proxy
// drops that long socket, so point the browser straight at the backend when
// NEXT_PUBLIC_API_BASE is set (CORS is enabled for localhost:3000). Falls back
// to the same-origin "/api" proxy for short calls / production reverse-proxy.
const API = process.env.NEXT_PUBLIC_API_BASE
  ? `${process.env.NEXT_PUBLIC_API_BASE}`
  : "/api";

export async function getHealth(): Promise<HealthResult | null> {
  try {
    const res = await fetch(`${API}/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as HealthResult;
  } catch {
    return null;
  }
}

export async function generateEpisode(
  file: File,
  topic: string,
  userId = "demo"
): Promise<GenerateResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("topic", topic);
  form.append("user_id", userId);

  const res = await fetch(`${API}/generate`, { method: "POST", body: form });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return (await res.json()) as GenerateResult;
}

// Resolve a backend audio path to a browser-loadable URL (through the proxy).
export function audioSrc(path: string): string {
  return path.startsWith("/api") ? path : `${API}${path}`;
}

export async function sendFeedback(concept: string, userId = "demo"): Promise<void> {
  try {
    await fetch(`${API}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, concept }),
    });
  } catch {
    /* best-effort */
  }
}
