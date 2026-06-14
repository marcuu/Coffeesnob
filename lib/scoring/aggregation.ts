// Pure aggregation function for weighted venue scores. No DB access.
// See docs/scoring.md Section 2 for the specification.

export type WeightedReview = { score: number; weight: number };

export type VenueAxisAggregate = {
  score: number;
  confidence: number;
  effectiveN: number;
  rawCount: number;
};

// Floor below which a review carries too little weight to be worth counting.
// Re-derived for the geometric-mean weighting (PRD Workstream D4): because the
// geometric mean lifts and compresses per-review weights toward 1, a near-zero
// floor stopped doing useful work, so this sits at 0.05 — a review must clear
// ~5% effective weight to enter the posterior. Kept in lockstep with the
// matching floor in lib/aggregation.ts (the score explainer).
const MIN_EFFECTIVE_WEIGHT = 0.05;

export function aggregateVenueAxis(
  reviews: WeightedReview[],
  priorScore: number,
  priorStrength: number,
): VenueAxisAggregate {
  const filtered = reviews.filter((r) => r.weight > MIN_EFFECTIVE_WEIGHT);

  if (filtered.length === 0) {
    return { score: priorScore, confidence: 0, effectiveN: 0, rawCount: 0 };
  }

  let weightedSum = 0;
  let weightTotal = 0;
  for (const r of filtered) {
    weightedSum += r.score * r.weight;
    weightTotal += r.weight;
  }

  const posteriorScore =
    (weightedSum + priorScore * priorStrength) / (weightTotal + priorStrength);
  const confidence = weightTotal / (weightTotal + priorStrength);

  return {
    score: posteriorScore,
    confidence,
    effectiveN: weightTotal,
    rawCount: filtered.length,
  };
}
