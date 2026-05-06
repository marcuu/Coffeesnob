import { describe, expect, it } from "vitest";

import {
  buildReviewerVector,
  cosineSimilarity,
  topSimilarReviewers,
} from "@/lib/onboarding/similarity";

const VENUES = ["v1", "v2", "v3", "v4", "v5"];

describe("cosineSimilarity", () => {
  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });
  it("returns 1 for proportional vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 6);
  });
  it("returns 0 if either vector is zero", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });
});

describe("buildReviewerVector", () => {
  it("encodes buckets as 3/2/1/0", () => {
    const v = buildReviewerVector(
      "me",
      [
        { venueId: "v1", bucket: "pilgrimage", ratingCoffee5: 5, ratingVibe5: 4 },
        { venueId: "v2", bucket: "detour", ratingCoffee5: 4, ratingVibe5: 3 },
        { venueId: "v3", bucket: "convenience", ratingCoffee5: 2, ratingVibe5: 2 },
      ],
      VENUES,
    );
    // First five dims are venue assignments.
    expect(v.vector.slice(0, 5)).toEqual([3, 2, 1, 0, 0]);
    // Then 3 coffee averages per bucket, then 3 vibe averages per bucket.
    expect(v.vector).toHaveLength(5 + 3 + 3);
    expect(v.primingReviewCount).toBe(3);
  });

  it("zeroes bucket averages when a bucket is empty", () => {
    const v = buildReviewerVector(
      "me",
      [
        { venueId: "v1", bucket: "pilgrimage", ratingCoffee5: 5, ratingVibe5: 5 },
      ],
      VENUES,
    );
    // Coffee averages: pilg=5, detour=0, conv=0. Vibe averages: pilg=5, detour=0, conv=0.
    expect(v.vector.slice(5)).toEqual([5, 0, 0, 5, 0, 0]);
  });
});

describe("topSimilarReviewers", () => {
  it("returns nothing if I have fewer than 3 priming reviews", () => {
    const me = buildReviewerVector(
      "me",
      [{ venueId: "v1", bucket: "pilgrimage", ratingCoffee5: 5, ratingVibe5: 5 }],
      VENUES,
    );
    const other = buildReviewerVector(
      "you",
      [
        { venueId: "v1", bucket: "pilgrimage", ratingCoffee5: 5, ratingVibe5: 5 },
        { venueId: "v2", bucket: "detour", ratingCoffee5: 3, ratingVibe5: 3 },
        { venueId: "v3", bucket: "convenience", ratingCoffee5: 2, ratingVibe5: 2 },
      ],
      VENUES,
    );
    expect(topSimilarReviewers(me, [other], 3)).toEqual([]);
  });

  it("excludes others with fewer than 3 priming reviews", () => {
    const me = buildReviewerVector(
      "me",
      [
        { venueId: "v1", bucket: "pilgrimage", ratingCoffee5: 5, ratingVibe5: 5 },
        { venueId: "v2", bucket: "detour", ratingCoffee5: 3, ratingVibe5: 3 },
        { venueId: "v3", bucket: "convenience", ratingCoffee5: 2, ratingVibe5: 2 },
      ],
      VENUES,
    );
    const sparse = buildReviewerVector(
      "sparse",
      [{ venueId: "v1", bucket: "pilgrimage", ratingCoffee5: 5, ratingVibe5: 5 }],
      VENUES,
    );
    expect(topSimilarReviewers(me, [sparse], 3)).toEqual([]);
  });

  it("ranks identical taste highest and returns top N", () => {
    const reviews = [
      { venueId: "v1", bucket: "pilgrimage" as const, ratingCoffee5: 5, ratingVibe5: 5 },
      { venueId: "v2", bucket: "detour" as const, ratingCoffee5: 3, ratingVibe5: 3 },
      { venueId: "v3", bucket: "convenience" as const, ratingCoffee5: 2, ratingVibe5: 2 },
    ];
    const me = buildReviewerVector("me", reviews, VENUES);
    const twin = buildReviewerVector("twin", reviews, VENUES);
    const opposite = buildReviewerVector(
      "opposite",
      [
        { venueId: "v1", bucket: "convenience", ratingCoffee5: 1, ratingVibe5: 1 },
        { venueId: "v2", bucket: "convenience", ratingCoffee5: 1, ratingVibe5: 1 },
        { venueId: "v3", bucket: "pilgrimage", ratingCoffee5: 5, ratingVibe5: 5 },
      ],
      VENUES,
    );
    const result = topSimilarReviewers(me, [opposite, twin], 2);
    expect(result[0].reviewerId).toBe("twin");
    expect(result[0].similarity).toBeGreaterThan(result[1].similarity);
  });

  it("does not match against self", () => {
    const reviews = [
      { venueId: "v1", bucket: "pilgrimage" as const, ratingCoffee5: 5, ratingVibe5: 5 },
      { venueId: "v2", bucket: "detour" as const, ratingCoffee5: 3, ratingVibe5: 3 },
      { venueId: "v3", bucket: "convenience" as const, ratingCoffee5: 2, ratingVibe5: 2 },
    ];
    const me = buildReviewerVector("me", reviews, VENUES);
    expect(topSimilarReviewers(me, [me], 3)).toEqual([]);
  });
});
