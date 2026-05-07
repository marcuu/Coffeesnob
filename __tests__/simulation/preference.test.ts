import { describe, expect, it } from "vitest";
import { computePreference, sampleNoise, consensusPull, type AttributeVector } from "../../simulation/lib/preference";
import type { TasteVector } from "../../simulation/lib/persona-loader";

const tasteSnob: TasteVector = {
  coffee_quality:    0.95,
  roaster_purity:    0.90,
  espresso_skill:    0.70,
  manual_brew_skill: 0.85,
  vibe_modern:      -0.30,
  vibe_traditional:  0.85,
  service_warmth:   -0.20,
  service_speed:     0.00,
  value:            -0.30,
  tourist_density:  -0.80,
};

const attrHighQuality: AttributeVector = {
  coffee_quality:    0.95,
  roaster_purity:    0.90,
  espresso_skill:    0.85,
  manual_brew_skill: 0.92,
  vibe_modern:       0.30,
  vibe_traditional:  0.80,
  service_warmth:    0.40,
  service_speed:     0.35,
  value:             0.50,
  tourist_density:   0.25,
};

const attrTouristTrap: AttributeVector = {
  coffee_quality:    0.15,
  roaster_purity:    0.05,
  espresso_skill:    0.20,
  manual_brew_skill: 0.00,
  vibe_modern:       0.45,
  vibe_traditional:  0.35,
  service_warmth:    0.55,
  service_speed:     0.70,
  value:             0.25,
  tourist_density:   0.90,
};

describe("computePreference", () => {
  it("returns a value in [-1, 1] for typical vectors", () => {
    const p = computePreference(tasteSnob, attrHighQuality);
    expect(p).toBeGreaterThan(-1);
    expect(p).toBeLessThan(1);
  });

  it("snob strongly prefers high-quality venue over tourist trap", () => {
    const pHigh = computePreference(tasteSnob, attrHighQuality);
    const pTourist = computePreference(tasteSnob, attrTouristTrap);
    expect(pHigh).toBeGreaterThan(pTourist + 0.1);
  });

  it("returns 0 for zero taste vector", () => {
    const zero = Object.fromEntries(Object.keys(tasteSnob).map((k) => [k, 0])) as TasteVector;
    expect(computePreference(zero, attrHighQuality)).toBe(0);
  });

  it("is symmetric: negating taste vector negates preference", () => {
    const negated = Object.fromEntries(
      Object.entries(tasteSnob).map(([k, v]) => [k, -v]),
    ) as TasteVector;
    const p = computePreference(tasteSnob, attrHighQuality);
    const pNeg = computePreference(negated, attrHighQuality);
    expect(pNeg).toBeCloseTo(-p, 10);
  });
});

describe("sampleNoise", () => {
  it("has mean near 0 over many samples", () => {
    const samples = Array.from({ length: 2000 }, () => sampleNoise(0.15));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(Math.abs(mean)).toBeLessThan(0.02);
  });

  it("has std dev near the requested value", () => {
    const sd = 0.2;
    const samples = Array.from({ length: 2000 }, () => sampleNoise(sd));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
    expect(Math.sqrt(variance)).toBeCloseTo(sd, 1);
  });
});

describe("consensusPull", () => {
  it("returns 0 when venue score is null", () => {
    expect(consensusPull(null, 0.5)).toBe(0);
  });

  it("pulls toward score 5.5 (neutral point)", () => {
    const pull = consensusPull(10, 1.0);
    expect(pull).toBeGreaterThan(0); // high score → positive pull
    const pullLow = consensusPull(1, 1.0);
    expect(pullLow).toBeLessThan(0); // low score → negative pull
  });

  it("scales with conformity", () => {
    const highConformity = consensusPull(10, 1.0);
    const lowConformity = consensusPull(10, 0.1);
    expect(Math.abs(highConformity)).toBeGreaterThan(Math.abs(lowConformity));
  });

  it("caps magnitude below 0.2 * conformity", () => {
    const pull = consensusPull(10, 1.0);
    expect(Math.abs(pull)).toBeLessThanOrEqual(0.2);
  });
});
