import { describe, expect, it } from "vitest";

import { generateTasteSummary } from "@/lib/onboarding/taste-summary";
import type { TasteSummaryReview } from "@/lib/onboarding/taste-summary";

const r = (
  partial: Partial<TasteSummaryReview> & { id?: string },
): TasteSummaryReview => ({
  venueId: partial.id ?? Math.random().toString(),
  venueName: partial.venueName ?? "Test Venue",
  bucket: partial.bucket ?? "detour",
  ratingCoffee5: partial.ratingCoffee5 ?? 3,
  ratingVibe5: partial.ratingVibe5 ?? 3,
  tags: partial.tags,
});

describe("generateTasteSummary", () => {
  it("always returns at least one line for a non-empty input", () => {
    const out = generateTasteSummary([r({})]);
    expect(out.length).toBeGreaterThanOrEqual(1);
  });

  it("returns up to `max` lines", () => {
    const reviews = [
      r({ bucket: "pilgrimage", ratingCoffee5: 5, ratingVibe5: 3 }),
      r({ bucket: "pilgrimage", ratingCoffee5: 5, ratingVibe5: 3 }),
      r({ bucket: "detour", ratingCoffee5: 5, ratingVibe5: 3 }),
      r({ bucket: "convenience", ratingCoffee5: 5, ratingVibe5: 3, tags: ["chain"] }),
      r({ bucket: "convenience", ratingCoffee5: 5, ratingVibe5: 3, tags: ["chain"] }),
    ];
    const out = generateTasteSummary(reviews, 2);
    expect(out.length).toBeLessThanOrEqual(2);
  });

  it("fires `coffee_over_vibe` when avg coffee >> avg vibe", () => {
    const reviews = [
      r({ ratingCoffee5: 5, ratingVibe5: 2 }),
      r({ ratingCoffee5: 5, ratingVibe5: 2 }),
      r({ ratingCoffee5: 5, ratingVibe5: 2 }),
    ];
    const out = generateTasteSummary(reviews, 1);
    expect(out[0].key).toBe("coffee_over_vibe");
  });

  it("fires `chains_anchored_low` when chains are kept out of pilgrimage", () => {
    const reviews = [
      r({ bucket: "pilgrimage", ratingCoffee5: 5, ratingVibe5: 4 }),
      r({ bucket: "convenience", ratingCoffee5: 1, ratingVibe5: 2, tags: ["chain"] }),
      r({ bucket: "convenience", ratingCoffee5: 1, ratingVibe5: 2, tags: ["chain"] }),
    ];
    const out = generateTasteSummary(reviews, 3);
    expect(out.some((l) => l.key === "chains_anchored_low")).toBe(true);
  });

  it("falls back to thin_profile when there are <= 2 reviews", () => {
    const out = generateTasteSummary([r({}), r({})], 3);
    expect(out.some((l) => l.key === "thin_profile")).toBe(true);
  });

  it("never returns duplicate keys", () => {
    const out = generateTasteSummary(
      [
        r({ bucket: "pilgrimage", ratingCoffee5: 5, ratingVibe5: 3, tags: ["purist", "roaster"] }),
        r({ bucket: "pilgrimage", ratingCoffee5: 5, ratingVibe5: 3, tags: ["purist"] }),
        r({ bucket: "convenience", ratingCoffee5: 1, ratingVibe5: 1, tags: ["chain"] }),
        r({ bucket: "convenience", ratingCoffee5: 1, ratingVibe5: 1, tags: ["chain"] }),
      ],
      3,
    );
    const keys = out.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
