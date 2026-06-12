// Landing page — the canonical public leaderboard.
//
// /rankings and /rankings/[region] permanently redirect here; region filtering
// is handled with the ?city= search param plus a cookie remembering the
// visitor's last-chosen region (first visit defaults to All UK). The full
// venue catalogue — including everything not yet ranked — lives at /venues.

import type { Metadata } from "next";
import { cookies } from "next/headers";

import { CITY_COOKIE } from "@/components/CityChips";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import { SiteHeader } from "@/components/site-header";
import { getVenueOverallScores } from "@/lib/aggregation";
import { buildRankings } from "@/lib/rankings";
import { buildRegionFilterOptions } from "@/lib/venues";
import type { Venue } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Caffiends — UK third-wave coffee, reviewed honestly",
  description:
    "The UK third-wave coffee leaderboard, ranked by weighted reviewer scores. Sign in to personalise the feed for your taste.",
  openGraph: {
    title: "Caffiends — UK third-wave coffee, reviewed honestly",
    description:
      "The UK third-wave coffee leaderboard, ranked by weighted reviewer scores.",
    type: "website",
    siteName: "Caffiends",
  },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const [{ city: cityParam }, cookieStore, supabase] = await Promise.all([
    searchParams,
    cookies(),
    createClient(),
  ]);

  const [{ data: { user } }, { data, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("venues")
      .select("*")
      .neq("city", "bramford")
      .order("name", { ascending: true }),
  ]);

  if (error) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-xl px-6 py-16">
          <h1 className="text-2xl font-semibold">Caffiends</h1>
          <p className="mt-4 text-sm text-[var(--color-destructive)]">
            Couldn&rsquo;t load venues: {error.message}
          </p>
        </main>
      </>
    );
  }

  const venues = (data ?? []) as Venue[];
  const regions = buildRegionFilterOptions(venues.map((v) => v.city));

  // Explicit ?city= wins; otherwise fall back to the remembered cookie.
  // Unknown ids (or "all") resolve to the UK-wide view.
  const requested = cityParam ?? cookieStore.get(CITY_COOKIE)?.value ?? "";
  const activeRegion = regions.find((r) => r.id === requested) ?? null;

  const scopedVenues = activeRegion
    ? venues.filter((v) => activeRegion.cities.includes(v.city))
    : venues;

  const weightedScores =
    scopedVenues.length > 0
      ? await getVenueOverallScores(
          supabase,
          scopedVenues.map((v) => v.id),
        )
      : new Map();

  const { ranked, unranked } = buildRankings(scopedVenues, weightedScores);

  return (
    <>
      <SiteHeader />
      <Leaderboard
        ranked={ranked}
        unranked={unranked}
        regions={regions}
        activeRegion={
          activeRegion ? { id: activeRegion.id, name: activeRegion.name } : null
        }
        isLoggedIn={!!user}
      />
    </>
  );
}
