"use client";

import { useEffect, useState } from "react";
import AuroraBackground from "@/components/AuroraBackground";
import UploadDrop from "@/components/UploadDrop";
import GeneratingState from "@/components/GeneratingState";
import AudioPlayer from "@/components/AudioPlayer";
import {
  audioSrc,
  generateEpisode,
  getHealth,
  type GenerateResult,
  type HealthResult,
} from "@/lib/api";

type View = "idle" | "generating" | "done" | "error";

export default function Home() {
  const [view, setView] = useState<View>("idle");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResult | null>(null);

  useEffect(() => {
    getHealth().then(setHealth);
  }, []);

  const handleSubmit = async (file: File, topic: string) => {
    setView("generating");
    setError(null);
    try {
      const res = await generateEpisode(file, topic);
      setResult(res);
      setView("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setView("error");
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setView("idle");
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center px-5 py-10">
      <AuroraBackground />

      {/* Brand */}
      <header className="mb-2 flex w-full max-w-5xl items-center justify-between">
        <button onClick={reset} className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet to-teal text-sm font-bold text-white">
            N
          </span>
          <span className="text-lg font-semibold tracking-tight text-white/90">
            Nous
          </span>
        </button>
        <EngineBadge health={health} source={result?.source} />
      </header>

      {/* Hero / stage */}
      <section className="flex w-full flex-1 flex-col items-center justify-center py-10">
        {view === "idle" && (
          <>
            <div className="animate-fadeUp mb-10 max-w-2xl text-center">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-hairline bg-white/[0.04] px-4 py-1.5 text-xs text-white/55">
                <span className="h-1.5 w-1.5 animate-pulseGlow rounded-full bg-teal" />
                Zero-cost micro-learning, in your ears
              </p>
              <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-6xl">
                Turn anything you read
                <br />
                into a <span className="aurora-text">conversation</span>
              </h1>
              <p className="mx-auto mt-5 max-w-lg text-pretty text-[15px] leading-relaxed text-white/55">
                Upload a document or a voice note. Nous distills it and hands it
                to two AI hosts — an expert and a curious learner — who talk you
                through it. Best with headphones.
              </p>
            </div>
            <UploadDrop onSubmit={handleSubmit} />
          </>
        )}

        {view === "generating" && <GeneratingState />}

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
              onClick={reset}
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
            <h2 className="text-lg font-semibold text-white/90">
              That didn&apos;t work
            </h2>
            <p className="mt-2 text-sm text-white/55">{error}</p>
            <button
              onClick={reset}
              className="mt-6 rounded-full bg-white/10 px-5 py-2 text-sm text-white transition hover:bg-white/15"
            >
              Try again
            </button>
          </div>
        )}
      </section>

      <footer className="mt-auto pt-8 text-center text-xs text-white/30">
        Python · FastAPI · ChromaDB · Claude + Groq · edge-tts — all inside one folder.
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
      <span
        className={`h-1.5 w-1.5 rounded-full ${online ? "bg-teal" : "bg-rose-400"}`}
      />
      {online ? engine : "backend offline"}
    </span>
  );
}
