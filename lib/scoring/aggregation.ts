// Pure aggregation function for weighted venue scores. No DB access.
// See docs/scoring.md Section 2 for the specification.

export type WeightedReview = { score: number; weight: number };

export type VenueAxisAggregate = {
  score: number;
  confidence: number;
  effectiveN: number;
  rawCount: number;
};

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
