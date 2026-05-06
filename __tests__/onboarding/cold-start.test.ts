import { describe, expect, it } from "vitest";

import {
  COLD_START_K,
  COLD_START_THRESHOLD,
  applyColdStartSmoothing,
} from "@/lib/scoring/weights";

describe("applyColdStartSmoothing", () => {
  it("returns the observed weight unchanged once the user reaches the threshold", () => {
    const observed = 1.7;
    const result = applyColdStartSmoothing(observed, COLD_START_THRESHOLD, 0.5);
    expect(result).toBe(observed);
  });

  it("returns the observed weight unchanged for n > threshold", () => {
    const observed = 2.1;
    const result = applyColdStartSmoothing(
      observed,
      COLD_START_THRESHOLD + 5,
      0.5,
    );
    expect(result).toBe(observed);
  });

  it("with zero reviews returns the prior", () => {
    const result = applyColdStartSmoothing(0, 0, 0.6);
    expect(result).toBeCloseTo(0.6, 6);
  });

  it("blends observed and prior at one review (PRD: ~91% prior, ~9% data)", () => {
    const observed = 2.0;
    const prior = 0.5;
    const result = applyColdStartSmoothing(observed, 1, prior);
    // (1*2.0 + 10*0.5) / (1+10) = 7/11
    expect(result).toBeCloseTo((1 * observed + COLD_START_K * prior) / 11, 6);
    // Should be much closer to prior than observed.
    expect(Math.abs(result - prior)).toBeLessThan(Math.abs(result - observed));
  });

  it("interpolates monotonically as n increases", () => {
    const observed = 3.0;
    const prior = 0.5;
    const at1 = applyColdStartSmoothing(observed, 1, prior);
    const at2 = applyColdStartSmoothing(observed, 2, prior);
    const at4 = applyColdStartSmoothing(observed, 4, prior);
    expect(at1).toBeLessThan(at2);
    expect(at2).toBeLessThan(at4);
    expect(at4).toBeLessThan(observed);
  });

  it("respects a custom k", () => {
    const observed = 2.0;
    const prior = 0.5;
    const k = 1;
    const result = applyColdStartSmoothing(observed, 1, prior, k);
    expect(result).toBeCloseTo((observed + prior) / 2, 6);
  });
});
