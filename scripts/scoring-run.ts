// CLI invocation of the full scoring pipeline. Same as POSTing to
// /api/scoring/run but without the HTTP round-trip. Intended for manual
// runs during debugging; production uses the API route via cron.
//
// Usage: `npm run scoring:run` (loads .env.local automatically).

import { runFullPipeline } from "../lib/scoring/pipeline";
import { createServiceRoleClient } from "../utils/supabase/service";
import { loadDotEnv } from "./_env";

async function main() {
  loadDotEnv();
  const sb = createServiceRoleClient();
  const report = await runFullPipeline(sb);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
