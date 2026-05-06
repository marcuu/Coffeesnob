import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeRatingOverall,
  compactBucket,
  finalRankPosition,
  recordComparison,
  startTournament,
} from "@/lib/ranking/binary-tournament";
import type { Review } from "@/lib/types";
import { rankedReviewCreateSchema } from "@/lib/validators";

export type PersistRankedReviewResult =
  | {
      status: "ok";
      reviewId: string;
      finalRank: number;
      bucketSize: number;
      list_changed?: boolean;
    }
  | {
      status: "error";
      code: string;
      message: string;
      fieldErrors?: Record<string, string>;
    };

export type PersistRankedReviewOptions = {
  supabase: SupabaseClient;
  reviewerId: string;
  rawInput: unknown;
  synthetic?: boolean;
  createdAt?: string;
};

const RANK_BUCKET_UNIQUE = "reviews_reviewer_bucket_rank_unique";

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /duplicate key value/i.test(error.message ?? "");
}

function replayHistory(
  bucketReviews: Review[],
  history: { against_review_id: string; result: "better" | "worse" | "same" }[],
): { rankPosition: number; listChanged: boolean } {
  if (bucketReviews.length === 0) {
    return { rankPosition: finalRankPosition(startTournament([])), listChanged: false };
  }

  const idSet = new Set(bucketReviews.map((r) => r.id));
  for (const h of history) {
    if (!idSet.has(h.against_review_id)) {
      const lastRank = bucketReviews
        .map((r) => r.rank_position)
        .reduce((a, b) => Math.max(a, b), 0);
      return { rankPosition: lastRank + 1000, listChanged: true };
    }
  }

  let state = startTournament(bucketReviews);
  for (const entry of history) state = recordComparison(state, entry.result);
  return { rankPosition: finalRankPosition(state), listChanged: false };
}

async function validatePopulation(
  supabase: SupabaseClient,
  reviewerId: string,
  venueId: string,
  synthetic: boolean,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const [{ data: reviewer, error: reviewerError }, { data: venue, error: venueError }] =
    await Promise.all([
      supabase
        .from("reviewers")
        .select("is_synthetic")
        .eq("id", reviewerId)
        .maybeSingle(),
      supabase
        .from("venues")
        .select("is_fictional")
        .eq("id", venueId)
        .maybeSingle(),
    ]);

  if (reviewerError) return { ok: false, code: "reviewer_fetch_failed", message: reviewerError.message };
  if (venueError) return { ok: false, code: "venue_fetch_failed", message: venueError.message };
  if (!reviewer) return { ok: false, code: "reviewer_not_found", message: "Reviewer not found" };
  if (!venue) return { ok: false, code: "venue_not_found", message: "Venue not found" };

  const reviewerSynthetic = Boolean((reviewer as { is_synthetic?: boolean }).is_synthetic);
  const venueFictional = Boolean((venue as { is_fictional?: boolean }).is_fictional);

  if (reviewerSynthetic !== synthetic) {
    return { ok: false, code: "synthetic_mismatch", message: "Synthetic reviewer flag mismatch" };
  }
  if (synthetic && !venueFictional) {
    return { ok: false, code: "synthetic_real_venue", message: "Synthetic reviewers can only review Bramford venues" };
  }
  if (!synthetic && venueFictional) {
    return { ok: false, code: "real_fictional_venue", message: "Real reviewers cannot review Bramford venues" };
  }
  return { ok: true };
}

async function attemptInsert(
  supabase: SupabaseClient,
  reviewerId: string,
  parsed: ReturnType<typeof rankedReviewCreateSchema.parse>,
  rankPosition: number,
  bucketSizeAfter: number,
  synthetic: boolean,
  createdAt?: string,
): Promise<
  | { ok: true; reviewId: string }
  | { ok: false; code: string; message: string; isCollision: boolean }
> {
  const ratingOverall = computeRatingOverall(parsed.bucket, 1, bucketSizeAfter);
  const insertRow: Record<string, unknown> = {
    venue_id: parsed.venue_id,
    reviewer_id: reviewerId,
    rating_coffee_5: parsed.rating_coffee_5,
    rating_vibe_5: parsed.rating_vibe_5,
    body: parsed.body ?? "",
    visited_on: parsed.visited_on,
    bucket: parsed.bucket,
    rank_position: rankPosition,
    rating_overall: ratingOverall,
    is_synthetic: synthetic,
  };
  if (createdAt) insertRow.created_at = createdAt;

  const { data, error } = await supabase
    .from("reviews")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      code: error.code ?? "insert_failed",
      message: error.message ?? "review insert failed",
      isCollision: isUniqueViolation(error),
    };
  }
  return { ok: true, reviewId: data!.id as string };
}

export async function persistRankedReview({
  supabase,
  reviewerId,
  rawInput,
  synthetic = false,
  createdAt,
}: PersistRankedReviewOptions): Promise<PersistRankedReviewResult> {
  const parsedResult = rankedReviewCreateSchema.safeParse(rawInput);
  if (!parsedResult.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsedResult.error.issues) {
      const path = issue.path.join(".") || "form";
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      status: "error",
      code: "invalid_input",
      message: parsedResult.error.issues[0]?.message ?? "Invalid input",
      fieldErrors,
    };
  }

  const parsed = parsedResult.data;
  const population = await validatePopulation(supabase, reviewerId, parsed.venue_id, synthetic);
  if (!population.ok) return { status: "error", code: population.code, message: population.message };

  const { data: bucketReviews, error: fetchError } = await supabase
    .from("reviews")
    .select(
      "id, venue_id, reviewer_id, rating_overall, rating_coffee_5, rating_vibe_5, bucket, rank_position, body, visited_on, created_at, updated_at",
    )
    .eq("reviewer_id", reviewerId)
    .eq("bucket", parsed.bucket)
    .order("rank_position", { ascending: true });
  if (fetchError) return { status: "error", code: "fetch_failed", message: fetchError.message };

  const replay = replayHistory((bucketReviews ?? []) as Review[], parsed.history);
  const bucketSizeAfter = (bucketReviews?.length ?? 0) + 1;
  let finalRank = replay.rankPosition;
  let listChanged = replay.listChanged;
  let attempt = await attemptInsert(
    supabase,
    reviewerId,
    parsed,
    finalRank,
    bucketSizeAfter,
    synthetic,
    createdAt,
  );

  if (!attempt.ok && attempt.isCollision && attempt.message.includes(RANK_BUCKET_UNIQUE)) {
    const compacted = compactBucket((bucketReviews ?? []) as Review[]);
    const results = await Promise.all(
      compacted.map((c) =>
        supabase.from("reviews").update({ rank_position: c.new_rank }).eq("id", c.id),
      ),
    );
    const compactErr = results.find((r) => r.error)?.error;
    if (compactErr) return { status: "error", code: "compact_failed", message: compactErr.message };

    const { data: refreshed } = await supabase
      .from("reviews")
      .select(
        "id, venue_id, reviewer_id, rating_overall, rating_coffee_5, rating_vibe_5, bucket, rank_position, body, visited_on, created_at, updated_at",
      )
      .eq("reviewer_id", reviewerId)
      .eq("bucket", parsed.bucket)
      .order("rank_position", { ascending: true });
    const replay2 = replayHistory((refreshed ?? []) as Review[], parsed.history);
    if (replay2.listChanged) listChanged = true;
    finalRank = replay2.rankPosition;
    attempt = await attemptInsert(
      supabase,
      reviewerId,
      parsed,
      finalRank,
      bucketSizeAfter,
      synthetic,
      createdAt,
    );

    if (!attempt.ok && attempt.isCollision) {
      return {
        status: "error",
        code: "rank_collision_after_compact",
        message: "Couldn't save - try again",
      };
    }
  }

  if (!attempt.ok) return { status: "error", code: attempt.code, message: attempt.message };

  if (parsed.history.length > 0) {
    const rows = parsed.history.map((h) => ({
      reviewer_id: reviewerId,
      result: h.result,
      winning_review_id: h.result === "better" ? attempt.reviewId : h.against_review_id,
      losing_review_id: h.result === "better" ? h.against_review_id : attempt.reviewId,
    }));
    const { error: cmpError } = await supabase.from("review_comparisons").insert(rows);
    if (cmpError) console.error("review_comparisons insert failed", cmpError);
  }

  return {
    status: "ok",
    reviewId: attempt.reviewId,
    finalRank,
    bucketSize: bucketSizeAfter,
    list_changed: listChanged || undefined,
  };
}
