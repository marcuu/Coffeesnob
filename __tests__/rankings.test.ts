import { describe, expect, it } from "vitest";

import type { OverallScoreSummary } from "@/lib/aggregation";
import { buildRankings } from "@/lib/rankings";
import type { Venue } from "@/lib/types";

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

const makeScore = (
  score: number,
  displayable: boolean,
  rawReviewCount = 5,
): OverallScoreSummary => ({
  score,
  confidence: displayable ? 0.9 : 0.1,
  rawReviewCount,
  displayable,
});

describe("buildRankings", () => {
  it("splits displayable venues into ranked and non-displayable into unranked", () => {
    const venues = [
      makeVenue({ id: "a", name: "Alpha" }),
      makeVenue({ id: "b", name: "Beta" }),
      makeVenue({ id: "c", name: "Gamma" }),
    ];
    const scores = new Map<string, OverallScoreSummary>([
      ["a", makeScore(8.5, true)],
      ["b", makeScore(9.1, false)],
      ["c", makeScore(7.0, true)],
    ]);

    const { ranked, unranked } = buildRankings(venues, scores);

    expect(ranked.map((r) => r.venue.id)).toEqual(["a", "c"]);
    expect(unranked.map((u) => u.venue.id)).toEqual(["b"]);
  });

  it("venues with no score entry are placed in unranked with 0 reviewCount", () => {
    const venues = [makeVenue({ id: "a" })];
    const scores = new Map<string, OverallScoreSummary>();

    const { ranked, unranked } = buildRankings(venues, scores);

    expect(ranked).toHaveLength(0);
    expect(unranked).toHaveLength(1);
    expect(unranked[0].reviewCount).toBe(0);
  });

  it("assigns rank numbers starting at 1 in score-descending order", () => {
    const venues = [
      makeVenue({ id: "a", name: "A" }),
      makeVenue({ id: "b", name: "B" }),
      makeVenue({ id: "c", name: "C" }),
    ];
    const scores = new Map<string, OverallScoreSummary>([
      ["a", makeScore(7.5, true)],
      ["b", makeScore(9.5, true)],
      ["c", makeScore(8.0, true)],
    ]);

    const { ranked } = buildRankings(venues, scores);

    expect(ranked[0]).toMatchObject({ rank: 1, venue: expect.objectContaining({ id: "b" }) });
    expect(ranked[1]).toMatchObject({ rank: 2, venue: expect.objectContaining({ id: "c" }) });
    expect(ranked[2]).toMatchObject({ rank: 3, venue: expect.objectContaining({ id: "a" }) });
  });

  it("sorts unranked venues by review count desc, then name asc", () => {
    const venues = [
      makeVenue({ id: "a", name: "Zara" }),
      makeVenue({ id: "b", name: "Apple" }),
      makeVenue({ id: "c", name: "Mango" }),
      makeVenue({ id: "d", name: "Banana" }),
    ];
    const scores = new Map<string, OverallScoreSummary>([
      ["a", makeScore(5.0, false, 10)],
      ["b", makeScore(5.0, false, 10)],
      ["c", makeScore(5.0, false, 3)],
      ["d", makeScore(5.0, false, 3)],
    ]);

    const { unranked } = buildRankings(venues, scores);

    // Review count desc: a,b (10) before c,d (3); within same count, name asc
    expect(unranked.map((u) => u.venue.id)).toEqual(["b", "a", "d", "c"]);
  });

  it("exposes the score on each ranked entry", () => {
    const venues = [makeVenue({ id: "a" })];
    const scores = new Map<string, OverallScoreSummary>([
      ["a", makeScore(8.3, true, 4)],
    ]);

    const { ranked } = buildRankings(venues, scores);

    expect(ranked[0].score).toBe(8.3);
    expect(ranked[0].reviewCount).toBe(4);
  });

  it("returns empty arrays when venues list is empty", () => {
    const { ranked, unranked } = buildRankings([], new Map());
    expect(ranked).toHaveLength(0);
    expect(unranked).toHaveLength(0);
  });

  it("does not mutate the input venues array", () => {
    const venues = [
      makeVenue({ id: "a", name: "A" }),
      makeVenue({ id: "b", name: "B" }),
    ];
    const original = [...venues];
    const scores = new Map<string, OverallScoreSummary>([
      ["a", makeScore(9.0, true)],
      ["b", makeScore(8.0, true)],
    ]);

    buildRankings(venues, scores);

    expect(venues).toEqual(original);
  });
});
