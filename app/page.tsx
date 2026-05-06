// Landing page - the public real-city leaderboard.

import type { Metadata } from "next";

import { getVenueOverallScores } from "@/lib/aggregation";
import type { Venue as DbVenue } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

import { Leaderboard } from "./onboarding/leaderboard";
import { mapDbVenuesToOnboarding } from "./onboarding/venue-mapping";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Caffeinesnobs - UK third-wave coffee, reviewed honestly",
  description:
    "The UK third-wave coffee leaderboard, ranked by weighted reviewer scores. Sign in to personalise the feed for your taste.",
};

export default async function HomePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("venues")
    .select("id,slug,name,city,roasters,brew_methods,has_plant_milk,notes,is_fictional")
    .eq("is_fictional", false)
    .order("name", { ascending: true });

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Caffeinesnobs</h1>
        <p className="mt-4 text-sm text-[var(--color-destructive)]">
          Couldn&rsquo;t load venues: {error.message}
        </p>
      </main>
    );
  }

  const dbVenues = (data ?? []) as DbVenue[];
  const scores =
    dbVenues.length > 0
      ? await getVenueOverallScores(
          supabase,
          dbVenues.map((v) => v.id),
        )
      : new Map();

  const venues = mapDbVenuesToOnboarding(dbVenues, scores);
  const sorted = [...venues].sort((a, b) => b.score - a.score);
  return <Leaderboard venues={sorted} />;
}
