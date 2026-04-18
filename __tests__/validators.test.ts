import { describe, expect, it } from "vitest";

import {
  reviewCreateSchema,
  venueCreateSchema,
  parseCsv,
} from "@/lib/validators";

describe("venueCreateSchema", () => {
  const base = {
    slug: "prufrock-coffee",
    name: "Prufrock Coffee",
    address_line1: "23-25 Leather Lane",
    city: "London",
    postcode: "EC1N 7TE",
  };

  it("accepts a minimal valid venue and defaults country to GB", () => {
    const parsed = venueCreateSchema.parse(base);
    expect(parsed.country).toBe("GB");
    expect(parsed.roasters).toEqual([]);
    expect(parsed.brew_methods).toEqual([]);
  });

  it("rejects invalid slug formats", () => {
    const result = venueCreateSchema.safeParse({ ...base, slug: "Has Spaces" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown brew methods", () => {
    const result = venueCreateSchema.safeParse({
      ...base,
      brew_methods: ["moka_pot"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a website that is not a URL", () => {
    const result = venueCreateSchema.safeParse({
      ...base,
      website: "not a url",
    });
    expect(result.success).toBe(false);
  });
});

describe("reviewCreateSchema", () => {
  const base = {
    venue_id: "123e4567-e89b-42d3-a456-426614174000",
    rating_ambience: 7,
    rating_service: 8,
    rating_value: 7,
    rating_taste: 9,
    rating_body: 8,
    rating_aroma: 9,
    body: "Solid filter, friendly bar staff.",
    visited_on: "2026-04-17",
  };

  it("accepts a valid review", () => {
    expect(reviewCreateSchema.safeParse(base).success).toBe(true);
  });

  it("rejects ratings outside 1-10", () => {
    expect(
      reviewCreateSchema.safeParse({ ...base, rating_taste: 11 }).success,
    ).toBe(false);
    expect(
      reviewCreateSchema.safeParse({ ...base, rating_body: 0 }).success,
    ).toBe(false);
  });

  it("rejects bodies shorter than 10 characters", () => {
    expect(
      reviewCreateSchema.safeParse({ ...base, body: "too short" }).success,
    ).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(
      reviewCreateSchema.safeParse({ ...base, visited_on: "17/04/2026" })
        .success,
    ).toBe(false);
  });

  it("requires a uuid for venue_id", () => {
    expect(
      reviewCreateSchema.safeParse({ ...base, venue_id: "not-a-uuid" }).success,
    ).toBe(false);
  });
});

describe("parseCsv", () => {
  it("splits, trims, and drops empties", () => {
    expect(parseCsv(" Square Mile, Workshop ,, ")).toEqual([
      "Square Mile",
      "Workshop",
    ]);
  });

  it("returns [] for null / non-string entries", () => {
    expect(parseCsv(null)).toEqual([]);
    expect(parseCsv(new File([], "x"))).toEqual([]);
  });
});
