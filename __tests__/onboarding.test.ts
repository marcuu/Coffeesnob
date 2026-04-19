import { describe, expect, it } from "vitest";

import {
  CITIES,
  FLAVOUR_PAIRS,
  VENUES,
  confidenceFor,
  rankVenues,
  reasonsFor,
  scoreVenueFor,
  type Prefs,
} from "@/app/onboarding/data";

const emptyPrefs: Prefs = {
  city: "",
  drink: [],
  pairPicks: {},
  axes: null,
};

describe("onboarding/data", () => {
  it("fixture shape: every venue's area resolves to a known city", () => {
    const cityIds = new Set(CITIES.map((c) => c.id));
    for (const v of VENUES) {
      expect(cityIds.has(v.area)).toBe(true);
    }
  });

  it("flavour pair options carry unique ids per pair", () => {
    for (const pair of FLAVOUR_PAIRS) {
      const ids = pair.options.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("scoreVenueFor rewards matching city", () => {
    const london = VENUES.find((v) => v.area === "london")!;
    const baseline = scoreVenueFor(london, emptyPrefs);
    const boosted = scoreVenueFor(london, { ...emptyPrefs, city: "london" });
    expect(boosted).toBeGreaterThan(baseline);
  });

  it("rankVenues puts a city-local venue on top when only city is set", () => {
    const prefs: Prefs = { ...emptyPrefs, city: "leeds" };
    const ranked = rankVenues(prefs);
    expect(ranked[0].area).toBe("leeds");
  });

  it("rankVenues surfaces a floral-forward venue for a floral flavour profile", () => {
    const prefs: Prefs = {
      city: "london",
      drink: ["filter"],
      pairPicks: { round1: "yirg" },
      axes: { floral: 1, fruit: 0.6 },
    };
    const ranked = rankVenues(prefs);
    expect(ranked[0].axes.floral ?? 0).toBeGreaterThanOrEqual(0.7);
  });

  it("confidenceFor increases with more matched signals and is capped at 97", () => {
    const venue = VENUES.find((v) => v.slug === "la-cabra")!;
    const baseline = confidenceFor(venue, emptyPrefs);
    const full = confidenceFor(venue, {
      city: "london",
      drink: ["filter", "espresso"],
      pairPicks: {},
      axes: { floral: 1, fruit: 1 },
    });
    expect(full).toBeGreaterThan(baseline);
    expect(full).toBeLessThanOrEqual(97);
  });

  it("reasonsFor falls back to 'community favourite' when no signals overlap", () => {
    const venue = VENUES.find((v) => v.slug === "la-cabra")!;
    expect(reasonsFor(venue, emptyPrefs)).toEqual(["community favourite"]);
  });

  it("reasonsFor names the city when the venue is local", () => {
    const venue = VENUES.find((v) => v.slug === "la-cabra")!;
    const reasons = reasonsFor(venue, { ...emptyPrefs, city: "london" });
    expect(reasons).toContain("in London");
  });
});
