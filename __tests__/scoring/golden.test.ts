import { describe, expect, it } from "vitest";

import { AXES, type Axis } from "@/lib/scoring/weights";

import { buildFixture } from "./fixture";

// Golden regression test. The fixture is deterministic (seeded PRNG), so
// these numbers must stay stable unless the scoring formulas or fixture
// generator change. If a PR shifts any value, update the expectations here
// and explain why in the PR description (see docs/scoring.md Section 7).

describe("scoring golden fixture", () => {
  const fixture = buildFixture();

  it("has the expected fixture size", () => {
    expect(fixture.reviewers.size).toBe(30);
    expect(fixture.venues.length).toBe(50);
    expect(fixture.reviews.length).toBe(500);
  });

  it("produces scores in [1, 10] and confidence in [0, 1] for every venue/axis", () => {
    for (const venueId of fixture.venues) {
      const perAxis = fixture.venueScores.get(venueId)!;
      for (const axis of AXES) {
        const r = perAxis[axis];
        expect(r.score).toBeGreaterThanOrEqual(1);
        expect(r.score).toBeLessThanOrEqual(10);
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      }
    }
  });

  it("matches locked-in overall scores for the first five venues", () => {
    // Precision 1 → tolerance ±0.05, per spec Section 7.
    const expected: Record<string, number> = {
      "venue-00": GOLDEN_OVERALL["venue-00"],
      "venue-01": GOLDEN_OVERALL["venue-01"],
      "venue-02": GOLDEN_OVERALL["venue-02"],
      "venue-03": GOLDEN_OVERALL["venue-03"],
      "venue-04": GOLDEN_OVERALL["venue-04"],
    };
    for (const [venueId, target] of Object.entries(expected)) {
      const actual = fixture.venueScores.get(venueId)!.overall.score;
      expect(actual).toBeCloseTo(target, 1);
    }
  });

  it("matches locked-in per-axis scores for venue-00", () => {
    const perAxis = fixture.venueScores.get("venue-00")!;
    for (const axis of AXES) {
      expect(perAxis[axis].score).toBeCloseTo(GOLDEN_VENUE_00[axis], 1);
    }
  });

  it("matches locked-in confidence for venues with the most reviews", () => {
    for (const [venueId, target] of Object.entries(GOLDEN_CONFIDENCE)) {
      const actual = fixture.venueScores.get(venueId)!.overall.confidence;
      expect(actual).toBeCloseTo(target, 2);
    }
  });
});

// ---------------------------------------------------------------------------
// Locked-in values. Update only with a deliberate fixture refresh, and
// document the reason in the PR description.
// ---------------------------------------------------------------------------

// Refreshed for the geometric-mean recalibration of computeReviewWeight (PRD
// Workstream D): per-review weight is now the equal-weight geometric mean of
// its quality factors instead of a raw product. The mean compresses the factor
// range upward, so per-review weights — and hence venue confidence — rise, and
// posteriors sit closer to the weighted mean (further from the prior). Prior
// history: beaned-reviewer bypass + PRIOR_STRENGTH 5.0 → 3.0.
const GOLDEN_OVERALL: Record<string, number> = {
  "venue-00": 4.63,
  "venue-01": 5.85,
  "venue-02": 4.19,
  "venue-03": 7.26,
  "venue-04": 4.49,
};

const GOLDEN_VENUE_00: Record<Axis, number> = {
  overall: 4.63,
  coffee: 4.53,
  vibe: 4.75,
};

const GOLDEN_CONFIDENCE: Record<string, number> = {
  "venue-00": 0.6285,
  "venue-01": 0.6414,
  "venue-02": 0.7163,
  "venue-03": 0.5213,
  "venue-04": 0.6499,
};
