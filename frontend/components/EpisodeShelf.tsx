"use client";

import { useEffect, useState } from "react";
import { listEpisodes, type EpisodeSummary } from "@/lib/api";

/** The listener's shelf — past episodes, tap to relisten. */
export default function EpisodeShelf({
  onOpen,
  refreshKey,
}: {
  onOpen: (id: string) => void;
  refreshKey?: unknown;
}) {
  const [episodes, setEpisodes] = useState<EpisodeSummary[] | null>(null);

  useEffect(() => {
    listEpisodes().then(setEpisodes);
  }, [refreshKey]);

  if (!episodes || episodes.length === 0) return null;

  return (
    <div className="animate-fadeUp mt-10 w-full max-w-xl">
      <p className="mb-3 text-xs uppercase tracking-[0.28em] text-white/40">
        Your past episodes
      </p>
      <ul className="space-y-2">
        {episodes.slice(0, 6).map((e) => (
          <li key={e.id}>
            <button
              onClick={() => onOpen(e.id)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-hairline bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/25 hover:bg-white/[0.06]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo/25 to-teal/15 text-white/70">
                {e.audio_available ? <PlaySmall /> : <TextSmall />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-white/85">{e.topic}</span>
                <span className="block text-[11px] text-white/40">
                  {new Date(e.created_at * 1000).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · script by {e.source}
                </span>
              </span>
              <span className="text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/60">
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlaySmall() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}
function TextSmall() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}
