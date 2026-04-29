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
  // Simulates a driver that returns a row without rating_overall after an
  // UPDATE — exercises the action's fallback path that recomputes the
  // value from the post-update bucket ordering.
  stripRatingOverallOnReturn: boolean;
  // When true, every UPDATE that touches rank_position is validated
  // against the (reviewer_id, bucket, rank_position) unique constraint
  // and a collision raises a 23505 error — mirroring the real DB.
  enforceRankUnique: boolean;
};

const state: State = {
  user: null,
  reviews: [],
  forceCollisionAttempts: 0,
  comparisonsTouched: 0,
  updateCount: 0,
  stripRatingOverallOnReturn: false,
  enforceRankUnique: false,
};

function resetState() {
  state.user = { id: "user-1" };
  state.reviews = [];
  state.forceCollisionAttempts = 0;
  state.comparisonsTouched = 0;
  state.updateCount = 0;
  state.stripRatingOverallOnReturn = false;
  state.enforceRankUnique = false;
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
    rating_coffee_5: 4,
    rating_vibe_5: 4,
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
  let orderBy: { col: string; ascending: boolean } | null = null;
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
    order(col: string, opts: { ascending: boolean }) {
      orderBy = { col, ascending: opts.ascending };
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
        // Optionally simulate the real (reviewer_id, bucket, rank_position)
        // unique constraint. We snapshot, tentatively apply, validate; if
        // a collision is detected, roll back and return a 23505 error.
        if (state.enforceRankUnique) {
          const snapshot = matches.map((m) => ({ ...m }));
          for (const m of matches) Object.assign(m, pendingUpdate);
          const seen = new Map<string, string>();
          let conflictId: string | null = null;
          for (const r of state.reviews) {
            const key = `${r.reviewer_id}|${r.bucket}|${r.rank_position}`;
            const existing = seen.get(key);
            if (existing && existing !== r.id) {
              conflictId = r.id;
              break;
            }
            seen.set(key, r.id);
          }
          if (conflictId) {
            // Roll back.
            for (let i = 0; i < matches.length; i++) {
              Object.assign(matches[i], snapshot[i]);
            }
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
          // Successful apply — fall through to trigger recompute.
          for (const m of matches) state.updateCount++;
          const touched = new Set<ReviewBucket>(
            snapshot.map((s) => s.bucket as ReviewBucket),
          );
          for (const m of matches) touched.add(m.bucket);
          for (const b of touched) {
            recomputeBucket(state.user?.id ?? "", b);
          }
          pendingUpdate = null;
          const sanitized = state.stripRatingOverallOnReturn
            ? matches.map((m) => {
                const { rating_overall: _ignore, ...rest } = m;
                void _ignore;
                return rest as Review;
              })
            : matches;
          const data = sanitized.length === 1 ? sanitized[0] : sanitized;
          return { data, error: null };
        }
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
        // Return the updated row(s). Optionally strip rating_overall to
        // exercise the action's fallback recompute path.
        const sanitized = state.stripRatingOverallOnReturn
          ? matches.map((m) => {
              const { rating_overall: _ignore, ...rest } = m;
              void _ignore;
              return rest as Review;
            })
          : matches;
        const data = sanitized.length === 1 ? sanitized[0] : sanitized;
        return { data, error: null };
      }

      // Read.
      let rows = state.reviews;
      if (reviewerFilter) rows = rows.filter((r) => r.reviewer_id === reviewerFilter.val);
      if (bucketFilter) rows = rows.filter((r) => r.bucket === bucketFilter.val);
      if (idFilter) rows = rows.filter((r) => r.id === idFilter.val);
      if (orderBy) {
        const col = orderBy.col as keyof Review;
        const dir = orderBy.ascending ? 1 : -1;
        rows = [...rows].sort((a, b) => {
          const av = a[col] as number;
          const bv = b[col] as number;
          return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
        });
      }
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

  it("collision retry preserves placement intent across compactBucket", async () => {
    // The user is moving A into the slot currently held by B. This
    // collides; after compacting we should still place A between B and C
    // (their post-compaction ranks), not append it to the end of the
    // bucket. Regression for the non-blocking observation in the peer
    // review.
    state.reviews = [
      makeReview(ID_A, "user-1", "pilgrimage", 1000),
      makeReview(ID_B, "user-1", "pilgrimage", 1001),
      makeReview(ID_C, "user-1", "pilgrimage", 1002),
    ];
    state.forceCollisionAttempts = 1;

    const result = await reorderReview(ID_A, "pilgrimage", 1001);
    expect(result.status).toBe("ok");

    // After compaction destExcl = [B@1000, C@2000]; A inserted between
    // them at 1500. Final order: B, A, C — A is rank 2 of 3.
    const ordered = state.reviews
      .filter((r) => r.bucket === "pilgrimage")
      .sort((a, b) => a.rank_position - b.rank_position);
    expect(ordered.map((r) => r.id)).toEqual([ID_B, ID_A, ID_C]);
  });

  it("rating_overall fallback uses derived rank, not top-of-bucket", async () => {
    // Regression for the peer-review issue: the fallback path used
    // `computeRatingOverall(bucket, 1, size)` which assigned the top-of-band
    // score regardless of where the review actually landed. Move A from the
    // top of pilgrimage to the bottom and force the fallback path; the
    // resulting rating should reflect the new bottom-of-bucket position,
    // not 10.
    state.reviews = [
      makeReview(ID_A, "user-1", "pilgrimage", 1000, 9),
      makeReview(ID_B, "user-1", "pilgrimage", 2000, 8),
      makeReview(ID_C, "user-1", "pilgrimage", 3000, 7),
    ];
    state.stripRatingOverallOnReturn = true;

    const result = await reorderReview(ID_A, "pilgrimage", 4000);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      // After move, the bucket order is B, C, A. With the bug, A would
      // come back at 10 (rank=1 always). Correct answer: bottom-of-band.
      // pilgrimage band 7..10 with size=3 rank=3:
      //   round(7 + 3 * (3 - 3 + 1) / 3) = round(8) = 8.
      expect(result.newRatingOverall).toBe(8);
    }
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

  it("succeeds under realistic unique-constraint enforcement when ranks are adjacent", async () => {
    // Regression: with the (reviewer_id, bucket, rank_position) constraint
    // checked per statement, the original compaction loop renumbered rows
    // one-by-one and could collide either with the moving review's still-
    // occupied old rank or with a sibling that hadn't been renumbered yet.
    // Drop A onto B's slot when B and C are at adjacent integer ranks —
    // this triggers compaction in the destination — and assert the action
    // completes without hitting a duplicate-key error.
    state.reviews = [
      makeReview(ID_A, "user-1", "pilgrimage", 1000),
      makeReview(ID_B, "user-1", "pilgrimage", 1001),
      makeReview(ID_C, "user-1", "pilgrimage", 1002),
    ];
    state.enforceRankUnique = true;

    const result = await reorderReview(ID_A, "pilgrimage", 1001);
    expect(result.status).toBe("ok");

    const ordered = state.reviews
      .filter((r) => r.bucket === "pilgrimage")
      .sort((a, b) => a.rank_position - b.rank_position);
    expect(ordered.map((r) => r.id)).toEqual([ID_B, ID_A, ID_C]);
    // Every rank is unique within the bucket.
    const ranks = ordered.map((r) => r.rank_position);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it("succeeds under realistic unique-constraint enforcement on cross-bucket drop", async () => {
    // Same regression but for a cross-bucket move into a slot occupied by
    // an existing review.
    state.reviews = [
      makeReview(ID_A, "user-1", "detour", 1000, 5),
      makeReview(ID_B, "user-1", "pilgrimage", 1000, 9),
      makeReview(ID_C, "user-1", "pilgrimage", 1001, 8),
    ];
    state.enforceRankUnique = true;

    const result = await reorderReview(ID_A, "pilgrimage", 1000);
    expect(result.status).toBe("ok");

    const pilgrimage = state.reviews
      .filter((r) => r.bucket === "pilgrimage")
      .sort((a, b) => a.rank_position - b.rank_position);
    expect(pilgrimage.map((r) => r.id)).toContain(ID_A);
    const ranks = pilgrimage.map((r) => r.rank_position);
    expect(new Set(ranks).size).toBe(ranks.length);
  });
});
