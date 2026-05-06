import { loadDotEnv } from "./_env";
import { createServiceRoleClient } from "../utils/supabase/service";
import { runSimulationTick } from "../simulation/lib/tick";

async function main() {
  loadDotEnv();
  const sb = createServiceRoleClient();
  const report = await runSimulationTick(sb);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
