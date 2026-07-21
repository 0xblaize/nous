import { useState } from "react";
import { motion } from "motion/react";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260603_132049_036591b8-6e92-4760-b94c-a7ea6eef315c.mp4";

/**
 * Landing hero — full-bleed video anchored on #EDEEF5. Copy speaks to what
 * Nous is: any document or voice note becomes a two-host podcast episode.
 */
export default function Hero({ onEnter }: { onEnter: (topic?: string) => void }) {
  const [ask, setAsk] = useState("");

  return (
    <section className="relative min-h-[110vh] sm:min-h-[140vh] w-full flex flex-col items-center justify-start overflow-hidden bg-bg-base">
      {/* Background video */}
      <div className="absolute top-[15vh] sm:top-[20vh] left-0 w-full h-[95vh] sm:h-[120vh] z-0 pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-100"
          src={VIDEO_URL}
        />
        {/* Blend the video's top edge into the page background */}
        <div className="absolute top-0 left-0 w-full h-24 sm:h-32 bg-gradient-to-b from-bg-base to-transparent"></div>
      </div>

      {/* Hero content */}
      <div className="max-w-7xl w-full mx-auto px-8 md:px-16 lg:px-20 relative z-10 grid grid-cols-12 gap-x-4 md:gap-x-8 pt-36 md:pt-44">
        <div className="col-span-12 md:col-span-10 md:col-start-2">
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium leading-[1.08] tracking-tight"
          >
            <span className="text-[#1a1a1a]">Nous turns </span>
            <span className="text-[#8e8e8e]">anything you read</span>
            <br />
            <span className="text-[#8e8e8e]">— or say — into a ten-minute</span>
            <br />
            <span className="text-[#8e8e8e]">
              two-host{" "}
              <span className="w-[16px] md:w-[42px] lg:w-[62px] h-[0.62em] border-[2px] border-[#1a1a1a] rounded-full inline-flex items-center justify-center align-middle">
                <span className="w-2 h-2 rounded-full bg-black" />
              </span>{" "}
              podcast episode.
            </span>
          </motion.h1>

          {/* Ask pill — the topic goes straight into the studio */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="mt-8 max-w-md"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onEnter(ask.trim() || undefined);
              }}
              className="bg-white rounded-[6px] border border-black/[0.05] p-1 pl-4 flex items-center shadow-sm"
            >
              <input
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                placeholder="What do you want to learn tonight?"
                className="flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none"
              />
              <button
                type="submit"
                aria-label="Start learning"
                className="bg-[#1a1a1a] text-white w-9 h-9 rounded-full relative grid place-items-center transition-transform hover:scale-105 active:scale-95"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </form>
            <p className="mt-3 text-[12px] text-zinc-500">
              drop a PDF, speak a voice note — two calm hosts talk you through
              it, and remember what confused you for next time.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Edge anchors */}
      <button
        className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/40 bg-white/30 px-3 py-1.5 text-[11px] lowercase text-zinc-800 shadow-sm backdrop-blur-md transition hover:bg-white/50"
        aria-label="Switch language"
      >
        pl — en
      </button>
      <span className="absolute bottom-4 left-6 z-10 text-[11px] text-zinc-600">
        2026
      </span>
      <span className="absolute bottom-4 right-6 z-10 text-[11px] lowercase text-zinc-600">
        micro-learning tools
      </span>
    </section>
  );
}
