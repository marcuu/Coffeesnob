import type { TasteVector } from "./persona-loader";

export type AttributeVector = {
  coffee_quality:    number;
  roaster_purity:    number;
  espresso_skill:    number;
  manual_brew_skill: number;
  vibe_modern:       number;
  vibe_traditional:  number;
  service_warmth:    number;
  service_speed:     number;
  value:             number;
  tourist_density:   number;
};

const VECTOR_KEYS: (keyof AttributeVector)[] = [
  "coffee_quality",
  "roaster_purity",
  "espresso_skill",
  "manual_brew_skill",
  "vibe_modern",
  "vibe_traditional",
  "service_warmth",
  "service_speed",
  "value",
  "tourist_density",
];

// Normalised dot product of persona taste_vector and venue attribute_vector.
// Returns a value in roughly [-1, 1]; extreme vectors can slightly exceed this
// range before the noise + consensus terms are added.
export function computePreference(
  taste: TasteVector,
  attr: AttributeVector,
): number {
  const raw = VECTOR_KEYS.reduce(
    (sum, k) => sum + taste[k] * (attr[k] ?? 0),
    0,
  );
  return raw / VECTOR_KEYS.length;
}

// Box-Muller Gaussian sample. Returns one sample with the given standard
// deviation. Values outside [-3σ, 3σ] are possible but rare.
export function sampleNoise(sd: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return sd * Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
}

// Small consensus pull toward the current venue score. Keeps contrarian
// personas from drifting infinitely away from observable reality.
// Maximum contribution: ±(0.2 × conformity).
export function consensusPull(
  venueScore: number | null,
  conformity: number,
): number {
  if (venueScore === null) return 0;
  const normalised = (venueScore - 5.5) / 4.5; // [1,10] → [-1,1]
  return normalised * conformity * 0.2;
}
