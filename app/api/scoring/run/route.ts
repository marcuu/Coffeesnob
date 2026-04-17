import { NextResponse } from "next/server";

import { runFullPipeline } from "@/lib/scoring/pipeline";
import { createServiceRoleClient } from "@/utils/supabase/service";

// POST-only. Bearer-token auth against SCORING_CRON_SECRET. Invoked by the
// nightly cron; not exposed to user traffic. See docs/scoring.md Section 3.

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.SCORING_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "SCORING_CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!provided || !timingSafeEqual(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = createServiceRoleClient();
  try {
    const report = await runFullPipeline(sb);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Constant-time string comparison to avoid secret leakage via timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
