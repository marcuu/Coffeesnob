import type { Persona } from "./persona-loader";
import type { AttributeVector } from "./preference";

export type ReviewBucket = "pilgrimage" | "detour" | "convenience";

export type MappedScores = {
  bucket: ReviewBucket;
  coffee_5: 1 | 2 | 3 | 4 | 5;
  vibe_5: 1 | 2 | 3 | 4 | 5;
};

// Maps a normalised preference score [-1,1] to a ReviewBucket using the
// persona's pilgrimage_threshold and detour_threshold calibration. Thresholds
// apply to the [0,1] shift of the preference value.
export function mapPreferenceToBucket(
  preference: number,
  persona: Persona,
): ReviewBucket {
  const p = (preference + 1) / 2; // shift to [0,1]
  if (p >= persona.calibration.pilgrimage_threshold) return "pilgrimage";
  if (p >= persona.calibration.detour_threshold) return "detour";
  return "convenience";
}

// Maps raw preference and venue attribute_vector to integer 1-5 scores for
// coffee and vibe, anchored to the bucket band so scores are bucket-consistent.
export function mapPreferenceToScores(
  preference: number,
  bucket: ReviewBucket,
  persona: Persona,
  attr: AttributeVector,
): MappedScores {
  const coffee_5 = computeSubScore(
    persona.taste_vector,
    attr,
    ["coffee_quality", "roaster_purity", "espresso_skill", "manual_brew_skill"],
    bucket,
  );
  const vibe_5 = computeSubScore(
    persona.taste_vector,
    attr,
    ["vibe_modern", "vibe_traditional", "service_warmth", "service_speed", "value"],
    bucket,
  );
  return { bucket, coffee_5, vibe_5 };
}

type VectorKey = keyof AttributeVector;

function computeSubScore(
  taste: Persona["taste_vector"],
  attr: AttributeVector,
  keys: VectorKey[],
  bucket: ReviewBucket,
): 1 | 2 | 3 | 4 | 5 {
  const dot = keys.reduce(
    (s, k) => s + (taste as Record<string, number>)[k] * (attr as Record<string, number>)[k],
    0,
  ) / keys.length;

  // Normalise dot product to [0,1] then anchor to the bucket's floor.
  const norm = (dot + 1) / 2;

  // Bucket floors: pilgrimage → min 3, detour → min 2, convenience → min 1.
  const floor = bucket === "pilgrimage" ? 3 : bucket === "detour" ? 2 : 1;
  const raw = floor + norm * (5 - floor);
  return clampTo5(Math.round(raw));
}

function clampTo5(n: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, n)) as 1 | 2 | 3 | 4 | 5;
}
