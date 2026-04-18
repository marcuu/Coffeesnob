import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client for scoring pipeline writes. RLS is bypassed,
// so this client must never be exposed to user traffic — use it only from
// cron-driven API routes and CLI scripts.
//
// Needs SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local in dev,
// project env var in production). NEXT_PUBLIC_SUPABASE_URL is reused.
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;
