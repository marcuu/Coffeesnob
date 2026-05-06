import { NextResponse } from "next/server";

import { runSimulationTick } from "@/simulation/lib/tick";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  return handle(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handle(request);
}

async function handle(request: Request): Promise<NextResponse> {
  const secret = process.env.SIMULATION_CRON_SECRET ?? process.env.CRON_SECRET;
  if (!secret) {
    console.error("[simulation/tick] SIMULATION_CRON_SECRET is not configured");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!provided || !timingSafeEqual(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const requestId = crypto.randomUUID();
  try {
    const report = await runSimulationTick(createServiceRoleClient());
    return NextResponse.json({ requestId, ...report });
  } catch (err) {
    console.error(`[simulation/tick] requestId=${requestId}`, err);
    return NextResponse.json({ error: "internal_error", requestId }, { status: 500 });
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
