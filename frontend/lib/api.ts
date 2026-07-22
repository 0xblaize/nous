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

// API base. Generation can take 100s+ (LLM + TTS), so the browser talks to the
// backend directly (CORS is enabled for localhost:3000) rather than through a
// dev proxy that would drop the long socket. Override with VITE_API_BASE in
// the root .env.
const API =
  (import.meta.env?.VITE_API_BASE as string | undefined) ||
  "http://127.0.0.1:8000";

// ---- auth ----

export interface AuthUser {
  user_id: string;
  email: string;
  token: string;
}

const TOKEN_KEY = "nous_auth";

export function savedAuth(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function storeAuth(user: AuthUser | null): void {
  if (typeof window === "undefined") return;
  if (user) localStorage.setItem(TOKEN_KEY, JSON.stringify(user));
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const u = savedAuth();
  return u ? { Authorization: `Bearer ${u.token}` } : {};
}

async function authPost(path: string, body: object): Promise<AuthUser> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // fetch throws (not a 4xx/5xx) on CORS blocks, DNS failures, or a
    // free-tier backend that's asleep and never answers the socket.
    throw new Error(
      "Could not reach the server. If this is a fresh deploy, it may still be waking up, wait a few seconds and try again."
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail ?? `Request failed (${res.status})`);
  const user = data as AuthUser;
  storeAuth(user);
  return user;
}

export const register = (email: string, password: string) =>
  authPost("/auth/register", { email, password });
export const login = (email: string, password: string) =>
  authPost("/auth/login", { email, password });
export const signOut = () => storeAuth(null);

/**
 * Check the saved session against the backend. Returns true when still valid.
 * Clears the stored token on a definite 401 (expired, or the server no longer
 * knows the account) so the UI never shows a half-working session.
 */
export async function verifySession(): Promise<boolean> {
  const u = savedAuth();
  if (!u) return false;
  try {
    const res = await fetch(`${API}/auth/me`, { headers: authHeaders() });
    if (res.status === 401) {
      storeAuth(null);
      return false;
    }
    return res.ok;
  } catch {
    // Network blip (or the server is waking up): keep the session optimistic.
    return true;
  }
}

export interface EpisodeSummary {
  id: string;
  topic: string;
  source: string;
  audio_available: boolean;
  created_at: number;
}

export async function listEpisodes(): Promise<EpisodeSummary[]> {
  const res = await fetch(`${API}/episodes`, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as EpisodeSummary[];
}

export async function getEpisode(id: string): Promise<GenerateResult | null> {
  const res = await fetch(`${API}/episodes/${id}`, { headers: authHeaders() });
  if (!res.ok) return null;
  return (await res.json()) as GenerateResult;
}

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

  const res = await fetch(`${API}/generate`, {
    method: "POST",
    body: form,
    headers: authHeaders(),
  });
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

// ---- WebSocket generation (streams real pipeline progress) ----

export interface GenerationProgress {
  stage: string; // ingest | chunk | embed | retrieve | script | audio
  label?: string;
  ttsDone?: number;
  ttsTotal?: number;
}

function wsUrl(): string {
  // Derive ws(s):// from the API base; fall back to same-origin for "/api".
  const base = API.startsWith("http")
    ? API
    : `${window.location.origin}${API === "/api" ? "" : API}`;
  return base.replace(/^http/, "ws") + "/ws/generate";
}

/**
 * Generate over WebSocket: POST /upload to stage the file, then stream
 * pipeline events. Falls back to the plain HTTP /generate if the socket
 * can't be established.
 */
export async function generateEpisodeWS(
  file: File,
  topic: string,
  onProgress: (p: GenerationProgress) => void,
  userId = "demo"
): Promise<GenerateResult> {
  const form = new FormData();
  form.append("file", file);
  const up = await fetch(`${API}/upload`, {
    method: "POST",
    body: form,
    headers: authHeaders(),
  });
  if (!up.ok) throw new Error(`Upload failed (${up.status})`);
  const { episode_id } = (await up.json()) as { episode_id: string };

  return new Promise<GenerateResult>((resolve, reject) => {
    let settled = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl());
    } catch {
      // Socket construction failed — fall back to HTTP.
      generateEpisode(file, topic, userId).then(resolve, reject);
      return;
    }

    ws.onopen = () =>
      ws.send(
        JSON.stringify({
          episode_id,
          topic,
          user_id: userId,
          token: savedAuth()?.token ?? "",
        })
      );

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string);
      switch (msg.event) {
        case "stage":
          onProgress({ stage: msg.stage, label: msg.label });
          break;
        case "tts_progress":
          onProgress({ stage: "audio", ttsDone: msg.done, ttsTotal: msg.total });
          break;
        case "done": {
          settled = true;
          const { event: _e, ...result } = msg;
          resolve(result as GenerateResult);
          ws.close();
          break;
        }
        case "error":
          settled = true;
          reject(new Error(msg.detail ?? "Generation failed."));
          ws.close();
          break;
        default:
          break; // accepted / script — informational
      }
    };

    ws.onerror = () => {
      if (!settled) {
        settled = true;
        // Connection-level failure — fall back to the HTTP path.
        generateEpisode(file, topic, userId).then(resolve, reject);
      }
    };
    ws.onclose = () => {
      if (!settled) {
        settled = true;
        reject(new Error("Connection closed before the episode finished."));
      }
    };
  });
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
