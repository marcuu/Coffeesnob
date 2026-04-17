// Pure scoring functions. No DB access, no I/O. All formulas and constants
// live here; callers (lib/scoring/pipeline.ts, etc.) inject data.
//
// See docs/scoring.md Section 2 for the specification and rationale.

export type Axis = "overall" | "coffee" | "ambience" | "service" | "value";

export const AXES: readonly Axis[] = [
  "overall",
  "coffee",
  "ambience",
  "service",
  "value",
];

export type ReviewerStatus = "seeded" | "invited" | "active";

export type ReviewerState = {
  id: string;
  status: ReviewerStatus;
  createdAt: Date;
  reviewCount: number;
  tenureScore: number;
  consistencyScore: number;
  axisWeights: Record<Axis, number>;
  reviewsByAxis: Record<Axis, number>;
};

export type ReviewForWeighting = {
  id: string;
  reviewerId: string;
  visitedOn: Date;
  scores: Partial<Record<Axis, number>>;
};

export const SCORING_CONSTANTS = {
  RECENCY_HALF_LIFE_DAYS: 540,
  COMPLETENESS_FULL_THRESHOLD: 3,
  COMPLETENESS_PARTIAL_MULTIPLIER: 0.7,
  STATUS_BASE_WEIGHT: { seeded: 3.0, invited: 1.0, active: 0.5 } as Record<
    ReviewerStatus,
    number
  >,
  AXIS_COUNT_SATURATION: 20,
  AXIS_COUNT_MAX_MULTIPLIER: 1.5,
  TENURE_MONTHS_WEIGHT: 0.5,
  TENURE_COUNT_WEIGHT: 0.5,
  TENURE_MONTHS_SATURATION: 12,
  TENURE_COUNT_SATURATION: 50,
  PRIOR_SCORE_BY_AXIS: {
    overall: 6.0,
    coffee: 6.0,
    ambience: 6.0,
    service: 6.5,
    value: 6.0,
  } as Record<Axis, number>,
  PRIOR_STRENGTH: 5.0,
};

const MS_PER_DAY = 86_400_000;
const MS_PER_MONTH = 30 * MS_PER_DAY;

function clamp(x: number, lo: number, hi: number): number {
  if (Number.isNaN(x)) return lo;
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

export function computeReviewWeight(
  reviewer: ReviewerState,
  review: ReviewForWeighting,
  axis: Axis,
  now: Date,
): number {
  const daysSinceVisit =
    (now.getTime() - review.visitedOn.getTime()) / MS_PER_DAY;
  const recency = Math.exp(
    -daysSinceVisit / SCORING_CONSTANTS.RECENCY_HALF_LIFE_DAYS,
  );

  const axisWeight = reviewer.axisWeights[axis] ?? 0;
  const base = Math.min(axisWeight / 3.0, 1.0);

  let filledAxes = 0;
  for (const key of AXES) {
    const v = review.scores[key];
    if (v !== undefined && v !== null) filledAxes++;
  }
  const completeness =
    filledAxes >= SCORING_CONSTANTS.COMPLETENESS_FULL_THRESHOLD
      ? 1.0
      : SCORING_CONSTANTS.COMPLETENESS_PARTIAL_MULTIPLIER;

  const weight =
    base *
    reviewer.tenureScore *
    reviewer.consistencyScore *
    recency *
    completeness;

  return clamp(weight, 0, 1);
}

// Validations (helpful/disagree) aren't yet implemented — callers pass
// positive=0, negative=0, which yields a neutral ratio of 0.5. See
// docs/scoring.md Section 10.
export function computeReviewerAxisWeight(
  _reviewer: { status: ReviewerStatus; createdAt: Date },
  reviewsInAxis: number,
  validationsPositive: number,
  validationsNegative: number,
): number {
  const base = SCORING_CONSTANTS.STATUS_BASE_WEIGHT[_reviewer.status];
  const countMult = Math.min(
    reviewsInAxis / SCORING_CONSTANTS.AXIS_COUNT_SATURATION,
    SCORING_CONSTANTS.AXIS_COUNT_MAX_MULTIPLIER,
  );
  const validationRatio =
    (validationsPositive + 1) / (validationsPositive + validationsNegative + 2);
  const weight = base * countMult * (0.5 + validationRatio);
  return clamp(weight, 0, 3.0);
}

export function computeReviewerTenure(
  reviewer: { createdAt: Date; reviewCount: number },
  now: Date,
): number {
  const monthsActive =
    (now.getTime() - reviewer.createdAt.getTime()) / MS_PER_MONTH;
  const monthsNormalised = Math.min(
    monthsActive / SCORING_CONSTANTS.TENURE_MONTHS_SATURATION,
    1.0,
  );
  const countNormalised = Math.min(
    reviewer.reviewCount / SCORING_CONSTANTS.TENURE_COUNT_SATURATION,
    1.0,
  );
  return (
    SCORING_CONSTANTS.TENURE_MONTHS_WEIGHT * monthsNormalised +
    SCORING_CONSTANTS.TENURE_COUNT_WEIGHT * countNormalised
  );
}

export function computeReviewerConsistency(reviewerScores: number[]): number {
  if (reviewerScores.length < 5) return 0.5;

  const buckets = [0, 0, 0, 0, 0];
  let total = 0;
  for (const s of reviewerScores) {
    if (!Number.isFinite(s)) continue;
    if (s < 1 || s > 10) continue;
    const idx = Math.min(Math.floor((s - 1) / 2), 4);
    buckets[idx]++;
    total++;
  }
  if (total === 0) return 0.5;

  let entropy = 0;
  for (const b of buckets) {
    if (b > 0) {
      const p = b / total;
      entropy -= p * Math.log2(p);
    }
  }
  const maxEntropy = Math.log2(5);
  return clamp(entropy / maxEntropy, 0, 1);
}
