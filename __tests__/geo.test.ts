import { describe, expect, it } from "vitest";

import { distanceMiles, formatDistanceMiles, parseLatLng } from "@/lib/geo";

describe("distanceMiles", () => {
  it("returns ~169 miles for London → Leeds", () => {
    // Charing Cross → Leeds city centre.
    const d = distanceMiles(51.5074, -0.1278, 53.8008, -1.5491);
    expect(d).toBeGreaterThan(160);
    expect(d).toBeLessThan(180);
  });

  it("returns 0 for identical points", () => {
    expect(distanceMiles(53.8, -1.5, 53.8, -1.5)).toBe(0);
  });
});

describe("formatDistanceMiles", () => {
  it("labels very short distances as nearby", () => {
    expect(formatDistanceMiles(0.05)).toBe("nearby");
  });
  it("shows one decimal under 10 miles", () => {
    expect(formatDistanceMiles(3.27)).toBe("3.3 mi");
  });
  it("rounds whole miles at 10+", () => {
    expect(formatDistanceMiles(42.6)).toBe("43 mi");
  });
});

describe("parseLatLng", () => {
  it("parses a valid pair", () => {
    expect(parseLatLng("53.8008,-1.5491")).toEqual({
      lat: 53.8008,
      lng: -1.5491,
    });
  });
  it("rejects malformed values", () => {
    expect(parseLatLng("foo")).toBeNull();
    expect(parseLatLng("53.8")).toBeNull();
    expect(parseLatLng(undefined)).toBeNull();
  });
  it("rejects out-of-range coordinates", () => {
    expect(parseLatLng("91,0")).toBeNull();
    expect(parseLatLng("0,181")).toBeNull();
  });
});
