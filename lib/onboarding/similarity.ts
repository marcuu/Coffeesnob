// Cosine-similarity matching over a reviewer's priming-venue feature vector.
// Vector dimensions per PRD §8:
//   - one per priming venue, encoded pilgrimage=3, detour=2, convenience=1, unranked=0
//   - average coffee-1-5 per bucket (3 dims)
//   - average vibe-1-5 per bucket (3 dims)
// Total ~36 dims at 30 priming venues. Cosine similarity computed pairwise
// in-memory; latency is fine at <1000 reviewers (PRD NFR2).

import type { ReviewBucket } from "@/lib/types";

export const BUCKET_VALUE: Record<ReviewBucket, number> = {
  pilgrimage: 3,
  detour: 2,
  convenience: 1,
};

export const MIN_PRIMING_REVIEWS_FOR_MATCH = 3;

export type PrimingReview = {
  venueId: string;
  bucket: ReviewBucket;
  ratingCoffee5: number;
  ratingVibe5: number;
};

export type ReviewerVector = {
  reviewerId: string;
  vector: number[];
  primingReviewCount: number;
};

// Build a vector for one reviewer. `primingVenueIds` defines the canonical
// venue dimension order so vectors are aligned across reviewers.
export function buildReviewerVector(
  reviewerId: string,
  reviews: PrimingReview[],
  primingVenueIds: string[],
): ReviewerVector {
  const byVenue = new Map<string, PrimingReview>();
  for (const r of reviews) byVenue.set(r.venueId, r);

  const vector: number[] = [];
  for (const id of primingVenueIds) {
    const r = byVenue.get(id);
    vector.push(r ? BUCKET_VALUE[r.bucket] : 0);
  }

  const buckets: ReviewBucket[] = ["pilgrimage", "detour", "convenience"];
  for (const b of buckets) {
    const inBucket = reviews.filter((r) => r.bucket === b);
    if (inBucket.length === 0) {
      vector.push(0);
    } else {
      const avg =
        inBucket.reduce((s, r) => s + r.ratingCoffee5, 0) / inBucket.length;
      vector.push(avg);
    }
  }
  for (const b of buckets) {
    const inBucket = reviews.filter((r) => r.bucket === b);
    if (inBucket.length === 0) {
      vector.push(0);
    } else {
      const avg =
        inBucket.reduce((s, r) => s + r.ratingVibe5, 0) / inBucket.length;
      vector.push(avg);
    }
  }

  return {
    reviewerId,
    vector,
    primingReviewCount: reviews.length,
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Top-N similar reviewers. Both sides need >= MIN_PRIMING_REVIEWS_FOR_MATCH
// priming reviews to be eligible (PRD risk 3 mitigation).
export function topSimilarReviewers(
  me: ReviewerVector,
  others: ReviewerVector[],
  n: number,
): Array<{ reviewerId: string; similarity: number }> {
  if (me.primingReviewCount < MIN_PRIMING_REVIEWS_FOR_MATCH) return [];
  const eligible = others.filter(
    (o) =>
      o.reviewerId !== me.reviewerId &&
      o.primingReviewCount >= MIN_PRIMING_REVIEWS_FOR_MATCH,
  );
  const scored = eligible.map((o) => ({
    reviewerId: o.reviewerId,
    similarity: cosineSimilarity(me.vector, o.vector),
  }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, n);
}
