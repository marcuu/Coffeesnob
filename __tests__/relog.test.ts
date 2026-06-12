import { describe, expect, it } from "vitest";

import { relogPlacement } from "@/lib/ranking/relog";
import type { Review } from "@/lib/types";

function review(id: string, venueId: string, rank: number): Review {
  return {
    id,
    venue_id: venueId,
    reviewer_id: "u-1",
    rating_overall: 7,
    rating_coffee_5: 4,
    rating_vibe_5: 3,
    bucket: "detour",
    rank_position: rank,
    body: "",
    visited_on: "2026-05-01",
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-01T10:00:00Z",
  } as Review;
}

const bucket = [
  review("r-1", "v-a", 1000),
  review("r-2", "v-b", 2000),
  review("r-3", "v-c", 3000),
];

describe("relogPlacement", () => {
  it("places the re-log immediately after the prior review", () => {
    expect(relogPlacement(bucket, "r-2", "v-b")).toEqual({
      rankPosition: 2001,
      listChanged: false,
    });
  });

  it("appends to the end when the prior review is gone from the bucket", () => {
    expect(relogPlacement(bucket, "r-9", "v-z")).toEqual({
      rankPosition: 4000,
      listChanged: true,
    });
  });

  it("ignores a prior review id that points at a different venue", () => {
    // Defensive: relog_of must reference a review of the same venue.
    expect(relogPlacement(bucket, "r-2", "v-c")).toEqual({
      rankPosition: 4000,
      listChanged: true,
    });
  });

  it("handles an empty bucket by starting at 1000", () => {
    expect(relogPlacement([], "r-1", "v-a")).toEqual({
      rankPosition: 1000,
      listChanged: true,
    });
  });
});
