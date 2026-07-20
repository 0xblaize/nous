"use client";

/**
 * The hypnotic layer. Large, slow-drifting gradient orbs behind a heavy blur,
 * plus a faint grain overlay and a vignette to pull focus inward. Honors
 * prefers-reduced-motion (CSS freezes the drift automatically).
 */
export default function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-base">
      {/* Deep base wash */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_-10%,#0d0d1a_0%,#07070c_55%,#050509_100%)]" />

      {/* Drifting aurora orbs */}
      <div className="absolute -left-[10%] top-[8%] h-[46vw] w-[46vw] rounded-full bg-indigo/40 blur-[120px] animate-drift1" />
      <div className="absolute right-[-8%] top-[18%] h-[42vw] w-[42vw] rounded-full bg-violet/35 blur-[130px] animate-drift2" />
      <div className="absolute bottom-[-14%] left-[24%] h-[48vw] w-[48vw] rounded-full bg-teal/25 blur-[140px] animate-drift3" />
      <div className="absolute bottom-[6%] right-[16%] h-[30vw] w-[30vw] rounded-full bg-magenta/20 blur-[120px] animate-drift1" />

      {/* Subtle moving light-leak sheen */}
      <div className="absolute inset-0 bg-[conic-gradient(from_120deg_at_60%_40%,transparent_0deg,rgba(139,92,246,0.06)_90deg,transparent_200deg)] animate-drift2" />

      {/* Fine grain to avoid banding on the blurs */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_50%,transparent_50%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}
