// One-off script: generate simulated history to populate the DB
// before opening to real users. Advances day by day from WEEKS ago to today.
//
// Run with: npm run simulation:bootstrap
// Pass --weeks=N to override the default (default: 1 for test, 12 for full run).
// Expected output (1 week): ~700-1,400 reviews, ~$4 total cost.
//
// Cost circuit breaker: stops at BOOTSTRAP_CAP regardless of progress.
// Progress is printed after each day. The script is safe to resume after
// interruption — it will skip venues/dates already reviewed (unique constraint).

import { createClient } from "@supabase/supabase-js";
import { runTick } from "../lib/tick";

const weeksArg = process.argv.find((a) => a.startsWith("--weeks="));
const WEEKS          = weeksArg ? parseInt(weeksArg.split("=")[1], 10) : 1;
const BOOTSTRAP_CAP  = WEEKS <= 1 ? 5 : 50; // USD — tighter cap for test runs

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - WEEKS * 7);
  startDate.setUTCHours(8, 0, 0, 0);

  const totalDays    = WEEKS * 7;
  let totalReviews   = 0;
  let totalCost      = 0;
  const allErrors: string[] = [];

  console.log(`Bootstrap: ${WEEKS}w / ${totalDays} days from ${startDate.toISOString().split("T")[0]} (cap $${BOOTSTRAP_CAP})`);

  for (let day = 0; day < totalDays; day++) {
    if (totalCost >= BOOTSTRAP_CAP) {
      console.log(`\nCost cap $${BOOTSTRAP_CAP} reached at day ${day}. Stopping.`);
      break;
    }

    const tickDate = new Date(startDate);
    tickDate.setUTCDate(startDate.getUTCDate() + day);

    const result = await runTick(sb, tickDate);

    totalReviews += result.reviewsGenerated;
    totalCost    += result.totalCostUsd;
    allErrors.push(...result.errors);

    const pct = ((day + 1) / totalDays * 100).toFixed(0);
    process.stdout.write(
      `\r[${pct}%] Day ${day + 1}/${totalDays}  ` +
      `active=${result.agentsActive}  ` +
      `reviews=${result.reviewsGenerated}  ` +
      `total=${totalReviews}  ` +
      `cost=$${totalCost.toFixed(2)}`,
    );
  }

  console.log(`\n\nBootstrap complete.`);
  console.log(`  Total reviews: ${totalReviews}`);
  console.log(`  Total cost:    $${totalCost.toFixed(4)}`);
  if (allErrors.length > 0) {
    console.error(`  Errors (${allErrors.length}):`);
    allErrors.slice(0, 20).forEach((e) => console.error(`    ${e}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
