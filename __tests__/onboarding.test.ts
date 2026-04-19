import { describe, expect, it } from "vitest";

import {
  FLAVOUR_PAIRS,
  confidenceFor,
  rankVenues,
  reasonsFor,
  scoreVenueFor,
  type City,
  type OnboardingVenue,
  type Prefs,
} from "@/app/onboarding/data";
import {
  buildCityOptions,
  cityIdFromName,
  mapBrewMethodsToDrinks,
  mapDbVenuesToOnboarding,
} from "@/app/onboarding/venue-mapping";
import type { OverallScoreSummary } from "@/lib/aggregation";
import type { Venue as DbVenue } from "@/lib/types";

const emptyPrefs: Prefs = {
  city: "",
  drink: [],
  pairPicks: {},
  axes: null,
};

const london: OnboardingVenue = {
  slug: "la-cabra",
  name: "La Cabra",
  city: "London",
  area: "london",
  roaster: "La Cabra (DK)",
  axes: { floral: 0.9, fruit: 0.8 },
  drinks: ["filter", "espresso"],
  score: 8.9,
  reviews: 47,
  pitch: "Geisha filter like jasmine tea.",
  proof: "47 reviews, weighted score 8.9.",
};

const leeds: OnboardingVenue = {
  slug: "north-star",
  name: "North Star",
  city: "Leeds",
  area: "leeds",
  roaster: "North Star",
  axes: { choc: 0.9, nutty: 0.8 },
  drinks: ["milky", "espresso"],
  score: 8.2,
  reviews: 88,
  pitch: "Cortado with cocoa.",
  proof: "88 reviews, weighted score 8.2.",
};

const cities: City[] = [
  { id: "london", name: "London", venues: 1 },
  { id: "leeds", name: "Leeds", venues: 1 },
];

describe("onboarding/data rankers", () => {
  it("flavour pair options carry unique ids per pair", () => {
    for (const pair of FLAVOUR_PAIRS) {
      const ids = pair.options.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("scoreVenueFor rewards matching city", () => {
    const baseline = scoreVenueFor(london, emptyPrefs);
    const boosted = scoreVenueFor(london, { ...emptyPrefs, city: "london" });
    expect(boosted).toBeGreaterThan(baseline);
  });

  it("rankVenues puts a city-local venue on top when only city is set", () => {
    const ranked = rankVenues([london, leeds], { ...emptyPrefs, city: "leeds" });
    expect(ranked[0].area).toBe("leeds");
  });

  it("rankVenues surfaces a floral venue for a floral flavour profile", () => {
    const prefs: Prefs = {
      city: "london",
      drink: ["filter"],
      pairPicks: { round1: "yirg" },
      axes: { floral: 1, fruit: 0.6 },
    };
    const ranked = rankVenues([london, leeds], prefs);
    expect(ranked[0].slug).toBe("la-cabra");
  });

  it("confidenceFor increases with matched signals and is capped at 97", () => {
    const baseline = confidenceFor(london, emptyPrefs);
    const full = confidenceFor(london, {
      city: "london",
      drink: ["filter", "espresso"],
      pairPicks: {},
      axes: { floral: 1, fruit: 1 },
    });
    expect(full).toBeGreaterThan(baseline);
    expect(full).toBeLessThanOrEqual(97);
  });

  it("reasonsFor falls back to 'community favourite' when no signals overlap", () => {
    expect(reasonsFor(london, emptyPrefs, cities)).toEqual([
      "community favourite",
    ]);
  });

  it("reasonsFor names the city when the venue is local", () => {
    const reasons = reasonsFor(london, { ...emptyPrefs, city: "london" }, cities);
    expect(reasons).toContain("in London");
  });
});

describe("onboarding/venue-mapping", () => {
  it("cityIdFromName normalises whitespace and case", () => {
    expect(cityIdFromName("London")).toBe("london");
    expect(cityIdFromName("  Newcastle upon Tyne  ")).toBe(
      "newcastle-upon-tyne",
    );
  });

  it("mapBrewMethodsToDrinks expands espresso to milky and groups filter brewers", () => {
    const drinks = mapBrewMethodsToDrinks(
      ["espresso", "filter", "pour_over", "batch_brew"],
      false,
    );
    expect(drinks).toContain("espresso");
    expect(drinks).toContain("milky");
    expect(drinks).toContain("filter");
  });

  it("mapBrewMethodsToDrinks adds milky when plant milk is available", () => {
    const drinks = mapBrewMethodsToDrinks([], true);
    expect(drinks).toContain("milky");
  });

  it("mapBrewMethodsToDrinks detects cold brew", () => {
    expect(mapBrewMethodsToDrinks(["cold_brew"], false)).toContain("cold");
  });

  it("mapDbVenuesToOnboarding maps score, reviews, area, drinks, and pitch", () => {
    const dbVenue: DbVenue = {
      id: "v1",
      slug: "prufrock-coffee",
      name: "Prufrock",
      address_line1: "23-25 Leather Lane",
      address_line2: null,
      city: "London",
      postcode: "EC1N 7TE",
      country: "GB",
      latitude: null,
      longitude: null,
      website: null,
      instagram: null,
      roasters: ["Square Mile"],
      brew_methods: ["espresso", "filter"],
      has_decaf: true,
      has_plant_milk: true,
      notes: "Long-running Leather Lane fixture.",
      created_by: "user",
      created_at: "2025-01-01",
      updated_at: "2025-01-01",
    };
    const scores = new Map<string, OverallScoreSummary>([
      [
        "v1",
        {
          score: 8.3,
          confidence: 0.5,
          rawReviewCount: 12,
          displayable: true,
        },
      ],
    ]);
    const [venue] = mapDbVenuesToOnboarding([dbVenue], scores);
    expect(venue.area).toBe("london");
    expect(venue.score).toBe(8.3);
    expect(venue.reviews).toBe(12);
    expect(venue.roaster).toBe("Square Mile");
    expect(venue.drinks).toEqual(
      expect.arrayContaining(["espresso", "milky", "filter"]),
    );
    expect(venue.pitch).toContain("Leather Lane");
    expect(venue.axes.fruit).toBeGreaterThan(0);
  });

  it("mapDbVenuesToOnboarding zeroes score when review signal is not displayable", () => {
    const dbVenue: DbVenue = {
      id: "v2",
      slug: "newbie",
      name: "Newbie",
      address_line1: "",
      address_line2: null,
      city: "Bristol",
      postcode: "",
      country: "GB",
      latitude: null,
      longitude: null,
      website: null,
      instagram: null,
      roasters: [],
      brew_methods: [],
      has_decaf: null,
      has_plant_milk: null,
      notes: null,
      created_by: "user",
      created_at: "2025-01-01",
      updated_at: "2025-01-01",
    };
    const [venue] = mapDbVenuesToOnboarding([dbVenue], new Map());
    expect(venue.score).toBe(0);
    expect(venue.reviews).toBe(0);
    expect(venue.roaster).toBe("Independent");
    expect(venue.pitch).toContain("Newbie");
  });

  it("buildCityOptions groups venues by area and counts them", () => {
    const venues: OnboardingVenue[] = [london, leeds, { ...leeds, slug: "x2" }];
    const result = buildCityOptions(venues);
    const leedsOpt = result.find((c) => c.id === "leeds");
    expect(leedsOpt?.venues).toBe(2);
    const londonOpt = result.find((c) => c.id === "london");
    expect(londonOpt?.venues).toBe(1);
  });
});
