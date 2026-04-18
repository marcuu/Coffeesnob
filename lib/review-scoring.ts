export type SixAxisInput = {
  rating_ambience: number;
  rating_service: number;
  rating_value: number;
  rating_taste: number;
  rating_body: number;
  rating_aroma: number;
};

export const OVERALL_WEIGHTS = {
  rating_ambience: 0.1,
  rating_service: 0.1,
  rating_value: 0.1,
  rating_taste: 0.25,
  rating_body: 0.2,
  rating_aroma: 0.25,
} as const;

export function deriveCoffeeScore(input: Pick<SixAxisInput, "rating_taste" | "rating_body" | "rating_aroma">): number {
  return (input.rating_taste + input.rating_body + input.rating_aroma) / 3;
}

export function deriveExperienceScore(
  input: Pick<SixAxisInput, "rating_ambience" | "rating_service" | "rating_value">,
): number {
  return (input.rating_ambience + input.rating_service + input.rating_value) / 3;
}

export function deriveOverallScore(input: SixAxisInput): number {
  return (
    input.rating_ambience * OVERALL_WEIGHTS.rating_ambience +
    input.rating_service * OVERALL_WEIGHTS.rating_service +
    input.rating_value * OVERALL_WEIGHTS.rating_value +
    input.rating_taste * OVERALL_WEIGHTS.rating_taste +
    input.rating_body * OVERALL_WEIGHTS.rating_body +
    input.rating_aroma * OVERALL_WEIGHTS.rating_aroma
  );
}

export function deriveOverallRatingInt(input: SixAxisInput): number {
  return Math.max(1, Math.min(10, Math.round(deriveOverallScore(input))));
}
