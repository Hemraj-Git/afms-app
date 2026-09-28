import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The service worker must never be served stale from a cache, or a fix to it
  // would not reach phones that already installed it.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
