// Deterministic in-memory fixture for the scoring golden-regression test.
// Generates 30 reviewers × 50 venues × 500 reviews from a seeded PRNG so the
// exact numbers asserted by golden.test.ts are reproducible across machines.
//
// Changing any value below will shift the golden assertions and force a
// conscious fixture refresh (see docs/scoring.md Section 7).

import {
  AXES,
  SCORING_CONSTANTS,
  computeReviewWeight,
  computeReviewerAxisWeight,
  computeReviewerConsistency,
  computeReviewerTenure,
  type Axis,
  type ReviewForWeighting,
  type ReviewerState,
  type ReviewerStatus,
} from "@/lib/scoring/weights";
import { aggregateVenueAxis } from "@/lib/scoring/aggregation";

export const FIXTURE_NOW = new Date("2026-04-17T00:00:00Z");
const MS_PER_DAY = 86_400_000;
const FIXTURE_SEED = 0xc0ffee;

const NUM_REVIEWERS = 30;
const NUM_VENUES = 50;
const NUM_REVIEWS = 500;

// Deterministic 32-bit PRNG. Mulberry32 — small, standard, fine for fixtures.
function makePrng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function pickStatus(rand: () => number): ReviewerStatus {
  const r = rand();
  if (r < 0.05) return "seeded";
  if (r < 0.2) return "invited";
  return "active";
}

type FixtureReviewer = {
  id: string;
  status: ReviewerStatus;
  createdAt: Date;
};

type FixtureReview = {
  id: string;
  reviewerId: string;
  venueId: string;
  visitedOn: Date;
  scores: Record<Axis, number>;
};

export type FixtureOutput = {
  reviewers: Map<string, ReviewerState>;
  venues: string[];
  reviews: FixtureReview[];
  reviewWeights: Map<string, Record<Axis, number>>;
  venueScores: Map<
    string,
    Record<
      Axis,
      { score: number; confidence: number; effectiveN: number; rawCount: number }
    >
  >;
};

export function buildFixture(): FixtureOutput {
  const rand = makePrng(FIXTURE_SEED);

  // --- Reviewers ---------------------------------------------------------
  const reviewers: FixtureReviewer[] = [];
  for (let i = 0; i < NUM_REVIEWERS; i++) {
    reviewers.push({
      id: `reviewer-${i.toString().padStart(2, "0")}`,
      status: pickStatus(rand),
      createdAt: new Date(
        FIXTURE_NOW.getTime() - Math.floor(rand() * 36 * 30) * MS_PER_DAY,
      ),
    });
  }

  // --- Venues ------------------------------------------------------------
  const venues: string[] = [];
  for (let i = 0; i < NUM_VENUES; i++) {
    venues.push(`venue-${i.toString().padStart(2, "0")}`);
  }

  // --- Reviews -----------------------------------------------------------
  // Each reviewer has a slight personal bias so consistency varies.
  const reviewerBias = new Map<string, number>();
  for (const r of reviewers) {
    reviewerBias.set(r.id, rand() * 4 - 2);
  }
  // Each venue has a baseline quality so axes differ across venues.
  const venueQuality = new Map<string, number>();
  for (const v of venues) {
    venueQuality.set(v, 3 + rand() * 6); // in [3, 9]
  }

  const reviews: FixtureReview[] = [];
  for (let i = 0; i < NUM_REVIEWS; i++) {
    const reviewer = reviewers[Math.floor(rand() * NUM_REVIEWERS)];
    const venueId = venues[Math.floor(rand() * NUM_VENUES)];
    const bias = reviewerBias.get(reviewer.id)!;
    const base = venueQuality.get(venueId)!;
    const visitDaysAgo = Math.floor(rand() * 1200);
    const scores = {} as Record<Axis, number>;
    for (const axis of AXES) {
      const noise = rand() * 2 - 1;
      const raw = base + bias + noise;
      scores[axis] = Math.max(1, Math.min(10, Math.round(raw)));
    }
    reviews.push({
      id: `review-${i.toString().padStart(3, "0")}`,
      reviewerId: reviewer.id,
      venueId,
      visitedOn: new Date(FIXTURE_NOW.getTime() - visitDaysAgo * MS_PER_DAY),
      scores,
    });
  }

  // --- Per-reviewer stats ------------------------------------------------
  const reviewCountByReviewer = new Map<string, number>();
  const reviewsInAxisByReviewer = new Map<string, Record<Axis, number>>();
  const scoresByReviewer = new Map<string, number[]>();

  for (const r of reviewers) {
    reviewsInAxisByReviewer.set(r.id, {
      overall: 0,
      coffee: 0,
      experience: 0,
    });
    scoresByReviewer.set(r.id, []);
    reviewCountByReviewer.set(r.id, 0);
  }
  for (const rev of reviews) {
    reviewCountByReviewer.set(
      rev.reviewerId,
      (reviewCountByReviewer.get(rev.reviewerId) ?? 0) + 1,
    );
    const perAxis = reviewsInAxisByReviewer.get(rev.reviewerId)!;
    const scoreList = scoresByReviewer.get(rev.reviewerId)!;
    for (const axis of AXES) {
      perAxis[axis]++;
      scoreList.push(rev.scores[axis]);
    }
  }

  // --- ReviewerState -----------------------------------------------------
  const reviewerStates = new Map<string, ReviewerState>();
  for (const r of reviewers) {
    const reviewCount = reviewCountByReviewer.get(r.id) ?? 0;
    const tenureScore = computeReviewerTenure(
      { createdAt: r.createdAt, reviewCount },
      FIXTURE_NOW,
    );
    const consistencyScore = computeReviewerConsistency(
      scoresByReviewer.get(r.id) ?? [],
    );
    const reviewsByAxis = reviewsInAxisByReviewer.get(r.id)!;
    const axisWeights = {} as Record<Axis, number>;
    for (const axis of AXES) {
      axisWeights[axis] = computeReviewerAxisWeight(
        { status: r.status, createdAt: r.createdAt },
        reviewsByAxis[axis],
        0,
        0,
      );
    }
    reviewerStates.set(r.id, {
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      reviewCount,
      tenureScore,
      consistencyScore,
      axisWeights,
      reviewsByAxis,
    });
  }

  // --- Review weights ----------------------------------------------------
  const reviewWeights = new Map<string, Record<Axis, number>>();
  for (const rev of reviews) {
    const reviewer = reviewerStates.get(rev.reviewerId)!;
    const rew: ReviewForWeighting = {
      id: rev.id,
      reviewerId: rev.reviewerId,
      visitedOn: rev.visitedOn,
      scores: rev.scores,
    };
    const weights = {} as Record<Axis, number>;
    for (const axis of AXES) {
      weights[axis] = computeReviewWeight(reviewer, rew, axis, FIXTURE_NOW);
    }
    reviewWeights.set(rev.id, weights);
  }

  // --- Venue aggregates --------------------------------------------------
  const reviewsByVenue = new Map<string, FixtureReview[]>();
  for (const v of venues) reviewsByVenue.set(v, []);
  for (const rev of reviews) {
    reviewsByVenue.get(rev.venueId)!.push(rev);
  }

  const venueScores = new Map<
    string,
    Record<
      Axis,
      { score: number; confidence: number; effectiveN: number; rawCount: number }
    >
  >();
  for (const v of venues) {
    const bucket = reviewsByVenue.get(v)!;
    const perAxis = {} as Record<
      Axis,
      { score: number; confidence: number; effectiveN: number; rawCount: number }
    >;
    for (const axis of AXES) {
      const weighted = bucket.map((rev) => ({
        score: rev.scores[axis],
        weight: reviewWeights.get(rev.id)![axis],
      }));
      perAxis[axis] = aggregateVenueAxis(
        weighted,
        SCORING_CONSTANTS.PRIOR_SCORE_BY_AXIS[axis],
        SCORING_CONSTANTS.PRIOR_STRENGTH,
      );
    }
    venueScores.set(v, perAxis);
  }

  return {
    reviewers: reviewerStates,
    venues,
    reviews: reviews.map(({ id, reviewerId, venueId, visitedOn, scores }) => ({
      id,
      reviewerId,
      venueId,
      visitedOn,
      scores,
    })),
    reviewWeights,
    venueScores,
  };
}
