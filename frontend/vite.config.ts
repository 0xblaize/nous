import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // "@/components/…" and "@/lib/…" resolve from the frontend root, so the
    // existing component tree ports over untouched.
    alias: { "@": here },
  },
  // Single project-wide .env lives at the repo root (shared with the backend).
  envDir: resolve(here, ".."),
  server: {
    port: 3000,
    // Short calls can use the /api proxy; long generate runs go direct via
    // VITE_API_BASE (see lib/api.ts).
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
