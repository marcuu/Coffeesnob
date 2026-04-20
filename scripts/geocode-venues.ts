import { geocodeUkPostcode } from "../lib/geocoding/google";
import { createServiceRoleClient } from "../utils/supabase/service";
import { loadDotEnv } from "./_env";

type VenueRow = {
  id: string;
  slug: string;
  postcode: string;
};

const REQUESTS_PER_SECOND = 10;
const MIN_DELAY_MS = Math.ceil(1000 / REQUESTS_PER_SECOND);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocodeWithRetry(postcode: string): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  let attempt = 0;

  while (attempt < 5) {
    const res = await geocodeUkPostcode(postcode);
    if (res.status === "ok") return res.result;
    if (res.status === "not_found") return null;

    if (res.status === "quota_limited") {
      const waitMs = Math.min(30_000, 1_000 * 2 ** attempt);
      console.warn(`Quota limited. Backing off for ${waitMs}ms.`);
      await sleep(waitMs);
      attempt += 1;
      continue;
    }

    console.warn(`Geocode failed for ${postcode}: ${res.message}`);
    return null;
  }

  return null;
}

async function main() {
  loadDotEnv();

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("venues")
    .select("id, slug, postcode")
    .or("latitude.is.null,longitude.is.null")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const venues = (data ?? []) as VenueRow[];
  if (venues.length === 0) {
    console.log("No venues require geocoding.");
    return;
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`Geocoding ${venues.length} venues at <= ${REQUESTS_PER_SECOND} req/s...`);

  for (const venue of venues) {
    const started = Date.now();

    try {
      const coords = await geocodeWithRetry(venue.postcode);
      if (!coords) {
        skipped += 1;
      } else {
        const { error: updateError } = await sb
          .from("venues")
          .update({ latitude: coords.latitude, longitude: coords.longitude })
          .eq("id", venue.id);

        if (updateError) {
          failed += 1;
          console.warn(`Failed updating ${venue.slug}: ${updateError.message}`);
        } else {
          updated += 1;
          console.log(`Updated ${venue.slug} -> ${coords.latitude}, ${coords.longitude}`);
        }
      }
    } catch (err) {
      failed += 1;
      console.warn(
        `Geocode failed for ${venue.slug}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const elapsed = Date.now() - started;
    if (elapsed < MIN_DELAY_MS) {
      await sleep(MIN_DELAY_MS - elapsed);
    }
  }

  console.log(`Done. updated=${updated} skipped=${skipped} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
