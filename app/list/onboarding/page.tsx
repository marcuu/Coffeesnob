import { redirect } from "next/navigation";

import { OnboardingClient } from "./onboarding-client";
import { SiteHeader } from "@/components/site-header";
import type { Review, ReviewBucket, Reviewer } from "@/lib/types";
import type { RankedItem } from "@/components/list/ranked-list";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function RankingOnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: reviewer } = await supabase
    .from("reviewers")
    .select("id, seen_ranking_onboarding_at, review_count")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !reviewer ||
    (reviewer as Pick<Reviewer, "seen_ranking_onboarding_at">)
      .seen_ranking_onboarding_at
  ) {
    redirect("/list");
  }

  const { data: reviewsRaw } = await supabase
    .from("reviews")
    .select(
      "id, venue_id, reviewer_id, rating_overall, rating_taste, rating_body, rating_aroma, rating_ambience, rating_service, rating_value, bucket, rank_position, body, visited_on, created_at, updated_at",
    )
    .eq("reviewer_id", user.id)
    .order("rank_position", { ascending: true });

  const reviews = (reviewsRaw ?? []) as Review[];
  const venueIds = Array.from(new Set(reviews.map((r) => r.venue_id)));
  const venuesById = new Map<string, { name: string; slug: string }>();
  if (venueIds.length > 0) {
    const { data: venueRows } = await supabase
      .from("venues")
      .select("id, name, slug")
      .in("id", venueIds);
    for (const v of (venueRows ?? []) as Array<{ id: string; name: string; slug: string }>) {
      venuesById.set(v.id, { name: v.name, slug: v.slug });
    }
  }

  const byBucket: Record<ReviewBucket, RankedItem[]> = {
    pilgrimage: [],
    detour: [],
    convenience: [],
  };
  for (const r of reviews) {
    const v = venuesById.get(r.venue_id);
    if (!v) continue;
    byBucket[r.bucket].push({
      id: r.id,
      venueId: r.venue_id,
      venueSlug: v.slug,
      venueName: v.name,
      rating_overall: r.rating_overall,
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "hsl(20 14.3% 4%)" }}>
      <SiteHeader />
      <OnboardingClient byBucket={byBucket} reviewerId={user.id} />
    </div>
  );
}
