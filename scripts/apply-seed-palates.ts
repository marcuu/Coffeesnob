// Applies the seed-palate registry (lib/scoring/seed-palates.ts) to the
// database: sets reviewers.status = 'beaned' for each listed username so their
// reviews anchor scores from day one (PRD Workstream E).
//
// Idempotent: re-running only promotes reviewers not already 'beaned', and
// reports anyone in the registry who has no matching reviewers row. It never
// demotes anyone — automated promotion/demotion from measured validity is a
// planned follow-up (Workstream F → E).
//
// Usage: `npm run scoring:seed-palates` (loads .env.local automatically).

import {
  SEED_PALATES,
  validateSeedPalates,
} from "../lib/scoring/seed-palates";
import { createServiceRoleClient } from "../utils/supabase/service";
import { loadDotEnv } from "./_env";

async function main() {
  loadDotEnv();

  const palates = validateSeedPalates();
  if (palates.length === 0) {
    console.log(
      "No seed palates configured. Add entries to lib/scoring/seed-palates.ts " +
        "(see docs/seed-palates.md) and re-run.",
    );
    return;
  }

  const sb = createServiceRoleClient();
  const usernames = palates.map((p) => p.username);

  const { data: rows, error } = await sb
    .from("reviewers")
    .select("id, username, status")
    .in("username", usernames);
  if (error) throw error;

  const byUsername = new Map(
    (rows ?? []).map((r: { id: string; username: string | null; status: string }) => [
      (r.username ?? "").toLowerCase(),
      r,
    ]),
  );

  const missing: string[] = [];
  const toPromote: Array<{ id: string; username: string; justification: string }> = [];
  for (const p of palates) {
    const row = byUsername.get(p.username.toLowerCase());
    if (!row) {
      missing.push(p.username);
      continue;
    }
    if (row.status !== "beaned") {
      toPromote.push({ id: row.id, username: p.username, justification: p.justification });
    }
  }

  for (const r of toPromote) {
    const { error: updErr } = await sb
      .from("reviewers")
      .update({ status: "beaned" })
      .eq("id", r.id);
    if (updErr) throw updErr;
    console.log(`Crowned @${r.username} as beaned — ${r.justification}`);
  }

  console.log(
    `\nSeed palates: ${palates.length} configured, ${toPromote.length} newly ` +
      `crowned, ${palates.length - toPromote.length - missing.length} already beaned.`,
  );
  if (missing.length > 0) {
    console.warn(
      `\n⚠ No reviewers row for: ${missing.join(", ")}. They were skipped — ` +
        "check the username matches reviewers.username.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
