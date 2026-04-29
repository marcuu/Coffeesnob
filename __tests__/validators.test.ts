import { describe, expect, it } from "vitest";

import {
  rankedReviewCreateSchema,
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

describe("rankedReviewCreateSchema", () => {
  const base = {
    venue_id: "123e4567-e89b-42d3-a456-426614174000",
    visited_on: "2026-04-17",
    bucket: "pilgrimage" as const,
    rank_position: 1500,
    history: [],
    rating_coffee_5: 4,
    rating_vibe_5: 3,
    body: "Solid filter, friendly bar staff.",
  };

  it("accepts a valid ranked review", () => {
    expect(rankedReviewCreateSchema.safeParse(base).success).toBe(true);
  });

  it("rejects rating_coffee_5 / rating_vibe_5 outside 1-5", () => {
    expect(
      rankedReviewCreateSchema.safeParse({ ...base, rating_coffee_5: 6 })
        .success,
    ).toBe(false);
    expect(
      rankedReviewCreateSchema.safeParse({ ...base, rating_vibe_5: 0 }).success,
    ).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(
      rankedReviewCreateSchema.safeParse({ ...base, visited_on: "17/04/2026" })
        .success,
    ).toBe(false);
  });

  it("requires a uuid for venue_id", () => {
    expect(
      rankedReviewCreateSchema.safeParse({ ...base, venue_id: "not-a-uuid" })
        .success,
    ).toBe(false);
  });

  it("requires both axes — missing rating_coffee_5 fails", () => {
    const { rating_coffee_5: _omit, ...rest } = base;
    void _omit;
    expect(rankedReviewCreateSchema.safeParse(rest).success).toBe(false);
  });

  it("requires both axes — missing rating_vibe_5 fails", () => {
    const { rating_vibe_5: _omit, ...rest } = base;
    void _omit;
    expect(rankedReviewCreateSchema.safeParse(rest).success).toBe(false);
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
