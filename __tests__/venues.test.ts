import { describe, expect, it } from "vitest";

import type { Venue } from "@/lib/types";
import { formatRating, summariseVenue } from "@/lib/venues";

const baseVenue: Venue = {
  id: "v1",
  slug: "prufrock",
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
  roasters: [],
  brew_methods: [],
  has_decaf: null,
  has_plant_milk: null,
  notes: null,
  created_by: "u1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("summariseVenue", () => {
  it("computes count and average from embedded reviews", () => {
    const s = summariseVenue({
      ...baseVenue,
      reviews: [{ rating_overall: 8 }, { rating_overall: 9 }, { rating_overall: 7 }],
    });
    expect(s.review_count).toBe(3);
    expect(s.avg_overall).toBeCloseTo(8, 5);
  });

  it("returns null average when there are no reviews", () => {
    const s = summariseVenue({ ...baseVenue, reviews: [] });
    expect(s.review_count).toBe(0);
    expect(s.avg_overall).toBeNull();
  });

  it("handles null reviews (Supabase returns null, not [], for no matches)", () => {
    const s = summariseVenue({ ...baseVenue, reviews: null });
    expect(s.review_count).toBe(0);
    expect(s.avg_overall).toBeNull();
  });
});

describe("formatRating", () => {
  it("formats a number to one decimal place", () => {
    expect(formatRating(8.266)).toBe("8.3");
    expect(formatRating(9)).toBe("9.0");
  });

  it("renders an em dash for null", () => {
    expect(formatRating(null)).toBe("—");
  });
});
