import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
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
  const [prefillTopic, setPrefillTopic] = useState("");

  useEffect(() => {
    getHealth().then(setHealth);
    setUser(savedAuth());
  }, []);

  const enter = (topic?: string) => {
    if (topic) setPrefillTopic(topic);
    setView(savedAuth() ? "studio" : "auth");
  };

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

  // ---------- Landing ----------
  if (view === "landing") {
    return (
      <div className="min-h-screen bg-bg-base selection:bg-brand-green selection:text-black">
        <Navbar onGetStarted={() => enter()} onSignIn={() => setView("auth")} />
        <main>
          <Hero onEnter={enter} />
        </main>
      </div>
    );
  }

  // ---------- App (same light language as the landing) ----------
  return (
    <div className="min-h-screen bg-bg-base selection:bg-brand-green selection:text-black">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-8 md:px-16 lg:px-20">
        {/* App header */}
        <header className="flex w-full items-center justify-between py-6 md:py-8">
          <button onClick={() => setView("landing")} className="flex items-center gap-2.5">
            <CloverIcon />
            <span className="font-display text-lg font-semibold tracking-tight text-[#1a1a1a]">
              nous
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
                className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] lowercase text-zinc-600 shadow-sm transition hover:text-[#1a1a1a]"
                title={user.email}
              >
                {user.email.split("@")[0]} · sign out
              </button>
            ) : (
              view !== "auth" && (
                <button
                  onClick={() => setView("auth")}
                  className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] lowercase text-zinc-600 shadow-sm transition hover:text-[#1a1a1a]"
                >
                  sign in
                </button>
              )
            )}
          </div>
        </header>

        <section className="flex w-full flex-1 flex-col items-center justify-center gap-8 py-8">
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
              <div className="animate-fadeUp max-w-2xl text-center">
                <h1 className="font-display text-balance text-4xl font-medium tracking-tight text-[#1a1a1a] sm:text-5xl">
                  What shall we learn <span className="text-[#8e8e8e]">tonight?</span>
                </h1>
              </div>
              <UploadDrop onSubmit={handleSubmit} initialTopic={prefillTopic} />
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
                className="rounded-full border border-black/10 bg-white px-5 py-2 text-sm text-zinc-600 shadow-sm transition hover:text-[#1a1a1a]"
              >
                ← compose another
              </button>
            </>
          )}

          {view === "error" && (
            <div className="animate-fadeUp w-full max-w-md rounded-2xl border border-black/[0.05] bg-white p-8 text-center shadow-sm">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-500">
                !
              </div>
              <h2 className="font-display text-lg font-semibold text-[#1a1a1a]">
                That didn&apos;t work
              </h2>
              <p className="mt-2 text-sm text-zinc-500">{error}</p>
              <button
                onClick={backToStudio}
                className="mt-6 rounded-full bg-[#1a1a1a] px-5 py-2 text-sm text-white transition hover:scale-[1.02]"
              >
                try again
              </button>
            </div>
          )}
        </section>

        <footer className="flex items-center justify-between py-6 text-[11px] text-zinc-500">
          <span>2026</span>
          <span className="lowercase">
            python · fastapi · sqlite · chromadb · claude + groq · edge-tts
          </span>
          <span className="lowercase">micro-learning tools</span>
        </footer>
      </div>
    </div>
  );
}

function CloverIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <g fill="#1a1a1a">
        <circle cx="12" cy="6.5" r="4.5" />
        <circle cx="12" cy="17.5" r="4.5" />
        <circle cx="6.5" cy="12" r="4.5" />
        <circle cx="17.5" cy="12" r="4.5" />
      </g>
    </svg>
  );
}

function EngineBadge({
  health,
  source,
}: {
  health: HealthResult | null;
  source?: string;
}) {
  const chip =
    "flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] lowercase text-zinc-600 shadow-sm";
  if (source) {
    const label =
      source === "claude" ? "claude" : source === "groq" ? "groq llama-3" : "demo voice";
    return <span className={chip}>script by {label}</span>;
  }
  if (!health) return <span className={chip}>connecting…</span>;
  const online = health.status === "ok";
  const engine = health.anthropic ? "claude" : health.groq ? "groq" : "demo mode";
  return (
    <span className={chip}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${online ? "bg-brand-green" : "bg-rose-400"}`}
      />
      {online ? engine : "backend offline"}
    </span>
  );
}
