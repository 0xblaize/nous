/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Proxy API calls to the FastAPI backend during dev so the browser hits
    // the same origin (no CORS surprises) and audio URLs resolve cleanly.
    const backend = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";
    return [
      { source: "/api/:path*", destination: `${backend}/:path*` },
    ];
  },
};

export default nextConfig;
