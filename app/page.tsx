// Landing page — also the personalised venue feed for signed-in users.
//
// Routing note: the /onboarding experience previously lived at app/onboarding/
// and is now served from / (this file). The app/onboarding/ directory is kept
// intact so that test imports from @/app/onboarding/data and
// @/app/onboarding/venue-mapping continue to resolve without changes.
// app/onboarding/page.tsx issues a 308 permanent redirect to / instead.
//
// Auth branching:
//   Logged-in  → <OnboardingApp> with full personalisation (sidebar, localStorage,
//                aha reveal, nudge).
//   Logged-out → <Leaderboard> with score-desc feed only; no personalisation.
//
// The middleware marks "/" as public so unauthenticated requests are not
// redirected to /login before reaching this page.

import type { Metadata } from "next";

import { getVenueOverallScores } from "@/lib/aggregation";
import type { Venue as DbVenue } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

import { Leaderboard } from "./onboarding/leaderboard";
import { OnboardingApp } from "./onboarding/onboarding-app";
import {
  buildRegionOptions,
  mapDbVenuesToOnboarding,
} from "./onboarding/venue-mapping";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coffeesnob — UK third-wave coffee, reviewed honestly",
  description:
    "The UK third-wave coffee leaderboard, ranked by weighted reviewer scores. Sign in to personalise the feed for your taste.",
};

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: { user } }, { data, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("venues").select("*").order("name", { ascending: true }),
  ]);

  // Resolve profile URL for the nav link (only needed for the signed-in path).
  let profileHref = "/profile";
  if (user) {
    const { data: reviewer } = await supabase
      .from("reviewers")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    if (reviewer?.username) profileHref = `/profile/${reviewer.username}`;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Coffeesnob</h1>
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

  if (user) {
    const regions = buildRegionOptions(venues);
    return <OnboardingApp venues={venues} regions={regions} profileHref={profileHref} />;
  }

  // Logged-out path: sort by weighted score descending for the leaderboard.
  const sorted = [...venues].sort((a, b) => b.score - a.score);
  return <Leaderboard venues={sorted} />;
}
