// Two-axis review scoring helpers. The six-axis schema was collapsed in
// migration 20260428000000_two_axis_collapse.sql; reviews now carry
// rating_coffee_5 and rating_vibe_5 on a 1-5 scale.
//
// The weighted-scoring pipeline still operates on a 1-10 internal scale, so
// the helpers below scale 1-5 → 1-10 by multiplying by 2 (range 2-10). The
// pipeline aggregate clamps to [1, 10] for safety. Documented in
// docs/scoring.md.

export type TwoAxisInput = {
  rating_coffee_5: number;
  rating_vibe_5: number;
};

export function scaleFiveToTen(score5: number): number {
  return score5 * 2;
}

export function deriveCoffeeScore(input: Pick<TwoAxisInput, "rating_coffee_5">): number {
  return scaleFiveToTen(input.rating_coffee_5);
}

export function deriveVibeScore(input: Pick<TwoAxisInput, "rating_vibe_5">): number {
  return scaleFiveToTen(input.rating_vibe_5);
}
