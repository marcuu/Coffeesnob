import type { AttributeVector, Persona } from "./types";
import { clamp } from "./rng";

export type BucketMapping = {
  bucket: "pilgrimage" | "detour" | "convenience";
  rating_coffee_5: number;
  rating_vibe_5: number;
};

function toRating5(score: number): number {
  return Math.max(1, Math.min(5, Math.round(1 + clamp(score, -1, 1) * 2 + 2)));
}

export function mapPreferenceToBucket(persona: Persona, preference: number): BucketMapping {
  const bucket =
    preference >= persona.calibration.pilgrimage_threshold
      ? "pilgrimage"
      : preference >= persona.calibration.detour_threshold
        ? "detour"
        : "convenience";

  return {
    bucket,
    rating_coffee_5: toRating5(preference + persona.taste_vector.coffee_quality * 0.2),
    rating_vibe_5: toRating5(
      preference +
        (persona.taste_vector.vibe_modern +
          persona.taste_vector.vibe_traditional +
          persona.taste_vector.service_warmth) /
          12,
    ),
  };
}

export function axisPreference(persona: Persona, venue: AttributeVector, axis: "coffee" | "vibe"): number {
  if (axis === "coffee") {
    return (
      persona.taste_vector.coffee_quality * venue.coffee_quality +
      persona.taste_vector.roaster_purity * venue.roaster_purity +
      persona.taste_vector.espresso_skill * venue.espresso_skill +
      persona.taste_vector.manual_brew_skill * venue.manual_brew_skill
    ) / 4;
  }
  return (
    persona.taste_vector.vibe_modern * venue.vibe_modern +
    persona.taste_vector.vibe_traditional * venue.vibe_traditional +
    persona.taste_vector.service_warmth * venue.service_warmth +
    persona.taste_vector.service_speed * venue.service_speed +
    persona.taste_vector.value * venue.value
  ) / 5;
}
