import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  // Shown in About: the version from package.json and the day it was built.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().slice(0, 10),
  },
  // The service worker must never be served stale from a cache, or a fix to it
  // would not reach phones that already installed it.
  async headers() {
    return [
      {
        // Security headers on every page and file:
        // - no other site may show the app in a frame (clickjacking);
        // - browsers must not guess a file's type (an upload served as a page);
        // - only the site's own address is passed on when a link leaves it;
        // - HTTPS always (two years, every subdomain: soms.assetnxg.app etc.);
        // - the camera only for this site (photo capture), no microphone or location.
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
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
