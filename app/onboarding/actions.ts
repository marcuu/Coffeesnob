"use server";

import { revalidatePath } from "next/cache";

import {
  buildReviewerVector,
  topSimilarReviewers,
  type PrimingReview,
} from "@/lib/onboarding/similarity";
import type { ReviewBucket } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

export type ActionResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function completeOnboarding(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not authenticated" };

  const { error } = await supabase
    .from("reviewers")
    .update({ seen_onboarding_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { status: "error", message: error.message };

  revalidatePath("/list");
  revalidatePath("/onboarding");
  return { status: "ok" };
}

export async function addToWishlist(venueId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not authenticated" };

  const { error } = await supabase
    .from("review_wishlist")
    .insert({ reviewer_id: user.id, venue_id: venueId });

  // Unique constraint violation on a duplicate add is a no-op for the user.
  if (error && error.code !== "23505") {
    return { status: "error", message: error.message };
  }

  revalidatePath("/profile");
  return { status: "ok" };
}

export async function removeFromWishlist(
  venueId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not authenticated" };

  const { error } = await supabase
    .from("review_wishlist")
    .delete()
    .eq("reviewer_id", user.id)
    .eq("venue_id", venueId);

  if (error) return { status: "error", message: error.message };
  revalidatePath("/profile");
  return { status: "ok" };
}

type SimilarMatch = {
  reviewerId: string;
  similarity: number;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
};

type TryNextVenue = {
  venueId: string;
  slug: string;
  name: string;
  city: string;
  matchCount: number;
};

export type SimilarReviewersResult = {
  matches: SimilarMatch[];
  tryNext: TryNextVenue[];
};

// One-shot fetch: top-3 similar reviewers based on cosine over priming
// vectors, plus the top-3 venues those matches Pilgrimage'd that the user
// hasn't ranked yet. Computed in-memory; fine at <1000 reviewers per
// PRD NFR2.
export async function getSimilarReviewersAndTryNext(): Promise<SimilarReviewersResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { matches: [], tryNext: [] };

  const { data: primingVenues } = await supabase
    .from("venues")
    .select("id")
    .eq("is_priming_venue", true);
  const primingVenueIds = (primingVenues ?? []).map((v) => v.id as string);
  if (primingVenueIds.length === 0) return { matches: [], tryNext: [] };

  // Pull all priming-venue reviews (every reviewer, only priming venues).
  const { data: allReviews } = await supabase
    .from("reviews")
    .select("reviewer_id, venue_id, bucket, rating_coffee_5, rating_vibe_5")
    .in("venue_id", primingVenueIds);

  const reviewsByReviewer = new Map<string, PrimingReview[]>();
  for (const r of (allReviews ?? []) as Array<{
    reviewer_id: string;
    venue_id: string;
    bucket: ReviewBucket;
    rating_coffee_5: number;
    rating_vibe_5: number;
  }>) {
    const list = reviewsByReviewer.get(r.reviewer_id) ?? [];
    list.push({
      venueId: r.venue_id,
      bucket: r.bucket,
      ratingCoffee5: r.rating_coffee_5,
      ratingVibe5: r.rating_vibe_5,
    });
    reviewsByReviewer.set(r.reviewer_id, list);
  }

  const myReviews = reviewsByReviewer.get(user.id) ?? [];
  const me = buildReviewerVector(user.id, myReviews, primingVenueIds);

  const others = Array.from(reviewsByReviewer.entries())
    .filter(([id]) => id !== user.id)
    .map(([id, rs]) => buildReviewerVector(id, rs, primingVenueIds));

  const top = topSimilarReviewers(me, others, 3);
  if (top.length === 0) return { matches: [], tryNext: [] };

  // Hydrate reviewer profiles.
  const { data: profiles } = await supabase
    .from("reviewers")
    .select("id, display_name, username, avatar_url")
    .in(
      "id",
      top.map((m) => m.reviewerId),
    );
  const profileById = new Map<
    string,
    { display_name: string; username: string | null; avatar_url: string | null }
  >();
  for (const p of (profiles ?? []) as Array<{
    id: string;
    display_name: string;
    username: string | null;
    avatar_url: string | null;
  }>) {
    profileById.set(p.id, p);
  }

  const matches: SimilarMatch[] = top.map((m) => {
    const p = profileById.get(m.reviewerId);
    return {
      reviewerId: m.reviewerId,
      similarity: m.similarity,
      displayName: p?.display_name ?? "reviewer",
      username: p?.username ?? null,
      avatarUrl: p?.avatar_url ?? null,
    };
  });

  // Try-next: venues those matches rated Pilgrimage that the user hasn't
  // already ranked.
  const myRankedVenueIds = new Set(myReviews.map((r) => r.venueId));
  const matchIds = new Set(matches.map((m) => m.reviewerId));
  const venueScore = new Map<string, number>();
  for (const [reviewerId, rs] of reviewsByReviewer.entries()) {
    if (!matchIds.has(reviewerId)) continue;
    for (const r of rs) {
      if (r.bucket !== "pilgrimage") continue;
      if (myRankedVenueIds.has(r.venueId)) continue;
      venueScore.set(r.venueId, (venueScore.get(r.venueId) ?? 0) + 1);
    }
  }
  const topVenueIds = Array.from(venueScore.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  let tryNext: TryNextVenue[] = [];
  if (topVenueIds.length > 0) {
    const { data: venueRows } = await supabase
      .from("venues")
      .select("id, slug, name, city")
      .in(
        "id",
        topVenueIds.map(([id]) => id),
      );
    const venueById = new Map<
      string,
      { slug: string; name: string; city: string }
    >();
    for (const v of (venueRows ?? []) as Array<{
      id: string;
      slug: string;
      name: string;
      city: string;
    }>) {
      venueById.set(v.id, v);
    }
    tryNext = topVenueIds
      .map(([id, count]) => {
        const v = venueById.get(id);
        if (!v) return null;
        return {
          venueId: id,
          slug: v.slug,
          name: v.name,
          city: v.city,
          matchCount: count,
        };
      })
      .filter((x): x is TryNextVenue => x !== null);
  }

  return { matches, tryNext };
}
