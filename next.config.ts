import type { NextConfig } from "next";

// CSP starts in report-only mode. After 48 h with no violations in the console,
// rename the key to "Content-Security-Policy" to enforce.
const cspValue = [
  "default-src 'self'",
  // Next.js requires unsafe-inline/eval for hydration and dev HMR.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  // lh3.googleusercontent.com serves Google OAuth profile avatars.
  // images.unsplash.com serves editorial venue photography.
  // avatar_url accepts any valid URL, so add known external sources here as
  // they are identified rather than switching img-src to the broad https: scheme.
  "img-src 'self' *.supabase.co lh3.googleusercontent.com images.unsplash.com data: blob:",
  "connect-src 'self' *.supabase.co wss://*.supabase.co",
  "font-src 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy-Report-Only", value: cspValue },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
