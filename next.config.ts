import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  // Shown in About: the version from package.json and the day it was built.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().slice(0, 10),
    // Error monitoring: which deployment an error came from (src/lib/sentry.ts).
    NEXT_PUBLIC_DEPLOY_ENV: process.env.VERCEL_ENV ?? "local",
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

// Error monitoring (Sentry). With SENTRY_AUTH_TOKEN, SENTRY_ORG and
// SENTRY_PROJECT set (Vercel), each build uploads its source maps, so errors
// point at the real line of code, then deletes them from the published files.
// Without them (a local build) nothing is uploaded and the build is unchanged.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  // A failed upload (wrong token, Sentry down) must never stop a deploy: warn
  // and build anyway; that build's errors then show minified stack traces.
  errorHandler: err => {
    console.warn(`Sentry source map upload failed: ${err.message}`);
  },
});
