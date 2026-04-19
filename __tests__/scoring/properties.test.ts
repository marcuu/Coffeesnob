import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { aggregateVenueAxis } from "@/lib/scoring/aggregation";
import {
  AXES,
  computeReviewerAxisWeight,
  computeReviewerConsistency,
  computeReviewerTenure,
  computeReviewWeight,
  type Axis,
  type ReviewForWeighting,
  type ReviewerState,
  type ReviewerStatus,
} from "@/lib/scoring/weights";

const NOW = new Date("2026-04-17T00:00:00Z");
const MS_PER_DAY = 86_400_000;

const reviewerStatus: fc.Arbitrary<ReviewerStatus> = fc.constantFrom(
  "beaned",
  "invited",
  "active",
);

const axisArb: fc.Arbitrary<Axis> = fc.constantFrom(...AXES);

const axisRecord = (values: fc.Arbitrary<number>) =>
  fc.record({
    overall: values,
    coffee: values,
    experience: values,
  });

const reviewerStateArb: fc.Arbitrary<ReviewerState> = fc.record({
  id: fc.uuid(),
  status: reviewerStatus,
  createdAt: fc
    .integer({ min: 0, max: 3650 })
    .map((d) => new Date(NOW.getTime() - d * MS_PER_DAY)),
  reviewCount: fc.integer({ min: 0, max: 500 }),
  tenureScore: fc.double({
    min: 0,
    max: 1,
    noNaN: true,
    noDefaultInfinity: true,
  }),
  consistencyScore: fc.double({
    min: 0,
    max: 1,
    noNaN: true,
    noDefaultInfinity: true,
  }),
  axisWeights: axisRecord(
    fc.double({ min: 0, max: 3, noNaN: true, noDefaultInfinity: true }),
  ),
  reviewsByAxis: axisRecord(fc.integer({ min: 0, max: 500 })),
});

const reviewArb: fc.Arbitrary<ReviewForWeighting> = fc.record({
  id: fc.uuid(),
  reviewerId: fc.uuid(),
  visitedOn: fc
    .integer({ min: 0, max: 3650 })
    .map((d) => new Date(NOW.getTime() - d * MS_PER_DAY)),
  scores: axisRecord(fc.integer({ min: 1, max: 10 })),
});

const scoreArb = fc.integer({ min: 1, max: 10 });
const weightArb = fc.double({
  min: 0,
  max: 1,
  noNaN: true,
  noDefaultInfinity: true,
});
const priorScoreArb = fc.double({
  min: 1,
  max: 10,
  noNaN: true,
  noDefaultInfinity: true,
});
const priorStrengthArb = fc.double({
  min: 0.1,
  max: 20,
  noNaN: true,
  noDefaultInfinity: true,
});

describe("property: review weight", () => {
  it("is always in [0, 1]", () => {
    fc.assert(
      fc.property(reviewerStateArb, reviewArb, axisArb, (r, rev, axis) => {
        const w = computeReviewWeight(r, rev, axis, NOW);
        return w >= 0 && w <= 1 && Number.isFinite(w);
      }),
    );
  });
});

describe("property: reviewer axis weight", () => {
  it("is always in [0, 3]", () => {
    fc.assert(
      fc.property(
        reviewerStatus,
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 500 }),
        fc.integer({ min: 0, max: 500 }),
        (status, n, pos, neg) => {
          const w = computeReviewerAxisWeight(
            { status, createdAt: NOW },
            n,
            pos,
            neg,
          );
          return w >= 0 && w <= 3 && Number.isFinite(w);
        },
      ),
    );
  });
});

describe("property: reviewer tenure", () => {
  it("is always in [0, 1] for realistic inputs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3650 }),
        fc.integer({ min: 0, max: 10_000 }),
        (daysOld, count) => {
          const t = computeReviewerTenure(
            {
              createdAt: new Date(NOW.getTime() - daysOld * MS_PER_DAY),
              reviewCount: count,
            },
            NOW,
          );
          return t >= 0 && t <= 1 && Number.isFinite(t);
        },
      ),
    );
  });
});

describe("property: reviewer consistency", () => {
  it("is always in [0, 1]", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 10 })), (scores) => {
        const c = computeReviewerConsistency(scores);
        return c >= 0 && c <= 1 && Number.isFinite(c);
      }),
    );
  });
});

describe("property: venue aggregate", () => {
  it("keeps posterior score in [1, 10]", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ score: scoreArb, weight: weightArb })),
        priorScoreArb,
        priorStrengthArb,
        (reviews, prior, strength) => {
          const r = aggregateVenueAxis(reviews, prior, strength);
          return r.score >= 1 && r.score <= 10 && Number.isFinite(r.score);
        },
      ),
    );
  });

  it("keeps confidence in [0, 1]", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ score: scoreArb, weight: weightArb })),
        priorScoreArb,
        priorStrengthArb,
        (reviews, prior, strength) => {
          const r = aggregateVenueAxis(reviews, prior, strength);
          return (
            r.confidence >= 0 &&
            r.confidence <= 1 &&
            Number.isFinite(r.confidence)
          );
        },
      ),
    );
  });

  it("confidence is monotonically non-decreasing in added reviews", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ score: scoreArb, weight: weightArb })),
        fc.record({ score: scoreArb, weight: weightArb }),
        priorScoreArb,
        priorStrengthArb,
        (base, extra, prior, strength) => {
          const before = aggregateVenueAxis(base, prior, strength).confidence;
          const after = aggregateVenueAxis(
            [...base, extra],
            prior,
            strength,
          ).confidence;
          // Equality allowed when the added review has negligible weight.
          return after + 1e-12 >= before;
        },
      ),
    );
  });

  it("adding identical reviews pulls score asymptotically toward that score", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        priorScoreArb,
        priorStrengthArb,
        (targetScore, prior, strength) => {
          const many = Array.from({ length: 5000 }, () => ({
            score: targetScore,
            weight: 1,
          }));
          const r = aggregateVenueAxis(many, prior, strength);
          return Math.abs(r.score - targetScore) < 0.05;
        },
      ),
    );
  });
});
