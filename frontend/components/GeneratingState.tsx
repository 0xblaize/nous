"use client";

import { useEffect, useState } from "react";
import type { GenerationProgress } from "@/lib/api";

const STAGES = [
  { label: "Reading your document", sub: "extracting the words that matter" },
  { label: "Building a memory", sub: "embedding ideas into a vector space" },
  { label: "Finding what matters", sub: "retrieving the most relevant passages" },
  { label: "Writing the conversation", sub: "two hosts, one idea, back and forth" },
  { label: "Giving the hosts a voice", sub: "stitching the audio together" },
];

// Map backend WS stage names onto the visual stages above.
const STAGE_INDEX: Record<string, number> = {
  ingest: 0,
  chunk: 1,
  embed: 1,
  retrieve: 2,
  script: 3,
  audio: 4,
};

/**
 * A calm, cinematic loading sequence. When `progress` (live WebSocket events)
 * is provided it tracks the real pipeline — including per-line voice progress.
 * Without it, it eases through the stages on a timer and rests on the last.
 */
export default function GeneratingState({
  progress,
}: {
  progress?: GenerationProgress | null;
}) {
  const [timerStage, setTimerStage] = useState(0);
  const live = progress != null;
  const stage = live
    ? STAGE_INDEX[progress.stage] ?? 0
    : timerStage;
  const tts =
    live && progress.ttsTotal
      ? { done: progress.ttsDone ?? 0, total: progress.ttsTotal }
      : null;

  useEffect(() => {
    if (live) return; // real events drive the display
    // Ease through stages; linger on the last (audio) which takes longest.
    const timings = [2200, 2600, 2600, 4200];
    let idx = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const advance = () => {
      idx += 1;
      if (idx < STAGES.length) {
        setTimerStage(idx);
        if (idx < timings.length) {
          timers.push(setTimeout(advance, timings[idx]));
        }
      }
    };
    timers.push(setTimeout(advance, timings[0]));
    return () => timers.forEach(clearTimeout);
  }, [live]);

  return (
    <div className="animate-fadeUp flex w-full max-w-md flex-col items-center">
      {/* Breathing orb */}
      <div className="relative mb-10 grid h-32 w-32 place-items-center">
        <div className="absolute inset-0 animate-breathe rounded-full bg-gradient-to-br from-violet/60 to-teal/40 blur-2xl" />
        <div className="absolute inset-3 animate-pulseGlow rounded-full border border-white/20" />
        <div className="absolute inset-6 rounded-full border border-white/10" />
        <div className="relative h-3 w-3 animate-pulseGlow rounded-full bg-white shadow-[0_0_24px_6px_rgba(196,181,253,0.8)]" />
      </div>

      <ul className="w-full space-y-3">
        {STAGES.map((s, i) => {
          const active = i === stage;
          const done = i < stage;
          return (
            <li
              key={s.label}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-500 ${
                active
                  ? "glass border-hairline"
                  : "border-transparent opacity-45"
              }`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] ${
                  done
                    ? "bg-teal/25 text-teal"
                    : active
                    ? "bg-violet/25 text-violet"
                    : "bg-white/5 text-white/40"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${
                    active ? "shimmer-text animate-shimmer" : "text-white/70"
                  }`}
                >
                  {s.label}
                </p>
                {active && (
                  <p className="text-xs text-white/45">
                    {i === 4 && tts
                      ? `voicing line ${tts.done} of ${tts.total}`
                      : s.sub}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-center text-xs text-white/40">
        Crafting your episode — this usually takes under a minute.
      </p>
    </div>
  );
}
