import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Landing (light) tokens — per spec.
        "bg-base": "#EDEEF5",
        "brand-green": "#9fff00",
        // Dark-first tonal surfaces for the studio views.
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
        display: ["var(--font-display)", "sans-serif"],
      },
      backdropBlur: {
        glass: "18px",
      },
      keyframes: {
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
