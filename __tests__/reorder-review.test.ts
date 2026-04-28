// Tests for the reorderReview server action. Mocks Supabase and asserts:
//   - within-bucket reorder updates rank_position and rating_overall.
//   - cross-bucket reorder updates both buckets via the trigger (in our
//     mock, we model the trigger by recomputing rating_overall on read).
//   - ownership check rejects reorders by other users.
//   - collisions trigger compactBucket and a single retry.
//   - no rows are written to or modified in review_comparisons during reorder.

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Review, ReviewBucket } from "@/lib/types";

type State = {
  user: { id: string } | null;
  reviews: Review[];
  forceCollisionAttempts: number;
  comparisonsTouched: number;
  updateCount: number;
};

const state: State = {
  user: null,
  reviews: [],
  forceCollisionAttempts: 0,
  comparisonsTouched: 0,
  updateCount: 0,
};

function resetState() {
  state.user = { id: "user-1" };
  state.reviews = [];
  state.forceCollisionAttempts = 0;
  state.comparisonsTouched = 0;
  state.updateCount = 0;
}

const ID_A = "00000000-0000-4000-8000-000000000001";
const ID_B = "00000000-0000-4000-8000-000000000002";
const ID_C = "00000000-0000-4000-8000-000000000003";

function makeReview(
  id: string,
  ownerId: string,
  bucket: ReviewBucket,
  rank: number,
  rating = 8,
): Review {
  return {
    id,
    venue_id: `venue-${id}`,
    reviewer_id: ownerId,
    rating_overall: rating,
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

function findById(id: string): Review | undefined {
  return state.reviews.find((r) => r.id === id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeBuilder(table: string): any {
  const filters: { col: string; val: unknown }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pendingUpdate: Record<string, unknown> | null = null;
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
    update(values: Record<string, unknown>) {
      pendingUpdate = values;
      return builder;
    },
    delete() {
      return builder;
    },
    insert(_values: unknown) {
      if (table === "review_comparisons") state.comparisonsTouched++;
      return {
        ...builder,
        then: (resolve: (v: { data: null; error: null }) => unknown) =>
          resolve({ data: null, error: null }),
        select() {
          return builder;
        },
      };
    },
    single() {
      // Used after .update().select().single().
      return runFinal(true);
    },
    maybeSingle() {
      return runFinal(true);
    },
    then(resolve: (v: { data: unknown; error: unknown }) => unknown) {
      return resolve(runFinalSync());
    },
  };

  function runFinalSync(): { data: unknown; error: unknown } {
    if (table === "reviews") {
      const reviewerFilter = filters.find((f) => f.col === "reviewer_id");
      const idFilter = filters.find((f) => f.col === "id");
      const bucketFilter = filters.find((f) => f.col === "bucket");
      // Apply pending update.
      if (pendingUpdate) {
        if (state.forceCollisionAttempts > 0 && pendingUpdate.bucket) {
          state.forceCollisionAttempts--;
          pendingUpdate = null;
          return {
            data: null,
            error: {
              code: "23505",
              message:
                'duplicate key value violates unique constraint "reviews_reviewer_bucket_rank_unique"',
            },
          };
        }
        const matches = state.reviews.filter((r) => {
          if (idFilter && r.id !== idFilter.val) return false;
          if (reviewerFilter && r.reviewer_id !== reviewerFilter.val) return false;
          return true;
        });
        // Mock the trigger: track the OLD bucket before applying the update
        // so a cross-bucket move recomputes both buckets, mirroring the
        // SQL trigger's behaviour.
        const touched = new Set<ReviewBucket>();
        for (const m of matches) {
          touched.add(m.bucket);
          state.updateCount++;
          Object.assign(m, pendingUpdate);
          touched.add(m.bucket);
        }
        for (const b of touched) {
          recomputeBucket(state.user?.id ?? "", b);
        }
        pendingUpdate = null;
        // Return the updated row(s).
        const data = matches.length === 1 ? matches[0] : matches;
        return { data, error: null };
      }

      // Read.
      let rows = state.reviews;
      if (reviewerFilter) rows = rows.filter((r) => r.reviewer_id === reviewerFilter.val);
      if (bucketFilter) rows = rows.filter((r) => r.bucket === bucketFilter.val);
      if (idFilter) rows = rows.filter((r) => r.id === idFilter.val);
      return { data: rows, error: null };
    }
    return { data: null, error: null };
  }

  async function runFinal(_singleish: boolean) {
    const result = runFinalSync();
    // For .single() / .maybeSingle() return the row directly when one row.
    if (result.data && Array.isArray(result.data)) {
      return {
        data: (result.data as unknown[])[0] ?? null,
        error: result.error,
      };
    }
    return result;
  }

  return builder;
}

function recomputeBucket(reviewerId: string, bucket: ReviewBucket) {
  // Mirror the SQL function in TS for the mock so tests can assert on the
  // updated rating_overall.
  const list = state.reviews
    .filter((r) => r.reviewer_id === reviewerId && r.bucket === bucket)
    .sort((a, b) => a.rank_position - b.rank_position);
  const size = list.length;
  if (size === 0) return;
  const FLOOR: Record<ReviewBucket, number> = {
    pilgrimage: 7,
    detour: 4,
    convenience: 1,
  };
  list.forEach((r, i) => {
    const rank = i + 1;
    r.rating_overall = Math.round(FLOOR[bucket] + (3 * (size - rank + 1)) / size);
  });
}

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
    },
    from: (table: string) => makeBuilder(table),
  })),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { reorderReview } from "@/app/list/actions";

describe("reorderReview", () => {
  beforeEach(() => {
    resetState();
  });

  it("rejects unauthenticated callers", async () => {
    state.user = null;
    state.reviews = [makeReview(ID_A, "user-1", "pilgrimage", 1000)];
    const result = await reorderReview(ID_A, "pilgrimage", 1500);
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.code).toBe("unauthenticated");
  });

  it("rejects reorders by users who don't own the review", async () => {
    state.user = { id: "intruder" };
    state.reviews = [makeReview(ID_A, "owner", "pilgrimage", 1000)];
    const result = await reorderReview(ID_A, "pilgrimage", 1500);
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.code).toBe("forbidden");
  });

  it("within-bucket reorder updates rank_position and rating_overall", async () => {
    state.reviews = [
      makeReview(ID_A, "user-1", "pilgrimage", 1000),
      makeReview(ID_B, "user-1", "pilgrimage", 2000),
      makeReview(ID_C, "user-1", "pilgrimage", 3000),
    ];
    // Move A from rank 1000 to rank 2500 (between B and C).
    const result = await reorderReview(ID_A, "pilgrimage", 2500);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.bucket).toBe("pilgrimage");
      expect(result.newRankPosition).toBe(2500);
      expect(result.newRatingOverall).toBeGreaterThanOrEqual(7);
      expect(result.newRatingOverall).toBeLessThanOrEqual(10);
    }

    // Bucket order is now B(2000), A(2500), C(3000). With rating_overall
    // recomputed, top item gets the highest score.
    const updated = state.reviews
      .filter((r) => r.bucket === "pilgrimage")
      .sort((a, b) => a.rank_position - b.rank_position);
    expect(updated.map((r) => r.id)).toEqual([ID_B, ID_A, ID_C]);
    expect(updated[0].rating_overall).toBeGreaterThanOrEqual(updated[2].rating_overall);

    expect(state.comparisonsTouched).toBe(0);
  });

  it("cross-bucket reorder recomputes both old and new bucket rating_overall", async () => {
    state.reviews = [
      makeReview(ID_A, "user-1", "pilgrimage", 1000, 9),
      makeReview(ID_B, "user-1", "pilgrimage", 2000, 8),
      makeReview(ID_C, "user-1", "detour", 1000, 6),
    ];
    // Move A from pilgrimage to detour, slot above C.
    const result = await reorderReview(ID_A, "detour", 500);
    expect(result.status).toBe("ok");

    // Old bucket (pilgrimage) now has only B; recomputed → 10 (top of band).
    const oldB = findById(ID_B)!;
    expect(oldB.bucket).toBe("pilgrimage");
    expect(oldB.rating_overall).toBe(10);

    // New bucket (detour) now has A then C; both within 4..7 band.
    const newA = findById(ID_A)!;
    expect(newA.bucket).toBe("detour");
    expect(newA.rating_overall).toBeGreaterThanOrEqual(4);
    expect(newA.rating_overall).toBeLessThanOrEqual(7);

    expect(state.comparisonsTouched).toBe(0);
  });

  it("on collision, runs compactBucket and retries once", async () => {
    state.reviews = [
      makeReview(ID_A, "user-1", "pilgrimage", 1000),
      makeReview(ID_B, "user-1", "pilgrimage", 1001),
    ];
    state.forceCollisionAttempts = 1;
    const result = await reorderReview(ID_A, "pilgrimage", 1001);
    expect(result.status).toBe("ok");
    expect(state.updateCount).toBeGreaterThanOrEqual(2); // compaction + retry
  });

  it("returns rank_collision_after_compact when retry also collides", async () => {
    state.reviews = [
      makeReview(ID_A, "user-1", "pilgrimage", 1000),
      makeReview(ID_B, "user-1", "pilgrimage", 1001),
    ];
    state.forceCollisionAttempts = 2;
    const result = await reorderReview(ID_A, "pilgrimage", 1001);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe("rank_collision_after_compact");
    }
  });
});
