import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const LINKS = ["how it works", "your library", "voices", "about nous"];

/** Fixed glass navbar — 12-col grid, clover mark, mobile drawer. */
export default function Navbar({
  onGetStarted,
  onSignIn,
}: {
  onGetStarted: () => void;
  onSignIn: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 w-full z-50 py-6 md:py-10 bg-gradient-to-b from-[#f1f1f1]/80 to-transparent backdrop-blur-[2px]">
      <div className="grid grid-cols-12 max-w-7xl mx-auto items-center gap-x-4 px-8 md:px-16 lg:px-20">
        {/* Left — brand */}
        <div className="col-span-6 md:col-span-3 flex items-center gap-2.5">
          <CloverIcon />
          <span className="font-display text-lg font-semibold tracking-tight text-[#1a1a1a]">
            nous
          </span>
        </div>

        {/* Center — desktop links */}
        <nav className="hidden md:col-span-6 md:flex items-center justify-center gap-7">
          {LINKS.map((l) => (
            <a
              key={l}
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-[13px] lowercase text-zinc-600 transition-colors hover:text-[#1a1a1a]"
            >
              {l}
            </a>
          ))}
        </nav>

        {/* Right — actions */}
        <div className="col-span-6 md:col-span-3 flex items-center justify-end gap-4">
          <button
            onClick={onSignIn}
            className="hidden sm:block text-[13px] lowercase text-zinc-700 transition-colors hover:text-[#1a1a1a]"
          >
            sign in
          </button>
          <button
            onClick={onGetStarted}
            className="rounded-full bg-[#1a1a1a] px-5 py-2.5 text-[13px] font-medium text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            get started →
          </button>

          {/* Mobile hamburger */}
          <button
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
            className="relative grid h-9 w-9 place-items-center md:hidden"
          >
            <span
              className={`absolute h-[1.5px] w-5 bg-[#1a1a1a] transition-all duration-300 ${
                open ? "rotate-45" : "-translate-y-[4px]"
              }`}
            />
            <span
              className={`absolute h-[1.5px] w-5 bg-[#1a1a1a] transition-all duration-300 ${
                open ? "-rotate-45" : "translate-y-[4px]"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mx-6 mt-4 rounded-2xl border border-black/[0.06] bg-white/90 p-5 shadow-lg backdrop-blur-md md:hidden"
          >
            <nav className="flex flex-col gap-4">
              {LINKS.map((l) => (
                <a
                  key={l}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpen(false);
                  }}
                  className="text-sm lowercase text-zinc-700 transition-colors hover:text-[#1a1a1a]"
                >
                  {l}
                </a>
              ))}
              <button
                onClick={() => {
                  setOpen(false);
                  onGetStarted();
                }}
                className="mt-1 rounded-full bg-[#1a1a1a] py-2.5 text-sm font-medium text-white"
              >
                get started →
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/** Geometric four-petal clover mark. */
function CloverIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <g fill="#1a1a1a">
        <circle cx="12" cy="6.5" r="4.5" />
        <circle cx="12" cy="17.5" r="4.5" />
        <circle cx="6.5" cy="12" r="4.5" />
        <circle cx="17.5" cy="12" r="4.5" />
      </g>
    </svg>
  );
}
