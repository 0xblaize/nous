import { useEffect, useState } from "react";
import { listEpisodes, type EpisodeSummary } from "@/lib/api";

function timeAgo(ts: number): string {
  const s = Date.now() / 1000 - ts;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Horizontal shelf of past episodes for the signed-in listener. */
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
    <div className="animate-fadeUp w-full max-w-3xl">
      <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-zinc-400">
        your library
      </p>
      <div className="nous-scroll flex gap-3 overflow-x-auto pb-2">
        {episodes.map((ep) => (
          <button
            key={ep.id}
            onClick={() => onOpen(ep.id)}
            className="group w-52 shrink-0 rounded-2xl border border-black/[0.05] bg-white p-4 text-left shadow-sm transition hover:border-black/20 hover:shadow"
          >
            <div className="mb-3 flex items-center justify-between">
              <span
                className={`grid h-8 w-8 place-items-center rounded-xl ${
                  ep.audio_available
                    ? "bg-[#1a1a1a] text-white"
                    : "bg-black/5 text-zinc-500"
                }`}
              >
                {ep.audio_available ? <PlaySmall /> : <TextSmall />}
              </span>
              <span className="text-[10px] text-zinc-400">{timeAgo(ep.created_at)}</span>
            </div>
            <p className="line-clamp-2 text-[13px] font-medium leading-snug text-[#1a1a1a]">
              {ep.topic}
            </p>
            <p className="mt-1.5 text-[10px] lowercase tracking-[0.16em] text-zinc-400">
              {ep.source === "claude" ? "claude" : ep.source === "groq" ? "groq" : "demo"}
            </p>
          </button>
        ))}
      </div>
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
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}
