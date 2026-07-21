import { useEffect, useRef } from "react";
import { reactivity } from "@/lib/reactivity";

interface WaveformProps {
  progress: number; // 0..1 playback position
  playing: boolean;
  seed?: string; // stable bar pattern per episode
  onSeek?: (fraction: number) => void;
}

// Deterministic pseudo-random so bars are stable across renders (no Math.random
// jitter each frame) but unique per episode.
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default function Waveform({
  progress,
  playing,
  seed = "nous",
  onSeek,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const BARS = 72;
    const base = hashString(seed);
    // Precompute a stable height profile.
    const heights = Array.from({ length: BARS }, (_, i) => {
      const n = Math.sin((base % 100) + i * 0.7) * 0.5 + 0.5;
      const m = Math.sin(i * 0.28 + (base % 7)) * 0.5 + 0.5;
      return 0.22 + 0.78 * (0.6 * n + 0.4 * m);
    });

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      const gap = 3 * devicePixelRatio;
      const barW = (width - gap * (BARS - 1)) / BARS;
      const mid = height / 2;

      for (let i = 0; i < BARS; i++) {
        const frac = i / (BARS - 1);
        const played = frac <= progress;
        // Gentle breathing near the playhead when playing.
        const distToHead = Math.abs(frac - progress);
        const pulse =
          playing && !prefersReduced
            ? 1 + 0.28 * Math.exp(-distToHead * 14) * (0.6 + 0.4 * Math.sin(tRef.current * 3 + i))
            : 1;
        // Live spectrum: when the analyser is running, bars ride the real
        // frequency energy of the hosts' voices (mirrored around the center).
        const spec = reactivity.spectrum;
        let live = 1;
        if (playing && spec && spec.length > 0 && !prefersReduced) {
          const bin = spec[Math.floor((Math.abs(frac - 0.5) * 2) * (spec.length - 8)) + 4] / 255;
          live = 0.65 + bin * 1.1;
        }
        const h = heights[i] * mid * 1.5 * pulse * live;
        const x = i * (barW + gap);

        const grad = ctx.createLinearGradient(0, mid - h, 0, mid + h);
        if (played) {
          grad.addColorStop(0, "rgba(26,26,26,0.95)");
          grad.addColorStop(1, "rgba(26,26,26,0.75)");
        } else {
          grad.addColorStop(0, "rgba(0,0,0,0.14)");
          grad.addColorStop(1, "rgba(0,0,0,0.07)");
        }
        ctx.fillStyle = grad;
        const r = Math.min(barW / 2, 3 * devicePixelRatio);
        roundRect(ctx, x, mid - h, barW, h * 2, r);
        ctx.fill();

        // Green glow on the bar right at the playhead.
        if (played && distToHead < 0.03) {
          ctx.shadowColor = "rgba(159,255,0,0.9)";
          ctx.shadowBlur = 18 * devicePixelRatio;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    };

    const loop = () => {
      tRef.current += 0.016;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      draw();
    };
    resize();
    window.addEventListener("resize", resize);

    if (playing && !prefersReduced) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      draw();
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [progress, playing, seed]);

  return (
    <canvas
      ref={canvasRef}
      onClick={(e) => {
        if (!onSeek) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek((e.clientX - rect.left) / rect.width);
      }}
      className="h-24 w-full cursor-pointer"
      aria-hidden
    />
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
