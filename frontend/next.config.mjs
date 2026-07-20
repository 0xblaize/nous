import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Load the single project-wide .env at the repo root so the frontend and
// backend share one env file. Next only auto-loads .env* from the frontend
// folder, so we parse the root file here and surface NEXT_PUBLIC_* vars.
function loadRootEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const name of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(resolve(here, "..", name), "utf8");
      for (const line of raw.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq === -1) continue;
        const key = t.slice(0, eq).trim();
        const val = t.slice(eq + 1).trim();
        // Existing process.env (and frontend-local .env) win over the root file.
        if (key && process.env[key] === undefined) process.env[key] = val;
      }
    } catch {
      /* file absent — fine */
    }
  }
}
loadRootEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Fallback same-origin proxy for short calls. Long /generate requests
    // should hit the backend directly via NEXT_PUBLIC_API_BASE (see lib/api.ts).
    const backend = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${backend}/:path*` }];
  },
};

export default nextConfig;
