import { describe, expect, it } from "vitest";

import {
  AXES,
  SCORING_CONSTANTS,
  computeReviewerAxisWeight,
  computeReviewerConsistency,
  computeReviewerTenure,
  computeReviewWeight,
  type Axis,
  type ReviewForWeighting,
  type ReviewerState,
} from "@/lib/scoring/weights";

const NOW = new Date("2026-04-17T00:00:00Z");
const MS_PER_DAY = 86_400_000;
const MS_PER_MONTH = 30 * MS_PER_DAY;

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * MS_PER_DAY);
}

function monthsAgo(months: number): Date {
  return new Date(NOW.getTime() - months * MS_PER_MONTH);
}

function fullReviewer(overrides: Partial<ReviewerState> = {}): ReviewerState {
  const axisWeights: Record<Axis, number> = {
    overall: 3,
    coffee: 3,
    experience: 3,
  };
  const reviewsByAxis: Record<Axis, number> = {
    overall: 10,
    coffee: 10,
    experience: 10,
  };
  return {
    id: "r1",
    status: "active",
    createdAt: monthsAgo(24),
    reviewCount: 20,
    tenureScore: 1,
    consistencyScore: 1,
    axisWeights,
    reviewsByAxis,
    ...overrides,
  };
}

function fullReview(overrides: Partial<ReviewForWeighting> = {}): ReviewForWeighting {
  return {
    id: "rev1",
    reviewerId: "r1",
    visitedOn: NOW,
    scores: { overall: 8, coffee: 8, experience: 7 },
    ...overrides,
  };
}

describe("computeReviewerTenure", () => {
  it("returns 0 for a brand-new reviewer", () => {
    expect(
      computeReviewerTenure({ createdAt: NOW, reviewCount: 0 }, NOW),
    ).toBe(0);
  });

  it("returns 1 when both months and count saturate", () => {
    expect(
      computeReviewerTenure(
        { createdAt: monthsAgo(24), reviewCount: 100 },
        NOW,
      ),
    ).toBe(1);
  });

  it("saturates months at the threshold", () => {
    const twelveMonths = computeReviewerTenure(
      { createdAt: monthsAgo(12), reviewCount: 50 },
      NOW,
    );
    const twentyFour = computeReviewerTenure(
      { createdAt: monthsAgo(24), reviewCount: 50 },
      NOW,
    );
    expect(twelveMonths).toBe(1);
    expect(twentyFour).toBe(1);
  });

  it("weights months and count equally (50/50)", () => {
    const result = computeReviewerTenure(
      { createdAt: monthsAgo(6), reviewCount: 25 },
      NOW,
    );
    expect(result).toBeCloseTo(0.5, 5);
  });

  it("tabulates to spec for 3 months / 10 reviews", () => {
    // monthsNormalised = 3/12 = 0.25; countNormalised = 10/50 = 0.2
    // 0.5*0.25 + 0.5*0.2 = 0.225
    const result = computeReviewerTenure(
      { createdAt: monthsAgo(3), reviewCount: 10 },
      NOW,
    );
    expect(result).toBeCloseTo(0.225, 5);
  });
});

describe("computeReviewerConsistency", () => {
  it("returns 0.5 when fewer than 5 scores", () => {
    expect(computeReviewerConsistency([])).toBe(0.5);
    expect(computeReviewerConsistency([10, 10, 10, 10])).toBe(0.5);
  });

  it("returns 0 when all scores fall in one bucket", () => {
    expect(computeReviewerConsistency([10, 10, 10, 10, 10, 10])).toBe(0);
    expect(computeReviewerConsistency([5, 5, 5, 6, 5, 6])).toBe(0);
  });

  it("returns 1 when scores are uniformly distributed across all 5 buckets", () => {
    // Exactly one score per bucket, repeated twice.
    const scores = [1, 3, 5, 7, 9, 2, 4, 6, 8, 10];
    expect(computeReviewerConsistency(scores)).toBeCloseTo(1, 5);
  });

  it("returns log2(2)/log2(5) for a 50/50 two-bucket split", () => {
    const scores = [1, 1, 1, 10, 10, 10];
    const expected = 1 / Math.log2(5);
    expect(computeReviewerConsistency(scores)).toBeCloseTo(expected, 5);
  });

  it("ignores out-of-range and non-finite scores", () => {
    const scores = [10, 10, 10, 10, 10, 11, -3, NaN, Infinity];
    expect(computeReviewerConsistency(scores)).toBe(0);
  });

  it("buckets edge scores correctly (1,2 → b0; 9,10 → b4)", () => {
    // 3 × 1-2, 3 × 9-10 → two buckets 50/50
    const scores = [1, 2, 2, 9, 10, 10];
    const expected = 1 / Math.log2(5);
    expect(computeReviewerConsistency(scores)).toBeCloseTo(expected, 5);
  });
});

describe("computeReviewerAxisWeight", () => {
  const activeNow = { status: "active" as const, createdAt: NOW };
  const seededNow = { status: "seeded" as const, createdAt: NOW };
  const invitedNow = { status: "invited" as const, createdAt: NOW };

  it("returns 0 when reviewer has no reviews in the axis", () => {
    expect(computeReviewerAxisWeight(activeNow, 0, 0, 0)).toBe(0);
    expect(computeReviewerAxisWeight(seededNow, 0, 0, 0)).toBe(0);
  });

  it("applies neutral validation multiplier (=1.0) when validations are 0/0", () => {
    // base(active)=0.5, countMult=1.0 at saturation, (0.5 + 0.5)=1.0 → 0.5
    expect(computeReviewerAxisWeight(activeNow, 20, 0, 0)).toBeCloseTo(0.5, 5);
    // invited: 1.0 * 1.0 * 1.0 = 1.0
    expect(computeReviewerAxisWeight(invitedNow, 20, 0, 0)).toBeCloseTo(1.0, 5);
  });

  it("caps countMult at AXIS_COUNT_MAX_MULTIPLIER", () => {
    // 40 reviews would be 2x without cap. Cap = 1.5. active: 0.5*1.5*1.0 = 0.75
    expect(computeReviewerAxisWeight(activeNow, 40, 0, 0)).toBeCloseTo(0.75, 5);
    // 1000 reviews: still capped
    expect(computeReviewerAxisWeight(activeNow, 1000, 0, 0)).toBeCloseTo(
      0.75,
      5,
    );
  });

  it("clamps final weight to 3.0 for seeded reviewers past saturation", () => {
    // seeded base=3, countMult cap=1.5, neutral=1.0 → 4.5 → clamp 3.0
    expect(computeReviewerAxisWeight(seededNow, 40, 0, 0)).toBe(3.0);
  });

  it("uses Laplace smoothing on validation ratio", () => {
    // 9 positive, 1 negative: ratio = 10/12 = 0.8333...
    // active, 20 reviews: 0.5 * 1.0 * (0.5 + 0.8333) = 0.6667
    const result = computeReviewerAxisWeight(activeNow, 20, 9, 1);
    expect(result).toBeCloseTo(0.5 * 1.0 * (0.5 + 10 / 12), 5);
  });

  it("penalises heavily-disagreed reviewers via validation ratio", () => {
    // 0 positive, 10 negative: ratio = 1/12 ≈ 0.0833
    // active, 20: 0.5 * 1.0 * (0.5 + 0.0833) = 0.2917
    const result = computeReviewerAxisWeight(activeNow, 20, 0, 10);
    expect(result).toBeCloseTo(0.5 * 1.0 * (0.5 + 1 / 12), 5);
  });
});

describe("computeReviewWeight", () => {
  it("returns 1.0 for a maxed-out reviewer reviewing today with all axes filled", () => {
    const r = fullReviewer();
    const rev = fullReview();
    expect(computeReviewWeight(r, rev, "overall", NOW)).toBeCloseTo(1, 5);
  });

  it("halves at ~375 days (applies exponential decay, not half-life)", () => {
    // With HALF_LIFE_DAYS=540, days where exp(-d/540)=0.5 is d = 540*ln2 ≈ 374.3.
    const r = fullReviewer();
    const rev = fullReview({ visitedOn: daysAgo(540 * Math.LN2) });
    expect(computeReviewWeight(r, rev, "overall", NOW)).toBeCloseTo(0.5, 3);
  });

  it("decays to ~0.368 after one half-life-days constant", () => {
    const r = fullReviewer();
    const rev = fullReview({ visitedOn: daysAgo(540) });
    expect(computeReviewWeight(r, rev, "overall", NOW)).toBeCloseTo(
      Math.exp(-1),
      5,
    );
  });

  it("is nearly zero for 10-year-old reviews", () => {
    const r = fullReviewer();
    const rev = fullReview({ visitedOn: daysAgo(3650) });
    expect(computeReviewWeight(r, rev, "overall", NOW)).toBeLessThan(0.002);
  });

  it("caps base at 1.0 when axisWeight > 3", () => {
    const r = fullReviewer({
      axisWeights: {
        overall: 10,
        coffee: 10,
        experience: 10,
      },
    });
    const rev = fullReview();
    expect(computeReviewWeight(r, rev, "overall", NOW)).toBeCloseTo(1, 5);
  });

  it("returns 0 when reviewer has zero axis weight in that axis", () => {
    const r = fullReviewer({
      axisWeights: {
        overall: 0,
        coffee: 3,
        experience: 3,
      },
    });
    const rev = fullReview();
    expect(computeReviewWeight(r, rev, "overall", NOW)).toBe(0);
    expect(computeReviewWeight(r, rev, "coffee", NOW)).toBeCloseTo(1, 5);
  });

  it("applies completeness penalty when fewer than 3 axes are scored", () => {
    const r = fullReviewer();
    const rev = fullReview({ scores: { overall: 8, coffee: 7 } });
    expect(computeReviewWeight(r, rev, "overall", NOW)).toBeCloseTo(
      SCORING_CONSTANTS.COMPLETENESS_PARTIAL_MULTIPLIER,
      5,
    );
  });

  it("does not penalise completeness when exactly 3 axes are scored", () => {
    const r = fullReviewer();
    const rev = fullReview({ scores: { overall: 8, coffee: 7, experience: 6 } });
    expect(computeReviewWeight(r, rev, "overall", NOW)).toBeCloseTo(1, 5);
  });

  it("multiplies tenure and consistency into the result", () => {
    const r = fullReviewer({ tenureScore: 0.5, consistencyScore: 0.5 });
    const rev = fullReview();
    expect(computeReviewWeight(r, rev, "overall", NOW)).toBeCloseTo(0.25, 5);
  });

  it("handles a future visit date (recency > 1) by clamping to 1", () => {
    const r = fullReviewer();
    const rev = fullReview({ visitedOn: new Date(NOW.getTime() + 540 * MS_PER_DAY) });
    // recency = e^1 ≈ 2.72, other factors = 1 → clamped to 1
    expect(computeReviewWeight(r, rev, "overall", NOW)).toBe(1);
  });

  it("treats null/undefined score values as unfilled for completeness", () => {
    const r = fullReviewer();
    const rev = fullReview({
      scores: {
        overall: 8,
        coffee: undefined,
        experience: undefined,
      },
    });
    expect(computeReviewWeight(r, rev, "overall", NOW)).toBeCloseTo(
      SCORING_CONSTANTS.COMPLETENESS_PARTIAL_MULTIPLIER,
      5,
    );
  });
});

describe("AXES", () => {
  it("contains exactly the three documented axes in spec order", () => {
    expect(AXES).toEqual(["overall", "coffee", "experience"]);
  });
});
