// Pure scoring functions. No DB access, no I/O. All formulas and constants
// live here; callers (lib/scoring/pipeline.ts, etc.) inject data.
//
// See docs/scoring.md Section 2 for the specification and rationale.

export type Axis = "overall" | "coffee" | "vibe";

export const AXES: readonly Axis[] = ["overall", "coffee", "vibe"];

export type ReviewerStatus = "beaned" | "invited" | "active";

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
  STATUS_BASE_WEIGHT: { beaned: 3.0, invited: 1.0, active: 0.5 } as Record<
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
    vibe: 6.0,
  } as Record<Axis, number>,
  // ── The responsiveness ↔ stability dial (Marcus-tunable, see docs/scoring.md
  //    Section 11). Lower values let early reviews count harder (responsive,
  //    swingable); higher values demand more evidence (stable, slower). ──
  //
  // PRIOR_STRENGTH (k) governs how much weighted evidence a venue needs to
  // leave `forming` and how hard the prior pulls. It is the *quantity* knob and
  // lives only here, at the aggregation prior — never in per-review weight.
  PRIOR_STRENGTH: 3.0,
  // Confidence at which a venue earns full display precision (one decimal) and
  // full typographic authority. Below it, a displayable venue is `provisional`
  // and shown coarsely. See lib/scoring-display.ts → deriveMaturity.
  SETTLED_CONFIDENCE_THRESHOLD: 0.75,
};

const MS_PER_DAY = 86_400_000;
const MS_PER_MONTH = 30 * MS_PER_DAY;

function clamp(x: number, lo: number, hi: number): number {
  if (Number.isNaN(x)) return lo;
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

// Equal-weight geometric mean of factors each already normalised to [0, 1].
// Every factor has identical elasticity (∂ln(weight)/∂ln(fᵢ) = 1/m), so no
// single factor can dominate — that property is the whole point of using a
// geometric mean here instead of a raw product (see docs/scoring.md §2 / PRD
// Workstream D). A zero factor collapses the result to zero, which preserves
// "no axis weight → no contribution".
function geometricMean(factors: number[]): number {
  if (factors.length === 0) return 0;
  let logSum = 0;
  for (const f of factors) {
    if (f <= 0) return 0;
    logSum += Math.log(f);
  }
  return Math.exp(logSum / factors.length);
}

// Per-review weight is a *quality-only* signal: the co-equal quality factors
// {credibility, recency, completeness, (tenure + consistency, where they
// apply)} combined as an equal-weight geometric mean.
//
// QUANTITY DOES NOT LIVE HERE. There is deliberately no platform-population
// or global reviewer-count term in this function. "One review matters more
// when a venue has few, less when it has many" is a property of the
// aggregation prior (influence ≈ wᵢ / (Σw + k), keyed to per-venue evidence
// in lib/scoring/aggregation.ts), not of per-review weight. Adding a global
// count here would be the wrong variable — it would suppress sparse-but-legit
// venues and would dominate the co-equal quality factors. See PRD Workstream D2.
export function computeReviewWeight(
  reviewer: ReviewerState,
  review: ReviewForWeighting,
  axis: Axis,
  now: Date,
): number {
  const daysSinceVisit =
    (now.getTime() - review.visitedOn.getTime()) / MS_PER_DAY;
  // Clamp to [0, 1] so a future-dated visit (recency > 1) can't inflate the
  // mean past the other factors.
  const recency = Math.min(
    1,
    Math.exp(-daysSinceVisit / SCORING_CONSTANTS.RECENCY_HALF_LIFE_DAYS),
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

  // Quality factors that always apply, each co-equal in the geometric mean.
  const factors = [base, recency, completeness];

  // Seeded ("beaned") reviewers are pre-vetted anchors: omit the
  // tenure/consistency factors that otherwise penalise new accounts, so their
  // first review can anchor an otherwise-unreviewed venue off the prior.
  // Recency and completeness still apply — stale or partial reviews count less.
  if (reviewer.status !== "beaned") {
    factors.push(reviewer.tenureScore, reviewer.consistencyScore);
  }

  return clamp(geometricMean(factors), 0, 1);
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
  const countMult =
    _reviewer.status === "beaned" && reviewsInAxis >= 1
      ? SCORING_CONSTANTS.AXIS_COUNT_MAX_MULTIPLIER
      : Math.min(
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

// Cold-start credibility smoothing. For users with fewer than
// COLD_START_THRESHOLD reviews in an axis, blend their measured weight
// toward a population prior so the displayed Coffee IQ feels stable from
// review one. This is a *display-time* smoothing applied on top of the
// stored reviewer_axis_weights row — the underlying value remains the
// pipeline's measured weight, and venue aggregation continues to use
// PRIOR_STRENGTH=3.0 (see lib/scoring/aggregation.ts).
//
// Formula matches PRD §8: (n*observed + k*populationPrior) / (n+k).
export const COLD_START_THRESHOLD = 5;
export const COLD_START_K = 10;

export function applyColdStartSmoothing(
  observedWeight: number,
  axisReviewCount: number,
  populationPrior: number,
  k: number = COLD_START_K,
): number {
  if (axisReviewCount >= COLD_START_THRESHOLD) return observedWeight;
  const n = Math.max(0, axisReviewCount);
  return (n * observedWeight + k * populationPrior) / (n + k);
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
