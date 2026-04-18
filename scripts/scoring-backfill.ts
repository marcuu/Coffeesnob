// One-off backfill script. Runs the full pipeline against every row in the
// database regardless of dirty-queue state, then prints a summary. Intended
// for the rollout described in docs/scoring.md Section 8, PR 3: run against
// staging first, inspect, then production.
//
// Usage: `npm run scoring:backfill` (loads .env.local automatically).

import { runFullPipeline } from "../lib/scoring/pipeline";
import { createServiceRoleClient } from "../utils/supabase/service";
import { loadDotEnv } from "./_env";

async function main() {
  loadDotEnv();
  const sb = createServiceRoleClient();
  const started = Date.now();
  console.log("Starting scoring backfill...");
  const report = await runFullPipeline(sb);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Backfill complete in ${elapsed}s\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.venuesMovedOverall.length > 0) {
    console.log(
      `\nVenues whose 'overall' score moved by >0.3: ${report.venuesMovedOverall.length}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
