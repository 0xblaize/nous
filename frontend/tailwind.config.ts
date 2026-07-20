import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark-first tonal surfaces (elevation via luminance, not shadow).
        base: "#07070c",
        surface: "rgba(255,255,255,0.04)",
        "surface-2": "rgba(255,255,255,0.06)",
        hairline: "rgba(255,255,255,0.10)",
        // Aurora accent hues.
        indigo: "#6366f1",
        violet: "#8b5cf6",
        teal: "#2dd4bf",
        magenta: "#e879f9",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      backdropBlur: {
        glass: "18px",
      },
      keyframes: {
        drift1: {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(6vw,4vh) scale(1.15)" },
        },
        drift2: {
          "0%,100%": { transform: "translate(0,0) scale(1.1)" },
          "50%": { transform: "translate(-7vw,-5vh) scale(0.95)" },
        },
        drift3: {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "50%": { transform: "translate(5vw,-6vh) scale(1.2)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseGlow: {
          "0%,100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        breathe: {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.04)" },
        },
      },
      animation: {
        drift1: "drift1 42s ease-in-out infinite",
        drift2: "drift2 55s ease-in-out infinite",
        drift3: "drift3 48s ease-in-out infinite",
        fadeUp: "fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 2.4s linear infinite",
        pulseGlow: "pulseGlow 3.5s ease-in-out infinite",
        breathe: "breathe 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
