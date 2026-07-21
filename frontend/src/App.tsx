import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import NightSky from "@/components/NightSky";
import AuthPanel from "@/components/AuthPanel";
import EpisodeShelf from "@/components/EpisodeShelf";
import UploadDrop from "@/components/UploadDrop";
import GeneratingState from "@/components/GeneratingState";
import AudioPlayer from "@/components/AudioPlayer";
import {
  audioSrc,
  generateEpisodeWS,
  getEpisode,
  getHealth,
  savedAuth,
  signOut,
  type AuthUser,
  type GenerateResult,
  type GenerationProgress,
  type HealthResult,
} from "@/lib/api";

type View = "landing" | "auth" | "studio" | "generating" | "done" | "error";

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  useEffect(() => {
    getHealth().then(setHealth);
    setUser(savedAuth());
  }, []);

  const enter = () => setView(savedAuth() ? "studio" : "auth");

  const handleSubmit = async (file: File, topic: string) => {
    setView("generating");
    setError(null);
    setProgress(null);
    try {
      const res = await generateEpisodeWS(file, topic, setProgress);
      setResult(res);
      setView("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setView("error");
    }
  };

  const openEpisode = async (id: string) => {
    const ep = await getEpisode(id);
    if (ep) {
      setResult(ep);
      setView("done");
    }
  };

  const backToStudio = () => {
    setResult(null);
    setError(null);
    setProgress(null);
    setView("studio");
  };

  // ---------- Landing (light, per spec) ----------
  if (view === "landing") {
    return (
      <div className="min-h-screen bg-bg-base selection:bg-brand-green selection:text-black">
        <Navbar onGetStarted={enter} />
        <main>
          <Hero onEnter={enter} />
        </main>
      </div>
    );
  }

  // ---------- Studio (dark night-sky app) ----------
  return (
    <div className="nous-dark relative flex min-h-screen flex-col items-center px-5 py-8 selection:bg-brand-green selection:text-black">
      <NightSky />

      <header className="z-10 flex w-full max-w-5xl items-center justify-between">
        <button onClick={() => setView("landing")} className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet to-teal text-sm font-bold text-white shadow-[0_0_24px_rgba(139,92,246,0.45)]">
            N
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-white/90">
            Nous
          </span>
        </button>

        <div className="flex items-center gap-3">
          <EngineBadge health={health} source={result?.source} />
          {user ? (
            <button
              onClick={() => {
                signOut();
                setUser(null);
                setView("landing");
              }}
              className="rounded-full border border-hairline px-3 py-1.5 text-[11px] text-white/55 transition hover:text-white"
              title={user.email}
            >
              {user.email.split("@")[0]} · sign out
            </button>
          ) : (
            view !== "auth" && (
              <button
                onClick={() => setView("auth")}
                className="rounded-full border border-hairline px-3 py-1.5 text-[11px] text-white/55 transition hover:text-white"
              >
                sign in
              </button>
            )
          )}
        </div>
      </header>

      <section className="z-10 flex w-full flex-1 flex-col items-center justify-center gap-8 py-6">
        {view === "auth" && (
          <AuthPanel
            onDone={(u) => {
              setUser(u);
              setView("studio");
            }}
            onSkip={() => setView("studio")}
          />
        )}

        {view === "studio" && (
          <>
            <div className="animate-fadeUp max-w-xl text-center">
              <h1 className="text-balance font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                What shall we <span className="aurora-text">drift through</span> tonight?
              </h1>
            </div>
            <UploadDrop onSubmit={handleSubmit} />
            {user && <EpisodeShelf onOpen={openEpisode} refreshKey={view} />}
          </>
        )}

        {view === "generating" && <GeneratingState progress={progress} />}

        {view === "done" && result && (
          <>
            <AudioPlayer
              audioUrl={result.audio_url ? audioSrc(result.audio_url) : null}
              transcript={result.transcript}
              topic={result.topic}
              episodeId={result.id}
              note={result.note}
            />
            <button
              onClick={backToStudio}
              className="rounded-full border border-hairline px-5 py-2 text-sm text-white/60 transition hover:text-white"
            >
              ← Compose another
            </button>
          </>
        )}

        {view === "error" && (
          <div className="animate-fadeUp glass w-full max-w-md rounded-3xl p-8 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-rose-500/15 text-rose-300">
              !
            </div>
            <h2 className="text-lg font-semibold text-white/90">That didn&apos;t work</h2>
            <p className="mt-2 text-sm text-white/55">{error}</p>
            <button
              onClick={backToStudio}
              className="mt-6 rounded-full bg-white/10 px-5 py-2 text-sm text-white transition hover:bg-white/15"
            >
              Try again
            </button>
          </div>
        )}
      </section>

      <footer className="z-10 mt-auto pt-6 text-center text-xs text-white/25">
        Python · FastAPI · SQLite · ChromaDB · Claude + Groq · edge-tts — all inside one folder.
      </footer>
    </div>
  );
}

function EngineBadge({
  health,
  source,
}: {
  health: HealthResult | null;
  source?: string;
}) {
  if (source) {
    const label =
      source === "claude" ? "Claude" : source === "groq" ? "Groq Llama-3" : "Demo voice";
    return (
      <span className="rounded-full border border-hairline bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/55">
        script by {label}
      </span>
    );
  }
  if (!health) {
    return (
      <span className="rounded-full border border-hairline px-3 py-1.5 text-[11px] text-white/40">
        connecting…
      </span>
    );
  }
  const online = health.status === "ok";
  const engine = health.anthropic ? "Claude" : health.groq ? "Groq" : "Demo mode";
  return (
    <span className="flex items-center gap-2 rounded-full border border-hairline bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/55">
      <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-teal" : "bg-rose-400"}`} />
      {online ? engine : "backend offline"}
    </span>
  );
}
