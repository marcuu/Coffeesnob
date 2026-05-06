import { describe, expect, it } from "vitest";

import { buildDefaultPersonas, buildDefaultVenues } from "@/simulation/lib/catalog";
import { mapPreferenceToBucket } from "@/simulation/lib/bucket-mapping";
import { computePreference } from "@/simulation/lib/preference";
import { SeededRng } from "@/simulation/lib/rng";

describe("Bramford simulation catalog", () => {
  it("generates the v1 population sizes", () => {
    expect(buildDefaultPersonas()).toHaveLength(50);
    expect(buildDefaultVenues()).toHaveLength(80);
  });
});

describe("computePreference", () => {
  it("is deterministic for a seed", () => {
    const persona = buildDefaultPersonas()[0];
    const venue = buildDefaultVenues()[0];
    const a = computePreference(persona, venue.attribute_vector, new SeededRng("x"));
    const b = computePreference(persona, venue.attribute_vector, new SeededRng("x"));
    expect(a).toBeCloseTo(b, 8);
  });
});

describe("mapPreferenceToBucket", () => {
  it("maps high preference to pilgrimage", () => {
    const persona = buildDefaultPersonas()[0];
    const out = mapPreferenceToBucket(persona, persona.calibration.pilgrimage_threshold + 0.1);
    expect(out.bucket).toBe("pilgrimage");
    expect(out.rating_coffee_5).toBeGreaterThanOrEqual(1);
    expect(out.rating_coffee_5).toBeLessThanOrEqual(5);
  });

  it("maps low preference to convenience", () => {
    const persona = buildDefaultPersonas()[0];
    const out = mapPreferenceToBucket(persona, persona.calibration.detour_threshold - 0.2);
    expect(out.bucket).toBe("convenience");
  });
});
