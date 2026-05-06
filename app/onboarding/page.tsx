// /onboarding — mandatory cold-start priming flow for new users. See
// docs/cold-start.md (PRD) for the user journey. Once seen_onboarding_at
// is set, the gate in utils/supabase/middleware.ts unblocks the rest of
// the app and a re-visit redirects to /list.

import { redirect } from "next/navigation";

import type { Review } from "@/lib/types";
import { sanitizeNext } from "@/lib/sanitize-next";
import { createClient } from "@/utils/supabase/server";

import { PrimingApp, type PrimingVenue, type PrimingReviewSummary } from "./priming-app";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = sanitizeNext(params.next ?? "/list");
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: reviewer } = await supabase
    .from("reviewers")
    .select("seen_onboarding_at, display_name, username")
    .eq("id", user.id)
    .maybeSingle();

  if (reviewer?.seen_onboarding_at) {
    redirect(next);
  }

  // Curated priming-venue catalogue.
  const { data: venueRows } = await supabase
    .from("venues")
    .select("id, slug, name, city, photo_url, roasters, brew_methods, notes")
    .eq("is_priming_venue", true)
    .order("name", { ascending: true });

  const venues: PrimingVenue[] = ((venueRows ?? []) as Array<{
    id: string;
    slug: string;
    name: string;
    city: string;
    photo_url: string | null;
    roasters: string[];
    brew_methods: string[];
    notes: string | null;
  }>).map((v) => ({
    id: v.id,
    slug: v.slug,
    name: v.name,
    city: v.city,
    photoUrl: v.photo_url,
    roasters: v.roasters ?? [],
    brewMethods: v.brew_methods ?? [],
    notes: v.notes,
  }));

  // Resume: pull existing reviews this user has already submitted against
  // the priming catalogue (if any) so the UI shows them as already-ranked
  // and the tournament can re-seed.
  const venueIds = venues.map((v) => v.id);
  let existingReviews: Review[] = [];
  if (venueIds.length > 0) {
    const { data: existing } = await supabase
      .from("reviews")
      .select(
        "id, venue_id, reviewer_id, rating_overall, rating_coffee_5, rating_vibe_5, bucket, rank_position, body, visited_on, created_at, updated_at",
      )
      .eq("reviewer_id", user.id)
      .in("venue_id", venueIds);
    existingReviews = (existing ?? []) as Review[];
  }

  const existingByVenue: Record<string, PrimingReviewSummary> = {};
  for (const r of existingReviews) {
    existingByVenue[r.venue_id] = {
      reviewId: r.id,
      bucket: r.bucket,
      ratingCoffee5: r.rating_coffee_5,
      ratingVibe5: r.rating_vibe_5,
      rankPosition: r.rank_position,
    };
  }

  return (
    <PrimingApp
      venues={venues}
      existingByVenue={existingByVenue}
      displayName={reviewer?.display_name ?? "you"}
      nextHref={next}
    />
  );
}
