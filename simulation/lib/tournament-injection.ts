import type { SupabaseClient } from "@supabase/supabase-js";
import type { Review, ReviewBucket } from "@/lib/types";
import {
  startTournament,
  recordComparison,
  finalRankPosition,
  computeRatingOverall,
  compactBucket,
  type TournamentState,
} from "@/lib/ranking/binary-tournament";

export type SyntheticReviewInsert = {
  reviewerId: string;
  venueId:    string;
  bucket:     ReviewBucket;
  coffee_5:   number;
  vibe_5:     number;
  body:       string;
  visitedOn:  string; // YYYY-MM-DD
  // Normalised [0,1]; higher = better in the reviewer's preference ordering.
  preferenceScore: number;
};

export async function insertSyntheticReview(
  sb: SupabaseClient,
  input: SyntheticReviewInsert,
): Promise<{ reviewId: string; rankPosition: number }> {
  const candidates = await fetchBucket(sb, input.reviewerId, input.bucket);
  const { state, rankPosition } = computeRank(candidates, input.preferenceScore);

  const ratingOverall = computeRatingOverall(input.bucket, 1, candidates.length + 1);
  const payload = buildPayload(input, rankPosition, ratingOverall);

  const { data: inserted, error } = await sb
    .from("reviews")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    if (error.code !== "23505") throw error;

    // Rank collision: compact bucket and retry once.
    const compacted = compactBucket(candidates);
    if (compacted.length > 0) {
      await Promise.all(
        compacted.map((c) =>
          sb.from("reviews").update({ rank_position: c.new_rank }).eq("id", c.id),
        ),
      );
    }
    const refreshed = await fetchBucket(sb, input.reviewerId, input.bucket);
    const { rankPosition: rank2 } = computeRank(refreshed, input.preferenceScore);
    const { data: retried, error: retryErr } = await sb
      .from("reviews")
      .insert(buildPayload(input, rank2, ratingOverall))
      .select("id")
      .single();
    if (retryErr) throw retryErr;
    await insertComparisons(sb, retried!.id, input.reviewerId, state, candidates);
    return { reviewId: retried!.id, rankPosition: rank2 };
  }

  await insertComparisons(sb, inserted!.id, input.reviewerId, state, candidates);
  return { reviewId: inserted!.id, rankPosition };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type ReviewRow = {
  id: string;
  venue_id: string;
  reviewer_id: string;
  rating_overall: number;
  rating_coffee_5: number;
  rating_vibe_5: number;
  bucket: ReviewBucket;
  rank_position: number;
  body: string;
  visited_on: string;
  created_at: string;
  updated_at: string;
};

async function fetchBucket(
  sb: SupabaseClient,
  reviewerId: string,
  bucket: ReviewBucket,
): Promise<Review[]> {
  const { data, error } = await sb
    .from("reviews")
    .select(
      "id, venue_id, reviewer_id, rating_overall, rating_coffee_5, rating_vibe_5, bucket, rank_position, body, visited_on, created_at, updated_at",
    )
    .eq("reviewer_id", reviewerId)
    .eq("bucket", bucket)
    .order("rank_position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Review[];
}

// Simulates the binary tournament deterministically using preferenceScore.
// Existing reviews are ordered by rank_position (ascending = best). The new
// review's normalised preference [0,1] is compared against each midpoint
// candidate: higher preference beats reviews with lower (worse) rank positions.
function computeRank(
  candidates: Review[],
  preferenceScore: number,
): { state: TournamentState; rankPosition: number } {
  const maxPos = candidates.reduce((m, c) => Math.max(m, c.rank_position), 0);

  let state = startTournament(candidates);
  while (state.lo < state.hi) {
    const mid = Math.floor((state.lo + state.hi) / 2);
    const against = state.candidates[mid];
    // Normalise existing rank to [0,1]: lower rank_position = better = 1.
    const againstNorm =
      maxPos > 0 ? 1 - against.rank_position / maxPos : 0.5;
    const result =
      preferenceScore > againstNorm + 0.05
        ? "better"
        : preferenceScore < againstNorm - 0.05
          ? "worse"
          : "same";
    state = recordComparison(state, result);
  }

  return { state, rankPosition: finalRankPosition(state) };
}

function buildPayload(
  input: SyntheticReviewInsert,
  rankPosition: number,
  ratingOverall: number,
) {
  return {
    venue_id:       input.venueId,
    reviewer_id:    input.reviewerId,
    rating_coffee_5: input.coffee_5,
    rating_vibe_5:  input.vibe_5,
    rating_overall: ratingOverall,
    body:           input.body,
    visited_on:     input.visitedOn,
    bucket:         input.bucket,
    rank_position:  rankPosition,
    is_synthetic:   true,
  };
}

async function insertComparisons(
  sb: SupabaseClient,
  newReviewId: string,
  reviewerId: string,
  state: TournamentState,
  _candidates: Review[],
): Promise<void> {
  if (state.history.length === 0) return;
  const rows = state.history.map((h) => ({
    reviewer_id: reviewerId,
    result: h.result,
    winning_review_id: h.result === "better" ? newReviewId : h.against_review_id,
    losing_review_id: h.result === "better" ? h.against_review_id : newReviewId,
  }));
  const { error } = await sb.from("review_comparisons").insert(rows);
  if (error) console.error("review_comparisons insert failed", error);
}
