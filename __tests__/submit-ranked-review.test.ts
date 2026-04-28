// Tests for the submitRankedReview server action. We mock the Supabase
// server client so the action's collision-retry, replay validation and
// missing-review fallback paths are exercised without a live database.

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Review, ReviewBucket } from "@/lib/types";

// ----- Supabase mock plumbing ---------------------------------------------

type ReviewRow = Review;

type State = {
  user: { id: string } | null;
  reviewsByBucket: Record<ReviewBucket, ReviewRow[]>;
  comparisonsInserted: Array<Record<string, unknown>>;
  forceCollisionAttempts: number; // number of times the next insert(s) collide
  insertAttempts: number;
  updateCount: number;
};

const state: State = {
  user: null,
  reviewsByBucket: { pilgrimage: [], detour: [], convenience: [] },
  comparisonsInserted: [],
  forceCollisionAttempts: 0,
  insertAttempts: 0,
  updateCount: 0,
};

function resetState() {
  state.user = { id: "user-1" };
  state.reviewsByBucket = { pilgrimage: [], detour: [], convenience: [] };
  state.comparisonsInserted = [];
  state.forceCollisionAttempts = 0;
  state.insertAttempts = 0;
  state.updateCount = 0;
}

function makeReview(
  id: string,
  bucket: ReviewBucket,
  rank: number,
  ratingOverall = 8,
): ReviewRow {
  return {
    id,
    venue_id: `venue-${id}`,
    reviewer_id: "user-1",
    rating_overall: ratingOverall,
    rating_taste: 7,
    rating_body: 7,
    rating_aroma: 7,
    rating_ambience: 7,
    rating_service: 7,
    rating_value: 7,
    bucket,
    rank_position: rank,
    body: "ok",
    visited_on: "2026-04-01",
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  };
}

// Stable review-id fixtures (must satisfy z.string().uuid() in the schema).
const ID_A = "00000000-0000-4000-8000-000000000001";
const ID_B = "00000000-0000-4000-8000-000000000002";
const ID_C = "00000000-0000-4000-8000-000000000003";
const GHOST = "00000000-0000-4000-8000-0000000000ff";

// The Supabase chainable builder is dynamic enough that mirroring its types
// for the mock buys nothing — `any` is the pragmatic choice for a fake.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeReviewsBuilder(table: string): any {
  // Capture filters set via .eq()/.in()/.order().
  const filters: { col: string; val: unknown }[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    select(_cols?: string) {
      return builder;
    },
    eq(col: string, val: unknown) {
      filters.push({ col, val });
      return builder;
    },
    in(col: string, vals: unknown[]) {
      filters.push({ col, val: vals });
      return builder;
    },
    order(_col: string, _opts: { ascending: boolean }) {
      return builder;
    },
    insert(values: unknown) {
      // capture values; resolution depends on table
      if (table === "reviews") {
        state.insertAttempts++;
        const v = values as ReviewRow & { rating_overall: number };
        if (state.forceCollisionAttempts > 0) {
          state.forceCollisionAttempts--;
          // Attach a select.single chain that resolves to a unique-violation.
          return {
            ...builder,
            select: () => ({
              single: async () => ({
                data: null,
                error: {
                  code: "23505",
                  message:
                    'duplicate key value violates unique constraint "reviews_reviewer_bucket_rank_unique"',
                },
              }),
            }),
          };
        }
        const inserted: ReviewRow = {
          ...v,
          id: `new-${state.insertAttempts}`,
        };
        state.reviewsByBucket[v.bucket].push(inserted);
        return {
          ...builder,
          select: () => ({
            single: async () => ({ data: { id: inserted.id }, error: null }),
          }),
        };
      }
      if (table === "review_comparisons") {
        const rows = Array.isArray(values) ? values : [values];
        for (const r of rows) state.comparisonsInserted.push(r as Record<string, unknown>);
        return {
          ...builder,
          // immediate await resolution:
          then: (
            resolve: (v: { data: null; error: null }) => unknown,
          ) => resolve({ data: null, error: null }),
        };
      }
      throw new Error(`unhandled insert for table ${table}`);
    },
    update(values: Record<string, unknown>) {
      state.updateCount++;
      // We model update().eq("id", x) by patching the matching review.
      Object.assign(builder, {
        then(resolve: (v: { data: null; error: null }) => unknown) {
          // Apply update once a filter on id is present.
          const idFilter = filters.find((f) => f.col === "id");
          if (idFilter) {
            for (const bucket of Object.keys(
              state.reviewsByBucket,
            ) as ReviewBucket[]) {
              const list = state.reviewsByBucket[bucket];
              for (const row of list) {
                if (row.id === idFilter.val) {
                  Object.assign(row, values);
                }
              }
            }
          }
          return resolve({ data: null, error: null });
        },
      });
      return builder;
    },
    delete() {
      return builder;
    },
    then(resolve: (v: { data: unknown; error: null }) => unknown) {
      // Resolves a select chain. Filter logic below for the reviews table.
      if (table === "reviews") {
        const reviewerFilter = filters.find((f) => f.col === "reviewer_id");
        const bucketFilter = filters.find((f) => f.col === "bucket");
        if (reviewerFilter && bucketFilter) {
          const data = state.reviewsByBucket[bucketFilter.val as ReviewBucket];
          return resolve({ data, error: null });
        }
        if (reviewerFilter) {
          const data = (
            ["pilgrimage", "detour", "convenience"] as ReviewBucket[]
          ).flatMap((b) => state.reviewsByBucket[b]);
          return resolve({ data, error: null });
        }
        return resolve({ data: [], error: null });
      }
      return resolve({ data: [], error: null });
    },
    maybeSingle() {
      return Promise.resolve({ data: null, error: null });
    },
  };
  return builder;
}

vi.mock("@/utils/supabase/server", () => {
  return {
    createClient: vi.fn(async () => ({
      auth: {
        getUser: async () => ({ data: { user: state.user }, error: null }),
      },
      from: (table: string) => makeReviewsBuilder(table),
    })),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

// ----- Imports under test --------------------------------------------------

import { submitRankedReview } from "@/app/venues/[slug]/review/actions";

// ----- Tests ---------------------------------------------------------------

describe("submitRankedReview", () => {
  beforeEach(() => {
    resetState();
  });

  const baseInput = {
    venue_id: "11111111-1111-4111-8111-111111111111",
    visited_on: "2026-04-20",
    bucket: "pilgrimage" as const,
    rank_position: 1500,
    history: [] as Array<{
      against_review_id: string;
      result: "better" | "worse" | "same";
      step_index: number;
    }>,
    rating_taste: 8,
    rating_body: 7,
    rating_aroma: 9,
    rating_ambience: 7,
    rating_service: 8,
    rating_value: 7,
    body: "Solid filter, clean cup, good service.",
  };

  it("rejects unauthenticated calls", async () => {
    state.user = null;
    const result = await submitRankedReview(baseInput);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe("unauthenticated");
    }
  });

  it("rejects input missing one of the six axes", async () => {
    const { rating_body: _omit, ...partial } = baseInput;
    void _omit;
    const result = await submitRankedReview(partial);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe("invalid_input");
      expect(result.fieldErrors).toBeDefined();
      expect(Object.keys(result.fieldErrors!)).toContain("rating_body");
    }
  });

  it("inserts an empty-bucket review at rank 1000 ignoring client claim", async () => {
    const result = await submitRankedReview({
      ...baseInput,
      rank_position: 999_999, // client lies
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.finalRank).toBe(1000);
      expect(state.reviewsByBucket.pilgrimage[0]?.rank_position).toBe(1000);
    }
  });

  it("replays history correctly and overrides client-supplied rank_position", async () => {
    // Bucket: A=1000, B=2000, C=3000. Client says 'better' against B (mid),
    // then 'better' against A → new venue is best → insertion index 0,
    // rank_position = floor(1000 / 2) = 500.
    state.reviewsByBucket.pilgrimage = [
      makeReview(ID_A, "pilgrimage", 1000, 9),
      makeReview(ID_B, "pilgrimage", 2000, 8),
      makeReview(ID_C, "pilgrimage", 3000, 7),
    ];
    const result = await submitRankedReview({
      ...baseInput,
      rank_position: 99_999_999, // client lies, server replays.
      history: [
        { against_review_id: ID_B, result: "better", step_index: 0 },
        { against_review_id: ID_A, result: "better", step_index: 1 },
      ],
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      // Last inserted review should land at rank 500.
      const inserted = state.reviewsByBucket.pilgrimage.find(
        (r) => r.id === result.reviewId,
      );
      expect(inserted?.rank_position).toBe(500);
      expect(result.list_changed).toBeUndefined();
    }
  });

  it("missing against_review_id triggers list_changed fallback", async () => {
    state.reviewsByBucket.pilgrimage = [
      makeReview(ID_A, "pilgrimage", 1000, 9),
      makeReview(ID_B, "pilgrimage", 2000, 8),
    ];
    const result = await submitRankedReview({
      ...baseInput,
      history: [
        // GHOST id never existed — should fallback to end-of-bucket.
        { against_review_id: GHOST, result: "worse", step_index: 0 },
      ],
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.list_changed).toBe(true);
      const inserted = state.reviewsByBucket.pilgrimage.find(
        (r) => r.id === result.reviewId,
      );
      // End-of-bucket placement: max rank + 1000 = 3000.
      expect(inserted?.rank_position).toBe(3000);
    }
  });

  it("writes review and one comparison row per history entry", async () => {
    state.reviewsByBucket.pilgrimage = [
      makeReview(ID_A, "pilgrimage", 1000, 9),
      makeReview(ID_B, "pilgrimage", 2000, 8),
      makeReview(ID_C, "pilgrimage", 3000, 7),
    ];
    const result = await submitRankedReview({
      ...baseInput,
      history: [
        { against_review_id: ID_B, result: "worse", step_index: 0 },
        { against_review_id: ID_C, result: "better", step_index: 1 },
      ],
    });
    expect(result.status).toBe("ok");
    expect(state.comparisonsInserted).toHaveLength(2);
    expect(state.comparisonsInserted.every((c) => c.reviewer_id === "user-1")).toBe(true);
    // The 'better' row should have the new review as the winner.
    const better = state.comparisonsInserted.find((c) => c.result === "better");
    expect(better?.winning_review_id).toBeDefined();
    expect(better?.losing_review_id).toBe(ID_C);
  });

  it("on a unique-constraint collision, runs compactBucket and retries once", async () => {
    state.reviewsByBucket.pilgrimage = [
      makeReview(ID_A, "pilgrimage", 1000, 9),
      makeReview(ID_B, "pilgrimage", 1001, 8), // tight neighbours
    ];
    state.forceCollisionAttempts = 1; // first insert collides; second succeeds.

    const result = await submitRankedReview({
      ...baseInput,
      history: [
        { against_review_id: ID_A, result: "worse", step_index: 0 },
        { against_review_id: ID_B, result: "better", step_index: 1 },
      ],
    });
    expect(result.status).toBe("ok");
    expect(state.insertAttempts).toBe(2); // initial + retry
    expect(state.updateCount).toBeGreaterThan(0); // compactBucket ran
  });

  it("returns rank_collision_after_compact when retry also collides", async () => {
    state.reviewsByBucket.pilgrimage = [
      makeReview(ID_A, "pilgrimage", 1000, 9),
    ];
    state.forceCollisionAttempts = 2; // both attempts collide.

    const result = await submitRankedReview({
      ...baseInput,
      history: [{ against_review_id: ID_A, result: "worse", step_index: 0 }],
    });
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe("rank_collision_after_compact");
    }
  });
});
