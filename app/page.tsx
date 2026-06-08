// Landing page — the public leaderboard.
//
// Signed-in users land at /onboarding on first sign-in (auth callback) and
// at /list once they've completed onboarding. The flavour-pair quiz that
// previously lived on / has been replaced by the priming flow at
// /onboarding (see app/onboarding/page.tsx). Both signed-in and signed-out
// users see the same score-sorted leaderboard at /, with nav/copy adjusted
// for the current session.

import type { Metadata } from "next";

import { getVenueOverallScores } from "@/lib/aggregation";
import type { Venue as DbVenue } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

import { Leaderboard } from "./onboarding/leaderboard";
import { mapDbVenuesToOnboarding } from "./onboarding/venue-mapping";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Caffiends — UK third-wave coffee, reviewed honestly",
  description:
    "The UK third-wave coffee leaderboard, ranked by reviewers who know their coffee. Sign in to personalise the feed for your taste.",
};

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: { user } }, { data, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("venues")
      .select("id,slug,name,city,roasters,brew_methods,has_plant_milk,notes")
      .neq("city", "bramford")
      .order("name", { ascending: true }),
  ]);

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Caffiends</h1>
        <p className="mt-4 text-sm text-[var(--color-destructive)]">
          Couldn&rsquo;t load venues: {error.message}
        </p>
      </main>
    );
  }

  let profileHref = "/login";
  let profileLabel = "Sign in";
  if (user) {
    const { data: reviewer } = await supabase
      .from("reviewers")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle();
    if (reviewer?.username) profileHref = `/profile/${reviewer.username}`;
    profileLabel = reviewer?.display_name ?? reviewer?.username ?? "Profile";
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
  return (
    <Leaderboard
      venues={sorted}
      isLoggedIn={!!user}
      profileHref={profileHref}
      profileLabel={profileLabel}
    />
  );
}
