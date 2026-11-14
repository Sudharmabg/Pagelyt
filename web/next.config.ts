import type { NextConfig } from "next";

/* Content-Security-Policy (production only: the dev server needs eval and websockets for hot reload).
   Next.js writes small inline bootstrap scripts, so script-src has to allow 'unsafe-inline' unless every page
   is rendered per request with a nonce, which would cost this site its caching. What this still blocks:
   plugins and <object>, other sites framing us, form posts to other sites, a changed <base>, and scripts or
   connections to origins that are not listed. */
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "https://*.supabase.co";
  }
})();
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} https://challenges.cloudflare.com`,
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Lets a test build go to its own folder so it never touches a running dev server's cache.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
  // Cache Components hangs on the Workers runtime (setTimeout semantics), so it stays off for Cloudflare.
  cacheComponents: false,
  // Lets a phone on the same Wi-Fi load the dev server's scripts (otherwise buttons do nothing there).
  allowedDevOrigins: ["192.168.0.100", "192.168.*.*"],
  async redirects() {
    return [
      /* http → https. Cloudflare tells the Worker the visitor's scheme in X-Forwarded-Proto. Without this,
         http://pagelyt.dev answered 200 and Google indexed the http address. Limited to the live host so
         preview and local hosts are untouched; Next keeps the query string. */
      {
        source: "/:path*",
        has: [
          { type: "header", key: "x-forwarded-proto", value: "http" },
          { type: "host", value: "pagelyt.dev" },
        ],
        destination: "https://pagelyt.dev/:path*",
        permanent: true,
      },
      // The analytics feature page became the Google integrations hub.
      { source: "/features/analytics-integrations", destination: "/features/google-integrations", permanent: true },
    ];
  },
  // Security headers on every page. (The Pagelyt scan checks for exactly these.)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: csp }] : []),
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
