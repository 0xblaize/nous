"use client";

import { useEffect, useRef, useState } from "react";
import type { DialogueLine } from "@/lib/api";
import { useAudioReactivity } from "@/lib/useAudioReactivity";
import Waveform from "./Waveform";

interface AudioPlayerProps {
  audioUrl: string | null;
  transcript: DialogueLine[];
  topic: string;
  episodeId: string;
  note?: string | null;
}

function fmt(t: number): string {
  if (!isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({
  audioUrl,
  transcript,
  topic,
  episodeId,
  note,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  // Feed the night sky + waveform with the live voice spectrum.
  useAudioReactivity(audioRef);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCur(a.currentTime);
    const onMeta = () => setDur(a.duration);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [audioUrl]);

  const progress = dur > 0 ? cur / dur : 0;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play();
      setPlaying(true);
    }
  };

  const seek = (fraction: number) => {
    const a = audioRef.current;
    if (!a || !dur) return;
    a.currentTime = Math.max(0, Math.min(1, fraction)) * dur;
    setCur(a.currentTime);
  };

  return (
    <div className="animate-fadeUp w-full max-w-2xl">
      <div className="glass-strong rounded-[28px] p-7">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.28em] text-white/45">
              Now playing
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold text-white/95">
              {topic}
            </h2>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-hairline bg-white/5 px-3 py-1 text-[11px] text-white/60">
            <span className="h-1.5 w-1.5 animate-pulseGlow rounded-full bg-teal" />
            two voices
          </span>
        </div>

        {/* Waveform */}
        <Waveform
          progress={progress}
          playing={playing}
          seed={episodeId}
          onSeek={audioUrl ? seek : undefined}
        />

        {/* Transport */}
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={toggle}
            disabled={!audioUrl}
            aria-label={playing ? "Pause" : "Play"}
            className="group relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet to-indigo transition active:scale-95 disabled:opacity-40"
          >
            <span className="absolute inset-0 rounded-full bg-violet/50 blur-xl transition group-hover:bg-violet/70" />
            <span className="relative text-white">
              {playing ? <PauseIcon /> : <PlayIcon />}
            </span>
          </button>

          <div className="flex-1">
            <div
              className="group h-1.5 w-full cursor-pointer rounded-full bg-white/10"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                seek((e.clientX - rect.left) / rect.width);
              }}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo via-violet to-teal"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-white/45">
              <span>{fmt(cur)}</span>
              <span>{fmt(dur)}</span>
            </div>
          </div>

          {audioUrl && (
            <a
              href={audioUrl}
              download={`nous_${episodeId}.mp3`}
              className="grid h-10 w-10 place-items-center rounded-full border border-hairline text-white/60 transition hover:text-white"
              aria-label="Download episode"
            >
              <DownloadIcon />
            </a>
          )}
        </div>

        {note && (
          <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs leading-relaxed text-amber-200/80">
            {note}
          </p>
        )}

        {audioUrl && (
          <audio ref={audioRef} src={audioUrl} preload="metadata" crossOrigin="anonymous" />
        )}
      </div>

      {/* Transcript — high-contrast (NOT glass) for readability */}
      <div className="mt-4 rounded-[24px] border border-hairline bg-black/40 p-1.5">
        <div className="nous-scroll max-h-80 overflow-y-auto rounded-[18px] p-5">
          <ul className="space-y-4">
            {transcript.map((line, i) => {
              const expert = line.speaker === "HOST_A";
              return (
                <li key={i} className="flex gap-3">
                  <span
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                      expert
                        ? "bg-indigo/25 text-indigo"
                        : "bg-teal/25 text-teal"
                    }`}
                  >
                    {expert ? "A" : "B"}
                  </span>
                  <div>
                    <p
                      className={`text-[10px] uppercase tracking-[0.2em] ${
                        expert ? "text-indigo/70" : "text-teal/70"
                      }`}
                    >
                      {expert ? "Host A · Expert" : "Host B · Learner"}
                    </p>
                    <p className="mt-0.5 text-[15px] leading-relaxed text-white/85">
                      {line.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1.4" />
      <rect x="14" y="5" width="4" height="14" rx="1.4" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
