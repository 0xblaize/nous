"use client";

import { useEffect, useState } from "react";
import NightSky from "@/components/NightSky";
import UploadDrop from "@/components/UploadDrop";
import GeneratingState from "@/components/GeneratingState";
import AudioPlayer from "@/components/AudioPlayer";
import AuthPanel from "@/components/AuthPanel";
import EpisodeShelf from "@/components/EpisodeShelf";
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

export default function Home() {
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

  const enter = () => setView(user ? "studio" : "auth");

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

  return (
    <main className="relative flex min-h-screen flex-col items-center px-5 py-10">
      <NightSky />

      {/* Brand bar */}
      <header className="z-10 mb-2 flex w-full max-w-5xl items-center justify-between">
        <button onClick={() => setView("landing")} className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet to-teal text-sm font-bold text-white">
            N
          </span>
          <span className="text-lg font-semibold tracking-tight text-white/90">Nous</span>
        </button>
        <div className="flex items-center gap-3">
          {user && (
            <button
              onClick={() => {
                signOut();
                setUser(null);
                setView("landing");
              }}
              className="rounded-full border border-hairline px-3 py-1.5 text-[11px] text-white/50 transition hover:text-white"
            >
              {user.email} · sign out
            </button>
          )}
          <EngineBadge health={health} source={result?.source} />
        </div>
      </header>

      <section className="z-10 flex w-full flex-1 flex-col items-center justify-center py-10">
        {view === "landing" && (
          <div className="animate-fadeUp flex max-w-3xl flex-col items-center text-center">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-hairline bg-white/[0.04] px-4 py-1.5 text-xs text-white/55 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulseGlow rounded-full bg-teal" />
              Learning that lulls you to sleep — in a good way
            </p>
            <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-7xl">
              Drift off into
              <br />
              <span className="aurora-text">everything you read</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-[16px] leading-relaxed text-white/55">
              Upload a document — or just speak — and two AI hosts turn it into a
              slow, warm late-night conversation under the aurora. Put your
              headphones on. Let the sky do the rest.
            </p>
            <button
              onClick={enter}
              className="group relative mt-10 overflow-hidden rounded-full bg-gradient-to-r from-indigo via-violet to-teal bg-[length:200%_100%] px-10 py-4 text-[15px] font-semibold text-white shadow-[0_0_50px_-8px_rgba(139,92,246,0.7)] transition-all duration-500 hover:bg-[position:100%_0] hover:shadow-[0_0_70px_-6px_rgba(45,212,191,0.6)] active:scale-[0.98]"
            >
              Begin tonight&apos;s episode
            </button>
            <p className="mt-4 text-xs text-white/35">
              free · private · your voice or your PDF
            </p>
          </div>
        )}

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
            <div className="animate-fadeUp mb-8 max-w-xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                What are we learning <span className="aurora-text">tonight</span>?
              </h2>
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
              className="mt-6 rounded-full border border-hairline px-5 py-2 text-sm text-white/60 transition hover:text-white"
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

      <footer className="z-10 mt-auto pt-8 text-center text-xs text-white/30">
        Python · FastAPI · SQLite · ChromaDB · Claude + Groq · edge-tts — all inside one folder.
      </footer>
    </main>
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
