import type { Metadata } from "next";

import { getVenueOverallScores } from "@/lib/aggregation";
import type { Venue as DbVenue } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

import { OnboardingApp } from "./onboarding-app";
import {
  buildCityOptions,
  mapDbVenuesToOnboarding,
} from "./venue-mapping";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Onboarding · Coffeesnob",
  description:
    "Browse UK third-wave coffee venues, then tell Coffeesnob your taste for a personalised shortlist.",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Onboarding</h1>
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
  const cities = buildCityOptions(venues);

  return <OnboardingApp venues={venues} cities={cities} />;
}
