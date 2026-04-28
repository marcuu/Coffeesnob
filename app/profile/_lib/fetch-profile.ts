import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeReputationTier,
  computeStreak,
  deriveTasteProfile,
} from "@/lib/profile";
import type { Reviewer, ReviewBucket } from "@/lib/types";

export type ReviewWithVenue = {
  id: string;
  rating_overall: number;
  rating_taste: number | null;
  rating_body: number | null;
  rating_aroma: number | null;
  rating_ambience: number;
  rating_service: number;
  rating_value: number;
  bucket: ReviewBucket;
  body: string;
  visited_on: string;
  created_at: string;
  venue: {
    name: string;
    slug: string;
    city: string;
    brew_methods: string[];
  };
};

export type BucketCounts = Record<ReviewBucket, number>;

export type ProfileData = {
  reviewer: Reviewer;
  reviews: ReviewWithVenue[];
  citiesCount: number;
  streak: number;
  tasteProfile: ReturnType<typeof deriveTasteProfile>;
  reputation: ReturnType<typeof computeReputationTier>;
  bucketCounts: BucketCounts;
};

export async function fetchProfileByUserId(
  supabase: SupabaseClient,
  reviewerId: string,
): Promise<ProfileData | null> {
  const [reviewerResult, reviewsResult, tenureResult] = await Promise.all([
    supabase.from("reviewers").select("*").eq("id", reviewerId).maybeSingle(),
    supabase
      .from("reviews")
      .select(
        "id, rating_overall, rating_taste, rating_body, rating_aroma, rating_ambience, rating_service, rating_value, bucket, body, visited_on, created_at, venue:venues(name, slug, city, brew_methods)",
      )
      .eq("reviewer_id", reviewerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviewer_tenure")
      .select("tenure_score, consistency_score")
      .eq("reviewer_id", reviewerId)
      .maybeSingle(),
  ]);

  if (!reviewerResult.data) return null;

  const reviewer = reviewerResult.data as Reviewer;
  // Supabase types the joined relation as an array because it doesn't inspect
  // FK constraints, but the runtime value is always a single object for a
  // many-to-one join (review → venue). Cast via unknown to bridge the gap.
  const reviews = (reviewsResult.data ?? []) as unknown as ReviewWithVenue[];
  const tenure = tenureResult.data ?? null;

  const cities = new Set(reviews.map((r) => r.venue?.city).filter(Boolean));

  const bucketCounts: BucketCounts = { pilgrimage: 0, detour: 0, convenience: 0 };
  for (const r of reviews) {
    if (r.bucket && r.bucket in bucketCounts) {
      bucketCounts[r.bucket]++;
    }
  }

  return {
    reviewer,
    reviews,
    citiesCount: cities.size,
    streak: computeStreak(reviews.map((r) => r.visited_on)),
    tasteProfile: deriveTasteProfile(reviews),
    reputation: computeReputationTier(reviewer, tenure),
    bucketCounts,
  };
}
