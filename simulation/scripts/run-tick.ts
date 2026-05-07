// Local dev / one-shot tick runner.
// Run with: npm run simulation:tick
// Optional: npm run simulation:tick -- --date 2026-04-01

import { createClient } from "@supabase/supabase-js";
import { runTick } from "../lib/tick";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const dateArg = process.argv.find((a) => a.startsWith("--date="))?.split("=")[1];
  const tickDate = dateArg ? new Date(dateArg) : new Date();

  console.log(`Running tick for ${tickDate.toISOString().split("T")[0]}…`);
  const result = await runTick(sb, tickDate);

  console.log(`Agents active:     ${result.agentsActive}`);
  console.log(`Reviews generated: ${result.reviewsGenerated}`);
  console.log(`Cost:              $${result.totalCostUsd.toFixed(6)}`);
  if (result.errors.length > 0) {
    console.error(`Errors:`);
    result.errors.forEach((e) => console.error(`  ${e}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
