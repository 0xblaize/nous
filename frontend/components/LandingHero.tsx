"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Landing hero — a huge 3D-tilting title that follows the mouse like a slow
 * pendulum, floating over the night sky. The CTA descends into the app.
 */
export default function LandingHero({ onEnter }: { onEnter: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const target = useRef({ rx: 0, ry: 0 });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      target.current = { rx: ny * -7, ry: nx * 10 };
    };
    window.addEventListener("mousemove", onMove);
    let raf = 0;
    const ease = () => {
      setTilt((t) => ({
        rx: t.rx + (target.current.rx - t.rx) * 0.045,
        ry: t.ry + (target.current.ry - t.ry) * 0.045,
      }));
      raf = requestAnimationFrame(ease);
    };
    raf = requestAnimationFrame(ease);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="flex min-h-[80vh] w-full flex-col items-center justify-center"
      style={{ perspective: "1100px" }}
    >
      <div
        className="flex flex-col items-center text-center will-change-transform"
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <p
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-hairline bg-white/[0.04] px-4 py-1.5 text-xs text-white/55"
          style={{ transform: "translateZ(40px)" }}
        >
          <span className="h-1.5 w-1.5 animate-pulseGlow rounded-full bg-teal" />
          zero-cost micro-learning, whispered into your night
        </p>

        <h1
          className="text-balance text-6xl font-semibold leading-[1.02] tracking-tight text-white sm:text-8xl"
          style={{ transform: "translateZ(80px)", textShadow: "0 0 80px rgba(129,140,248,0.35)" }}
        >
          Learn while
          <br />
          <span className="aurora-text">the world sleeps</span>
        </h1>

        <p
          className="mx-auto mt-7 max-w-md text-pretty text-[15px] leading-relaxed text-white/55"
          style={{ transform: "translateZ(50px)" }}
        >
          Drop in a document — or just talk. Two calm voices turn it into
          tonight&apos;s episode, remember what confused you, and pick it up
          again tomorrow.
        </p>

        <button
          onClick={onEnter}
          className="group relative mt-10 overflow-hidden rounded-full bg-gradient-to-r from-indigo via-violet to-teal bg-[length:220%_100%] px-10 py-4 text-sm font-semibold text-white transition-all duration-700 hover:bg-[position:100%_0] active:scale-[0.98]"
          style={{ transform: "translateZ(90px)" }}
        >
          <span className="absolute inset-0 rounded-full bg-violet/40 opacity-0 blur-2xl transition-opacity duration-700 group-hover:opacity-100" />
          <span className="relative flex items-center gap-2.5">
            Begin tonight&apos;s episode
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-500 group-hover:translate-x-1">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </button>
      </div>

      <div className="pointer-events-none mt-20 flex animate-breathe flex-col items-center gap-2 text-white/25">
        <span className="text-[10px] uppercase tracking-[0.3em]">breathe</span>
        <span className="h-8 w-px bg-gradient-to-b from-white/25 to-transparent" />
      </div>
    </div>
  );
}
