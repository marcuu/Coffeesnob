// One-off script: create fictional Bramford venues from bramford-seed.yaml.
// Run with: npm run simulation:seed-bramford
//
// Requires a system user whose UUID will be used as created_by for all venues.
// Set SIMULATION_SYSTEM_USER_ID in env, or the script will use the first
// synthetic reviewer it finds.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, any, any>;
import { parse as parseYaml } from "yaml";
import { readFileSync } from "fs";
import { join } from "path";

const SEED_FILE = join(__dirname, "../venues/bramford-seed.yaml");
const EMAIL_DOMAIN = "bramford.internal.caffiends.app";

type VenueSpec = {
  id: string;
  name: string;
  slug: string;
  neighbourhood: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  description: string;
  attribute_vector: Record<string, number>;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const sb: Sb = createClient(url, key, { auth: { persistSession: false } });

  // Resolve created_by user.
  const systemUserId = await resolveSystemUser(sb);
  console.log(`Using system user: ${systemUserId}`);

  const raw = readFileSync(SEED_FILE, "utf-8");
  const { venues } = parseYaml(raw) as { venues: VenueSpec[] };
  console.log(`Seeding ${venues.length} Bramford venues…`);

  for (const venue of venues) {
    await seedVenue(sb, venue, systemUserId);
  }

  console.log("Done.");
}

async function resolveSystemUser(sb: Sb): Promise<string> {
  if (process.env.SIMULATION_SYSTEM_USER_ID) {
    return process.env.SIMULATION_SYSTEM_USER_ID;
  }
  // Fall back to first synthetic reviewer.
  const { data, error } = await sb
    .from("reviewers")
    .select("id")
    .eq("is_synthetic", true)
    .limit(1)
    .single();
  if (error || !data) {
    throw new Error(
      "No SIMULATION_SYSTEM_USER_ID set and no synthetic reviewers found. " +
      "Run seed-personas.ts first.",
    );
  }
  return data.id;
}

async function seedVenue(sb: Sb, venue: VenueSpec, createdBy: string) {
  console.log(`  → ${venue.name} (${venue.slug})`);

  const { error } = await sb.from("venues").upsert(
    {
      slug: venue.slug,
      name: venue.name,
      address_line1: venue.address_line1,
      address_line2: venue.address_line2,
      city: venue.city,
      postcode: venue.postcode,
      country: "GB",
      notes: venue.description.trim(),
      is_fictional: true,
      attribute_vector: venue.attribute_vector,
      created_by: createdBy,
    },
    { onConflict: "slug" },
  );

  if (error) {
    throw new Error(`venues upsert failed for ${venue.slug}: ${error.message}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
