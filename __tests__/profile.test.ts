import { describe, expect, it } from "vitest";

import {
  computeReputationTier,
  computeStreak,
  deriveTasteProfile,
  formatJoinDate,
  formatRelativeDate,
  type ReviewForProfile,
} from "@/lib/profile";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

// Fixed reference point: a Monday so week-boundary arithmetic is predictable.
const NOW = new Date("2026-04-20T12:00:00Z");

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * MS_PER_DAY).toISOString().slice(0, 10);
}

function weeksAgo(n: number): string {
  return new Date(NOW.getTime() - n * MS_PER_WEEK).toISOString().slice(0, 10);
}

function baseReview(overrides: Partial<ReviewForProfile> = {}): ReviewForProfile {
  return {
    rating_overall: 7,
    rating_taste: 7,
    rating_body: 7,
    rating_aroma: 7,
    rating_ambience: 7,
    rating_service: 7,
    rating_value: 7,
    body: "Solid.",
    visited_on: daysAgo(1),
    venue: { city: "London", brew_methods: ["espresso"] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeStreak
// ---------------------------------------------------------------------------

describe("computeStreak", () => {
  it("returns 0 for an empty list", () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it("returns 1 for a single review in the current week", () => {
    expect(computeStreak([daysAgo(0)], NOW)).toBe(1);
  });

  it("returns 1 for a single review in the previous week", () => {
    expect(computeStreak([weeksAgo(1)], NOW)).toBe(1);
  });

  it("returns 0 for a review older than one week with nothing recent", () => {
    expect(computeStreak([weeksAgo(2)], NOW)).toBe(0);
  });

  it("counts consecutive weeks correctly", () => {
    const dates = [daysAgo(1), weeksAgo(1), weeksAgo(2), weeksAgo(3)];
    expect(computeStreak(dates, NOW)).toBe(4);
  });

  it("stops at the first gap", () => {
    // Current week + 2 weeks ago — week 1 ago is missing.
    const dates = [daysAgo(1), weeksAgo(2)];
    expect(computeStreak(dates, NOW)).toBe(1);
  });

  it("treats multiple reviews in the same week as one streak unit", () => {
    const dates = [daysAgo(0), daysAgo(1), daysAgo(2)];
    expect(computeStreak(dates, NOW)).toBe(1);
  });

  it("ignores malformed date strings", () => {
    expect(computeStreak(["not-a-date"], NOW)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// deriveTasteProfile
// ---------------------------------------------------------------------------

describe("deriveTasteProfile", () => {
  it("returns null when fewer than 3 reviews", () => {
    expect(deriveTasteProfile([])).toBeNull();
    expect(deriveTasteProfile([baseReview(), baseReview()])).toBeNull();
  });

  it("includes a chip when there are 3 or more reviews", () => {
    const result = deriveTasteProfile([baseReview(), baseReview(), baseReview()]);
    expect(result).not.toBeNull();
    expect(result!.chips.length).toBeGreaterThan(0);
  });

  it("labels a reviewer as Coffee-first when coffee axes score significantly higher", () => {
    const reviews = Array.from({ length: 4 }, () =>
      baseReview({
        rating_taste: 9,
        rating_body: 9,
        rating_aroma: 9,
        rating_ambience: 5,
        rating_service: 5,
        rating_value: 5,
        rating_overall: 7,
      }),
    );
    const result = deriveTasteProfile(reviews)!;
    expect(result.chips).toContain("Coffee-first");
    expect(result.chips).not.toContain("Experience-focused");
  });

  it("labels a reviewer as Experience-focused when experience axes score significantly higher", () => {
    const reviews = Array.from({ length: 4 }, () =>
      baseReview({
        rating_taste: 5,
        rating_body: 5,
        rating_aroma: 5,
        rating_ambience: 9,
        rating_service: 9,
        rating_value: 9,
        rating_overall: 7,
      }),
    );
    const result = deriveTasteProfile(reviews)!;
    expect(result.chips).toContain("Experience-focused");
    expect(result.chips).not.toContain("Coffee-first");
  });

  it("labels Balanced when coffee and experience scores are within 0.5", () => {
    const reviews = Array.from({ length: 4 }, () =>
      baseReview({
        rating_taste: 7,
        rating_body: 7,
        rating_aroma: 7,
        rating_ambience: 7,
        rating_service: 7,
        rating_value: 7,
        rating_overall: 7,
      }),
    );
    const result = deriveTasteProfile(reviews)!;
    expect(result.chips).toContain("Balanced");
  });

  it("labels Strict when avg overall is below 6", () => {
    const reviews = Array.from({ length: 4 }, () =>
      baseReview({ rating_overall: 5 }),
    );
    expect(deriveTasteProfile(reviews)!.chips).toContain("Strict");
  });

  it("labels Generous when avg overall is above 7.5", () => {
    const reviews = Array.from({ length: 4 }, () =>
      baseReview({ rating_overall: 9 }),
    );
    expect(deriveTasteProfile(reviews)!.chips).toContain("Generous");
  });

  it("labels Fair for avg overall between 6 and 7.5", () => {
    const reviews = Array.from({ length: 4 }, () =>
      baseReview({ rating_overall: 7 }),
    );
    expect(deriveTasteProfile(reviews)!.chips).toContain("Fair");
  });

  it("labels Espresso-led when espresso dominates brew methods", () => {
    const reviews = Array.from({ length: 4 }, () =>
      baseReview({ venue: { city: "London", brew_methods: ["espresso"] } }),
    );
    expect(deriveTasteProfile(reviews)!.chips).toContain("Espresso-led");
  });

  it("labels Filter-led when filter methods dominate", () => {
    const reviews = Array.from({ length: 4 }, () =>
      baseReview({
        venue: { city: "London", brew_methods: ["filter", "pour_over"] },
      }),
    );
    expect(deriveTasteProfile(reviews)!.chips).toContain("Filter-led");
  });

  it("adds a city-focused chip when >60% of reviews are in one city", () => {
    const reviews = [
      ...Array.from({ length: 4 }, () =>
        baseReview({ venue: { city: "Manchester", brew_methods: [] } }),
      ),
      baseReview({ venue: { city: "London", brew_methods: [] } }),
    ];
    expect(deriveTasteProfile(reviews)!.chips).toContain("Manchester-focused");
  });

  it("omits a city chip when no city exceeds 60%", () => {
    const reviews = [
      baseReview({ venue: { city: "London", brew_methods: [] } }),
      baseReview({ venue: { city: "London", brew_methods: [] } }),
      baseReview({ venue: { city: "Manchester", brew_methods: [] } }),
      baseReview({ venue: { city: "Leeds", brew_methods: [] } }),
    ];
    const chips = deriveTasteProfile(reviews)!.chips;
    expect(chips.some((c) => c.endsWith("-focused"))).toBe(false);
  });

  it("descriptor joins chips with ' · '", () => {
    const result = deriveTasteProfile([
      baseReview(),
      baseReview(),
      baseReview(),
    ])!;
    expect(result.descriptor).toBe(result.chips.join(" · "));
  });
});

// ---------------------------------------------------------------------------
// computeReputationTier
// ---------------------------------------------------------------------------

describe("computeReputationTier", () => {
  it("returns Trusted contributor for beaned reviewers regardless of tenure", () => {
    const tier = computeReputationTier({ status: "beaned", review_count: 0 }, null);
    expect(tier.label).toBe("Trusted contributor");
    expect(tier.nextStep).toBeNull();
  });

  it("returns Established reviewer when tenure ≥ 0.8 and reviews ≥ 20", () => {
    const tier = computeReputationTier(
      { status: "active", review_count: 20 },
      { tenure_score: 0.85, consistency_score: 0.7 },
    );
    expect(tier.label).toBe("Established reviewer");
    expect(tier.nextStep).toBeNull();
  });

  it("returns Growing signal when tenure ≥ 0.4 and review count < 20", () => {
    const tier = computeReputationTier(
      { status: "active", review_count: 10 },
      { tenure_score: 0.5, consistency_score: 0.6 },
    );
    expect(tier.label).toBe("Growing signal");
    expect(tier.nextStep).toContain("10 more reviews");
  });

  it("returns Growing signal when review_count ≥ 5 even with low tenure", () => {
    const tier = computeReputationTier(
      { status: "active", review_count: 5 },
      { tenure_score: 0.1, consistency_score: 0.5 },
    );
    expect(tier.label).toBe("Growing signal");
  });

  it("returns Building your record for a brand-new reviewer", () => {
    const tier = computeReputationTier({ status: "active", review_count: 0 }, null);
    expect(tier.label).toBe("Building your record");
    expect(tier.nextStep).toContain("5 more reviews");
  });

  it("formats next step with singular 'review' when exactly 1 needed", () => {
    const tier = computeReputationTier({ status: "active", review_count: 4 }, null);
    expect(tier.nextStep).toContain("1 more review");
    expect(tier.nextStep).not.toContain("reviews");
  });

  it("returns no nextStep when Established and not beaned", () => {
    const tier = computeReputationTier(
      { status: "active", review_count: 25 },
      { tenure_score: 0.9, consistency_score: 0.8 },
    );
    expect(tier.nextStep).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// formatRelativeDate
// ---------------------------------------------------------------------------

describe("formatRelativeDate", () => {
  it("returns 'today' for same-day dates", () => {
    expect(formatRelativeDate(NOW.toISOString(), NOW)).toBe("today");
  });

  it("returns 'yesterday' for 1-day-old dates", () => {
    const yesterday = new Date(NOW.getTime() - MS_PER_DAY).toISOString();
    expect(formatRelativeDate(yesterday, NOW)).toBe("yesterday");
  });

  it("returns 'N days ago' for 2–6 day old dates", () => {
    for (const d of [2, 3, 6]) {
      const date = new Date(NOW.getTime() - d * MS_PER_DAY).toISOString();
      expect(formatRelativeDate(date, NOW)).toBe(`${d} days ago`);
    }
  });

  it("returns '1 week ago' for 7-day-old dates", () => {
    const date = new Date(NOW.getTime() - 7 * MS_PER_DAY).toISOString();
    expect(formatRelativeDate(date, NOW)).toBe("1 week ago");
  });

  it("returns 'N weeks ago' for 8–29 day old dates", () => {
    const date = new Date(NOW.getTime() - 14 * MS_PER_DAY).toISOString();
    expect(formatRelativeDate(date, NOW)).toBe("2 weeks ago");
  });

  it("returns '1 month ago' for 30-day-old dates", () => {
    const date = new Date(NOW.getTime() - 30 * MS_PER_DAY).toISOString();
    expect(formatRelativeDate(date, NOW)).toBe("1 month ago");
  });

  it("returns 'N months ago' for dates within a year", () => {
    const date = new Date(NOW.getTime() - 60 * MS_PER_DAY).toISOString();
    expect(formatRelativeDate(date, NOW)).toBe("2 months ago");
  });

  it("returns '1 year ago' for 365-day-old dates", () => {
    const date = new Date(NOW.getTime() - 365 * MS_PER_DAY).toISOString();
    expect(formatRelativeDate(date, NOW)).toBe("1 year ago");
  });

  it("returns 'N years ago' for older dates", () => {
    const date = new Date(NOW.getTime() - 730 * MS_PER_DAY).toISOString();
    expect(formatRelativeDate(date, NOW)).toBe("2 years ago");
  });
});

// ---------------------------------------------------------------------------
// formatJoinDate
// ---------------------------------------------------------------------------

describe("formatJoinDate", () => {
  // Use noon-UTC to avoid midnight dates shifting into the previous month in
  // negative-offset timezones.
  it("formats an ISO date as 'Month YYYY'", () => {
    expect(formatJoinDate("2024-03-15T12:00:00Z")).toBe("March 2024");
  });

  it("handles January dates", () => {
    expect(formatJoinDate("2025-01-15T12:00:00Z")).toBe("January 2025");
  });

  it("handles December dates", () => {
    expect(formatJoinDate("2025-12-15T12:00:00Z")).toBe("December 2025");
  });
});
