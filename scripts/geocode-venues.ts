// One-off backfill: geocode every venue that has a postcode but no
// coordinates, using the free postcodes.io bulk endpoint (max 100 per call).
//
// Usage: `npx tsx scripts/geocode-venues.ts` (loads .env.local automatically;
// needs SUPABASE_SERVICE_ROLE_KEY).

import { createServiceRoleClient } from "../utils/supabase/service";
import { loadDotEnv } from "./_env";

const BULK_URL = "https://api.postcodes.io/postcodes";
const BATCH = 100;

type BulkResult = {
  result: Array<{
    query: string;
    result: { latitude: number; longitude: number } | null;
  }>;
};

async function main() {
  loadDotEnv();
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("venues")
    .select("id, name, postcode")
    .is("latitude", null);
  if (error) throw error;

  const venues = (data ?? []).filter((v) => v.postcode?.trim());
  console.log(`${venues.length} venues need geocoding`);

  let updated = 0;
  let misses = 0;
  for (let i = 0; i < venues.length; i += BATCH) {
    const batch = venues.slice(i, i + BATCH);
    const res = await fetch(BULK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcodes: batch.map((v) => v.postcode.trim()) }),
    });
    if (!res.ok) throw new Error(`postcodes.io bulk lookup failed: ${res.status}`);
    const json = (await res.json()) as BulkResult;

    const byQuery = new Map(
      json.result.map((r) => [r.query.toUpperCase(), r.result]),
    );
    for (const v of batch) {
      const hit = byQuery.get(v.postcode.trim().toUpperCase());
      if (!hit) {
        misses += 1;
        console.warn(`  no match: ${v.name} (${v.postcode})`);
        continue;
      }
      const { error: updateErr } = await supabase
        .from("venues")
        .update({ latitude: hit.latitude, longitude: hit.longitude })
        .eq("id", v.id);
      if (updateErr) {
        console.error(`  update failed for ${v.name}: ${updateErr.message}`);
        continue;
      }
      updated += 1;
    }
  }

  console.log(`done: ${updated} updated, ${misses} postcodes not found`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
