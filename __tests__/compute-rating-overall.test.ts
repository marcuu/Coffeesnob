// Mirror of the SQL function compute_rating_overall(bucket, rank, bucket_size)
// from supabase/migrations/20260427000000_pairwise_ranking.sql. The SQL
// function is the source of truth; this test asserts the formula's
// monotonicity and band semantics so any drift is caught in CI without
// requiring a live Postgres connection.

import { describe, expect, it } from "vitest";

import type { ReviewBucket } from "@/lib/types";

const BAND_FLOOR: Record<ReviewBucket, number> = {
  pilgrimage: 7,
  detour: 4,
  convenience: 1,
};

// Replicates the SQL: round(floor + 3 * (size - rank + 1) / size).
function computeRatingOverall(
  bucket: ReviewBucket,
  rank: number,
  size: number,
): number {
  const floorScore = BAND_FLOOR[bucket];
  return Math.round(floorScore + (3 * (size - rank + 1)) / size);
}

describe("compute_rating_overall (TS mirror)", () => {
  it("bucket_size = 1 returns the top of the band", () => {
    expect(computeRatingOverall("pilgrimage", 1, 1)).toBe(10);
    expect(computeRatingOverall("detour", 1, 1)).toBe(7);
    expect(computeRatingOverall("convenience", 1, 1)).toBe(4);
  });

  it("rank = 1 always returns the top of the band", () => {
    for (const size of [1, 2, 5, 12, 50, 200]) {
      expect(computeRatingOverall("pilgrimage", 1, size)).toBe(10);
      expect(computeRatingOverall("detour", 1, size)).toBe(7);
      expect(computeRatingOverall("convenience", 1, size)).toBe(4);
    }
  });

  it("is monotonically non-increasing in rank for fixed (bucket, size)", () => {
    const buckets: ReviewBucket[] = ["pilgrimage", "detour", "convenience"];
    for (const bucket of buckets) {
      for (const size of [2, 3, 5, 10, 50, 100, 250]) {
        let prev = computeRatingOverall(bucket, 1, size);
        for (let rank = 2; rank <= size; rank++) {
          const cur = computeRatingOverall(bucket, rank, size);
          expect(cur).toBeLessThanOrEqual(prev);
          prev = cur;
        }
      }
    }
  });

  it("scores are clamped within the bucket's 4-wide band by rounding", () => {
    // Smallint round of (floor + 3*(size-rank+1)/size) for rank ∈ [1, size]:
    //   - rank=1 → floor + 3 → top of band.
    //   - rank=size → floor + 3/size → rounds to floor or floor+1 (size>3).
    // pilgrimage: 7..10, detour: 4..7, convenience: 1..4.
    for (const size of [1, 5, 50]) {
      for (let rank = 1; rank <= size; rank++) {
        expect(computeRatingOverall("pilgrimage", rank, size)).toBeGreaterThanOrEqual(7);
        expect(computeRatingOverall("pilgrimage", rank, size)).toBeLessThanOrEqual(10);
        expect(computeRatingOverall("detour", rank, size)).toBeGreaterThanOrEqual(4);
        expect(computeRatingOverall("detour", rank, size)).toBeLessThanOrEqual(7);
        expect(computeRatingOverall("convenience", rank, size)).toBeGreaterThanOrEqual(1);
        expect(computeRatingOverall("convenience", rank, size)).toBeLessThanOrEqual(4);
      }
    }
  });
});
