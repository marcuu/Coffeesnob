// Pure binary-tournament functions for the pairwise ranking flow.
// No Supabase / DB imports here — collision handling and history persistence
// live in the server actions. See docs/ranking.md for the design.

import type { ComparisonHistory, Review, ReviewBucket } from "@/lib/types";

export type Comparison = "better" | "worse" | "same";

// candidates are the existing reviews in the bucket, sorted by rank_position
// ascending (best first). lo/hi are inclusive/exclusive bounds on the
// insertion index for the new review: it will land at index `lo` once the
// tournament converges (lo === hi).
export type TournamentState = {
  bucket: ReviewBucket | null;
  candidates: Review[];
  lo: number;
  hi: number;
  history: ComparisonHistory;
};

// Start a tournament for a bucket. If the bucket is empty, the tournament
// converges immediately with no comparisons. The bucket field on the state
// is informational; it's null when the bucket is empty.
export function startTournament(bucketReviews: Review[]): TournamentState {
  const candidates = [...bucketReviews].sort(
    (a, b) => a.rank_position - b.rank_position,
  );
  return {
    bucket: candidates.length > 0 ? candidates[0].bucket : null,
    candidates,
    lo: 0,
    hi: candidates.length,
    history: [],
  };
}

// Returns the next review to compare the new venue against, or null when
// the tournament has converged.
export function nextComparison(state: TournamentState): Review | null {
  if (state.lo >= state.hi) return null;
  const mid = Math.floor((state.lo + state.hi) / 2);
  return state.candidates[mid] ?? null;
}

// Pure: returns a new state with the comparison applied.
//   'better' → new venue beats candidates[mid]; insertion index ≤ mid.
//   'worse'  → candidates[mid] beats new venue; insertion index ≥ mid + 1.
//   'same'   → terminate immediately and place adjacent (after the equal).
export function recordComparison(
  state: TournamentState,
  result: Comparison,
): TournamentState {
  if (state.lo >= state.hi) {
    // Already converged; record the comparison but don't mutate bounds.
    return state;
  }
  const mid = Math.floor((state.lo + state.hi) / 2);
  const against = state.candidates[mid];
  const step_index = state.history.length;
  const history: ComparisonHistory = [
    ...state.history,
    { against_review_id: against.id, result, step_index },
  ];

  let lo = state.lo;
  let hi = state.hi;
  if (result === "better") {
    hi = mid;
  } else if (result === "worse") {
    lo = mid + 1;
  } else {
    // 'same' → place just after the equal item and terminate.
    lo = mid + 1;
    hi = mid + 1;
  }
  return { ...state, lo, hi, history };
}

// The integer rank_position the new review should land at. The pure function
// assumes a midpoint exists; if neighbours are adjacent integers the result
// will collide with one of them, and the persistence layer must handle that
// (compactBucket + retry).
export function finalRankPosition(state: TournamentState): number {
  const n = state.candidates.length;
  if (n === 0) return 1000;
  // Insertion index after convergence; lo === hi here.
  const i = state.lo;
  if (i === 0) {
    // Top of the list: place above the current best.
    return Math.floor(state.candidates[0].rank_position / 2);
  }
  if (i >= n) {
    // Bottom of the list: place below the current worst with full spacing.
    return state.candidates[n - 1].rank_position + 1000;
  }
  return Math.floor(
    (state.candidates[i - 1].rank_position +
      state.candidates[i].rank_position) /
      2,
  );
}

// TypeScript mirror of the SQL function compute_rating_overall(bucket, rank,
// size) defined in supabase/migrations/20260427000000_pairwise_ranking.sql.
// Kept here so server actions can pre-compute the value to insert and the
// recompute trigger no-ops on unchanged rows. The SQL definition is the
// source of truth; __tests__/compute-rating-overall.test.ts asserts both
// match.
const BAND_FLOOR: Record<ReviewBucket, number> = {
  pilgrimage: 7,
  detour: 4,
  convenience: 1,
};

export function computeRatingOverall(
  bucket: ReviewBucket,
  rank: number,
  bucketSize: number,
): number {
  if (bucketSize <= 0) {
    throw new Error("bucketSize must be ≥ 1");
  }
  return Math.round(BAND_FLOOR[bucket] + (3 * (bucketSize - rank + 1)) / bucketSize);
}

// Renumber a bucket's reviews to clean 1000-spaced positions, preserving
// the existing order. Used when an insertion collides on the unique
// (reviewer_id, bucket, rank_position) constraint.
export function compactBucket(
  reviews: Review[],
): Array<{ id: string; new_rank: number }> {
  return [...reviews]
    .sort((a, b) => a.rank_position - b.rank_position)
    .map((r, i) => ({ id: r.id, new_rank: (i + 1) * 1000 }));
}
