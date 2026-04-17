import { describe, expect, it } from "vitest";

import { aggregateVenueAxis } from "@/lib/scoring/aggregation";

const PRIOR = 6.0;
const STRENGTH = 5.0;

describe("aggregateVenueAxis", () => {
  it("returns the prior with zero confidence when there are no reviews", () => {
    const r = aggregateVenueAxis([], PRIOR, STRENGTH);
    expect(r).toEqual({
      score: PRIOR,
      confidence: 0,
      effectiveN: 0,
      rawCount: 0,
    });
  });

  it("drops reviews whose weight is at or below 0.05", () => {
    const r = aggregateVenueAxis(
      [
        { score: 10, weight: 0.05 },
        { score: 10, weight: 0.04 },
      ],
      PRIOR,
      STRENGTH,
    );
    expect(r).toEqual({
      score: PRIOR,
      confidence: 0,
      effectiveN: 0,
      rawCount: 0,
    });
  });

  it("keeps reviews with weight just above 0.05", () => {
    const r = aggregateVenueAxis(
      [{ score: 10, weight: 0.06 }],
      PRIOR,
      STRENGTH,
    );
    expect(r.rawCount).toBe(1);
    expect(r.effectiveN).toBeCloseTo(0.06, 5);
  });

  it("pulls a single full-weight review strongly toward the prior", () => {
    const r = aggregateVenueAxis(
      [{ score: 10, weight: 1 }],
      PRIOR,
      STRENGTH,
    );
    // posterior = (10 + 6*5) / (1 + 5) = 40/6 ≈ 6.667
    expect(r.score).toBeCloseTo(40 / 6, 5);
    // confidence = 1/6 ≈ 0.1667
    expect(r.confidence).toBeCloseTo(1 / 6, 5);
    expect(r.effectiveN).toBe(1);
    expect(r.rawCount).toBe(1);
  });

  it("converges on the weighted mean as weight grows large", () => {
    const reviews = Array.from({ length: 200 }, () => ({
      score: 8,
      weight: 1,
    }));
    const r = aggregateVenueAxis(reviews, PRIOR, STRENGTH);
    // posterior = (1600 + 30) / (200 + 5) = 1630/205 ≈ 7.951
    expect(r.score).toBeCloseTo(1630 / 205, 5);
    expect(r.confidence).toBeGreaterThan(0.97);
    expect(r.rawCount).toBe(200);
    expect(r.effectiveN).toBe(200);
  });

  it("computes the weighted mean correctly for mixed weights", () => {
    // (8*1 + 6*2) / (1+2) = 20/3 ≈ 6.667 pre-prior
    // post-prior: (20 + 6*5) / (3 + 5) = 50/8 = 6.25
    const r = aggregateVenueAxis(
      [
        { score: 8, weight: 1 },
        { score: 6, weight: 2 },
      ],
      PRIOR,
      STRENGTH,
    );
    expect(r.score).toBeCloseTo(6.25, 5);
    expect(r.effectiveN).toBe(3);
    expect(r.rawCount).toBe(2);
    expect(r.confidence).toBeCloseTo(3 / 8, 5);
  });

  it("returns the prior when every review is below the weight threshold", () => {
    const r = aggregateVenueAxis(
      [
        { score: 10, weight: 0.01 },
        { score: 1, weight: 0.02 },
      ],
      PRIOR,
      STRENGTH,
    );
    expect(r.score).toBe(PRIOR);
    expect(r.confidence).toBe(0);
    expect(r.rawCount).toBe(0);
  });

  it("respects the axis-specific prior", () => {
    // service axis: prior 6.5
    const r = aggregateVenueAxis([], 6.5, STRENGTH);
    expect(r.score).toBe(6.5);
  });

  it("lets the posterior span the full [1, 10] range when reviews dominate", () => {
    const reviews = Array.from({ length: 100 }, () => ({
      score: 1,
      weight: 1,
    }));
    const r = aggregateVenueAxis(reviews, PRIOR, STRENGTH);
    // (100 + 30) / (100 + 5) = 130/105 ≈ 1.238
    expect(r.score).toBeCloseTo(130 / 105, 5);
    expect(r.score).toBeGreaterThanOrEqual(1);
    expect(r.score).toBeLessThanOrEqual(10);
  });
});
