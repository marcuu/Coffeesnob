import { describe, expect, it } from "vitest";

import type { OverallScoreSummary } from "@/lib/aggregation";
import type { Venue } from "@/lib/types";
import {
  buildRegionFilterOptions,
  formatRating,
  sortVenuesForListing,
} from "@/lib/venues";

describe("formatRating", () => {
  it("formats a number to one decimal place", () => {
    expect(formatRating(8.266)).toBe("8.3");
    expect(formatRating(9)).toBe("9.0");
  });

  it("renders an em dash for null", () => {
    expect(formatRating(null)).toBe("—");
  });
});

describe("buildRegionFilterOptions", () => {
  it("maps cities to regions, deduplicates, and sorts by region name", () => {
    expect(
      buildRegionFilterOptions([
        "Leeds",
        " London ",
        "Leeds",
        "",
        null,
        undefined,
      ]),
    ).toEqual([
      { id: "london", name: "London" },
      { id: "yorkshire", name: "Yorkshire" },
    ]);
  });
});

describe("sortVenuesForListing", () => {
  const makeVenue = (overrides: Partial<Venue>): Venue => ({
    id: "venue-id",
    slug: "venue-slug",
    name: "Venue",
    address_line1: "1 Street",
    address_line2: null,
    city: "London",
    postcode: "SW1A 1AA",
    country: "UK",
    latitude: null,
    longitude: null,
    website: null,
    instagram: null,
    roasters: [],
    brew_methods: [],
    has_decaf: null,
    has_plant_milk: null,
    notes: null,
    created_by: "reviewer-id",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    ...overrides,
  });

  it("defaults to sorting by weighted score descending", () => {
    const venues = [
      makeVenue({ id: "a", name: "A", created_at: "2026-04-03T00:00:00.000Z" }),
      makeVenue({ id: "b", name: "B", created_at: "2026-04-02T00:00:00.000Z" }),
      makeVenue({ id: "c", name: "C", created_at: "2026-04-01T00:00:00.000Z" }),
    ];
    const scores = new Map<string, OverallScoreSummary>([
      ["a", { score: 7.1, confidence: 0.9, rawReviewCount: 4, displayable: true }],
      ["b", { score: 9.2, confidence: 0.8, rawReviewCount: 5, displayable: true }],
      ["c", { score: 9.9, confidence: 0.1, rawReviewCount: 1, displayable: false }],
    ]);

    expect(sortVenuesForListing(venues, scores).map((venue) => venue.id)).toEqual(
      ["b", "a", "c"],
    );
  });

  it("keeps provided order for explicit non-default sort keys", () => {
    const venues = [
      makeVenue({ id: "a", name: "A" }),
      makeVenue({ id: "b", name: "B" }),
    ];
    const scores = new Map<string, OverallScoreSummary>([
      ["a", { score: 7.1, confidence: 0.9, rawReviewCount: 4, displayable: true }],
      ["b", { score: 9.2, confidence: 0.8, rawReviewCount: 5, displayable: true }],
    ]);

    expect(
      sortVenuesForListing(venues, scores, "newest").map((venue) => venue.id),
    ).toEqual(["a", "b"]);
  });
});
