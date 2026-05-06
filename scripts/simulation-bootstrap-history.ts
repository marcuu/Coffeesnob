import { loadDotEnv } from "./_env";
import { createServiceRoleClient } from "../utils/supabase/service";
import { runSimulationTick } from "../simulation/lib/tick";

const DAY_MS = 86_400_000;
const WEEKS = 12;

async function main() {
  loadDotEnv();
  const sb = createServiceRoleClient();
  const end = new Date();
  const start = new Date(end.getTime() - WEEKS * 7 * DAY_MS);
  const reports = [];

  for (let i = 0; i < WEEKS * 7; i++) {
    const now = new Date(start.getTime() + i * DAY_MS);
    reports.push(await runSimulationTick(sb, { now, seed: `bootstrap:${i}` }));
  }

  const reviewsGenerated = reports.reduce((sum, r) => sum + r.reviewsGenerated, 0);
  const totalCostUsd = reports.reduce((sum, r) => sum + r.totalCostUsd, 0);
  console.log(JSON.stringify({ days: reports.length, reviewsGenerated, totalCostUsd }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
