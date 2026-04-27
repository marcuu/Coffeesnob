import { describe, expect, it } from "vitest";

import type { Review, ReviewBucket } from "@/lib/types";
import {
  compactBucket,
  finalRankPosition,
  nextComparison,
  recordComparison,
  startTournament,
  type Comparison,
  type TournamentState,
} from "@/lib/ranking/binary-tournament";

// Tiny factory for a review with the bucket-relevant fields populated. The
// other Review fields are filled with placeholders that the pure tournament
// functions never inspect.
function rev(
  id: string,
  rank_position: number,
  bucket: ReviewBucket = "pilgrimage",
  rating_overall = 8,
): Review {
  return {
    id,
    venue_id: `v-${id}`,
    reviewer_id: "rev-self",
    rating_overall,
    rating_taste: null,
    rating_body: null,
    rating_aroma: null,
    rating_ambience: 5,
    rating_service: 5,
    rating_value: 5,
    bucket,
    rank_position,
    body: "",
    visited_on: "2026-04-01",
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  };
}

// Build a bucket of N reviews at 1000-spaced positions with stable ids.
function makeBucket(n: number, bucket: ReviewBucket = "pilgrimage"): Review[] {
  return Array.from({ length: n }, (_, i) =>
    rev(`r${i}`, (i + 1) * 1000, bucket, 8),
  );
}

// Run a tournament against an oracle that knows the new venue's "true"
// position relative to the existing list and answers comparisons accordingly.
// `truePos` is the index in [0, n] where the new venue should land.
function runWithOracle(
  state: TournamentState,
  truePos: number,
): { state: TournamentState; comparisons: number } {
  let s = state;
  let comparisons = 0;
  while (true) {
    const next = nextComparison(s);
    if (!next) break;
    const mid = Math.floor((s.lo + s.hi) / 2);
    const result: Comparison = truePos <= mid ? "better" : "worse";
    s = recordComparison(s, result);
    comparisons++;
  }
  return { state: s, comparisons };
}

describe("startTournament", () => {
  it("empty bucket converges immediately", () => {
    const s = startTournament([]);
    expect(s.lo).toBe(0);
    expect(s.hi).toBe(0);
    expect(s.bucket).toBeNull();
    expect(nextComparison(s)).toBeNull();
    expect(finalRankPosition(s)).toBe(1000);
  });

  it("sorts candidates by rank_position ascending and reports bucket", () => {
    const out = rev("a", 3000);
    const mid = rev("b", 2000);
    const top = rev("c", 1000);
    const s = startTournament([out, mid, top]);
    expect(s.candidates.map((c) => c.id)).toEqual(["c", "b", "a"]);
    expect(s.bucket).toBe("pilgrimage");
  });
});

describe("single-item bucket", () => {
  const bucket = makeBucket(1);

  it("places above when 'better' (1 comparison)", () => {
    let s = startTournament(bucket);
    const next = nextComparison(s);
    expect(next?.id).toBe("r0");
    s = recordComparison(s, "better");
    expect(nextComparison(s)).toBeNull();
    expect(s.history).toHaveLength(1);
    // Top placement → midpoint of (0, 1000) = 500.
    expect(finalRankPosition(s)).toBe(500);
  });

  it("places below when 'worse' (1 comparison)", () => {
    let s = startTournament(bucket);
    s = recordComparison(s, "worse");
    expect(nextComparison(s)).toBeNull();
    // Bottom placement → 1000 below the only item.
    expect(finalRankPosition(s)).toBe(2000);
  });

  it("places adjacent when 'same' (1 comparison, terminates)", () => {
    let s = startTournament(bucket);
    s = recordComparison(s, "same");
    expect(nextComparison(s)).toBeNull();
    // 'same' places after the equal item → bottom for a 1-item bucket.
    expect(finalRankPosition(s)).toBe(2000);
  });
});

describe("comparison-count bound (≤ ceil(log2(N+1)))", () => {
  for (const n of [3, 7, 15, 50]) {
    it(`uses at most ceil(log2(${n}+1)) comparisons`, () => {
      const bucket = makeBucket(n);
      const limit = Math.ceil(Math.log2(n + 1));
      // Probe every possible insertion position.
      for (let truePos = 0; truePos <= n; truePos++) {
        const { state, comparisons } = runWithOracle(
          startTournament(bucket),
          truePos,
        );
        expect(comparisons).toBeLessThanOrEqual(limit);
        expect(nextComparison(state)).toBeNull();
        expect(state.lo).toBe(truePos);
      }
    });
  }
});

describe("'same' terminates and places at midpoint", () => {
  it("returns midpoint between adjacent neighbours after 'same'", () => {
    // Bucket [r0=1000, r1=2000, r2=3000]. 'same' against the middle (r1)
    // places after r1, so insertion index = 2 → midpoint of (2000, 3000).
    const bucket = makeBucket(3);
    let s = startTournament(bucket);
    // First comparison is the middle of [0..3] → mid = 1 → r1.
    expect(nextComparison(s)?.id).toBe("r1");
    s = recordComparison(s, "same");
    expect(nextComparison(s)).toBeNull();
    expect(finalRankPosition(s)).toBe(2500);
    expect(s.history).toEqual([
      { against_review_id: "r1", result: "same", step_index: 0 },
    ]);
  });
});

describe("50 random insertions are internally consistent", () => {
  // A deterministic comparator: each venue carries a numeric quality. The
  // tournament runs against an oracle that compares qualities, and we check
  // that the resulting list is sorted by quality desc — i.e., no pairwise
  // contradiction is implied by the final ordering.
  it("final ordering is sorted by underlying quality", () => {
    // Seedable LCG so the test is deterministic.
    let seed = 0x12345;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 2 ** 32;
      return seed / 2 ** 32;
    };

    type RankedVenue = { id: string; quality: number; rank_position: number };
    const list: RankedVenue[] = [];

    for (let i = 0; i < 50; i++) {
      const newVenue: RankedVenue = {
        id: `v${i}`,
        quality: rand(),
        rank_position: 0,
      };
      const candidates: Review[] = list.map((v) =>
        rev(v.id, v.rank_position, "pilgrimage", 8),
      );
      // Stable ascending-by-rank ordering — quality must align.
      const qualityById = new Map(list.map((v) => [v.id, v.quality]));

      let s = startTournament(candidates);
      while (true) {
        const next = nextComparison(s);
        if (!next) break;
        const otherQ = qualityById.get(next.id)!;
        // Higher quality = ranks better = lower rank_position.
        const result: Comparison =
          newVenue.quality > otherQ ? "better" : "worse";
        s = recordComparison(s, result);
      }
      newVenue.rank_position = finalRankPosition(s);
      // No collisions expected with random qualities at 50 inserts.
      list.push(newVenue);
    }

    list.sort((a, b) => a.rank_position - b.rank_position);
    // Higher quality should appear first.
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].quality).toBeGreaterThanOrEqual(list[i].quality);
    }
  });
});

describe("compactBucket", () => {
  it("renumbers to evenly-spaced positions and preserves order", () => {
    const reviews: Review[] = [
      rev("a", 1234),
      rev("b", 1000),
      rev("c", 5),
      rev("d", 999_999),
    ];
    const out = compactBucket(reviews);
    expect(out).toEqual([
      { id: "c", new_rank: 1000 },
      { id: "b", new_rank: 2000 },
      { id: "a", new_rank: 3000 },
      { id: "d", new_rank: 4000 },
    ]);
  });

  it("returns an empty array for an empty bucket", () => {
    expect(compactBucket([])).toEqual([]);
  });
});

describe("recordComparison records history monotonically", () => {
  it("history entries are appended with monotonic step_index", () => {
    const bucket = makeBucket(7);
    let s = startTournament(bucket);
    const results: Comparison[] = ["better", "worse", "better"];
    for (const r of results) {
      s = recordComparison(s, r);
    }
    expect(s.history).toHaveLength(3);
    s.history.forEach((h, i) => {
      expect(h.step_index).toBe(i);
      expect(h.result).toBe(results[i]);
    });
  });
});
