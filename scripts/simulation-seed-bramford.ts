import { loadDotEnv } from "./_env";
import { createServiceRoleClient } from "../utils/supabase/service";
import { loadBramfordVenues } from "../simulation/lib/persona-loader";

async function main() {
  loadDotEnv();
  const sb = createServiceRoleClient();
  const venues = loadBramfordVenues();

  const { data: creator, error: creatorError } = await sb
    .from("reviewers")
    .select("id")
    .eq("is_synthetic", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (creatorError) throw creatorError;
  if (!creator) throw new Error("Seed personas before seeding Bramford venues");

  let seeded = 0;
  for (const venue of venues) {
    const { data, error } = await sb
      .from("venues")
      .upsert(
        {
          slug: venue.slug,
          name: venue.name,
          address_line1: venue.address_line1,
          city: "Bramford",
          postcode: venue.postcode,
          country: "GB",
          roasters: venue.roasters,
          brew_methods: venue.brew_methods,
          has_decaf: venue.has_decaf,
          has_plant_milk: venue.has_plant_milk,
          notes: `${venue.prompt_description}\n\nBramford is fictional and part of the Coffeesnob calibration simulation.`,
          created_by: creator.id,
          is_fictional: true,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (error) throw error;

    const { error: profileError } = await sb.from("simulation_venue_profiles").upsert(
      {
        venue_id: data.id,
        city_slug: "bramford",
        neighbourhood: venue.neighbourhood,
        category: venue.category,
        prompt_description: venue.prompt_description,
        attribute_vector: venue.attribute_vector,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "venue_id" },
    );
    if (profileError) throw profileError;
    seeded++;
  }

  console.log(JSON.stringify({ seeded }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
