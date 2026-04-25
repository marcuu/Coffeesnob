import { headers } from "next/headers";

// Determines the base URL of the current deployment so that auth callbacks
// always point back to the right environment (local, Vercel preview, or prod).
// Priority: explicit NEXT_PUBLIC_SITE_URL → Vercel auto-injected VERCEL_URL →
// request Origin header → localhost fallback.
export async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const origin = (await headers()).get("origin");
  if (origin) return origin;
  return "http://localhost:3000";
}
