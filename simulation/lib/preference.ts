import type { AttributeVector, Persona } from "./types";
import { clamp, SeededRng } from "./rng";

export function dotPreference(persona: Persona, venue: AttributeVector): number {
  let weighted = 0;
  let normaliser = 0;
  for (const [key, taste] of Object.entries(persona.taste_vector) as Array<[
    keyof AttributeVector,
    number,
  ]>) {
    weighted += taste * venue[key];
    normaliser += Math.abs(taste);
  }
  return normaliser === 0 ? 0 : weighted / normaliser;
}

export function computePreference(
  persona: Persona,
  venue: AttributeVector,
  rng: SeededRng,
  consensusScore?: number | null,
): number {
  const base = dotPreference(persona, venue);
  const noise = rng.normal(0, persona.calibration.noise);
  const consensus = typeof consensusScore === "number" ? (consensusScore - 6) / 10 : 0;
  return clamp(base + noise + consensus * persona.calibration.conformity * 0.12, -1, 1.2);
}
