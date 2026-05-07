// Daily simulation tick endpoint. Modelled on app/api/scoring/run/route.ts.
// Secured with SIMULATION_CRON_SECRET bearer token.
// Vercel calls this via the cron entry in vercel.json.

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runTick } from "@/simulation/lib/tick";

const SIMULATION_CRON_SECRET = process.env.SIMULATION_CRON_SECRET;
const MONTHLY_COST_CAP_USD   = 20;

function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

export async function POST(req: NextRequest) {
  if (!SIMULATION_CRON_SECRET || bearerToken(req) !== SIMULATION_CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Monthly cost circuit breaker.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data: monthTicks } = await sb
    .from("simulation_ticks")
    .select("total_cost_usd")
    .gte("tick_at", monthStart.toISOString());

  const monthlySpend = (monthTicks ?? []).reduce(
    (sum: number, t: { total_cost_usd: number | null }) =>
      sum + (t.total_cost_usd ?? 0),
    0,
  );

  if (monthlySpend >= MONTHLY_COST_CAP_USD) {
    return NextResponse.json({
      skipped:          true,
      reason:           "monthly_cost_cap",
      monthlySpendUsd:  monthlySpend,
      capUsd:           MONTHLY_COST_CAP_USD,
    });
  }

  try {
    const result = await runTick(sb);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Simulation tick failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
