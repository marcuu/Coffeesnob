"use server";

import { revalidatePath } from "next/cache";

import {
  computeRatingOverall,
  compactBucket,
  finalRankPosition,
  recordComparison,
  startTournament,
} from "@/lib/ranking/binary-tournament";
import type { Review } from "@/lib/types";
import { rankedReviewCreateSchema } from "@/lib/validators";
import { createClient } from "@/utils/supabase/server";

export type SubmitRankedReviewResult =
  | { status: "ok"; reviewId: string; finalRank: number; bucketSize: number; list_changed?: boolean }
  | { status: "error"; code: string; message: string; fieldErrors?: Record<string, string> };

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

const RANK_BUCKET_UNIQUE = "reviews_reviewer_bucket_rank_unique";

// Postgres unique-constraint violation code.
function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /duplicate key value/i.test(error.message ?? "");
}

// Replays the comparison history server-side against the current bucket.
// Returns the rank_position the new review should occupy and whether any
// historic against_review_id is missing from the bucket (list_changed).
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
      // Drop to "insert at the end" fallback.
      const lastRank = bucketReviews
        .map((r) => r.rank_position)
        .reduce((a, b) => Math.max(a, b), 0);
      return { rankPosition: lastRank + 1000, listChanged: true };
    }
  }

  let state = startTournament(bucketReviews);
  for (const entry of history) {
    state = recordComparison(state, entry.result);
  }
  // If the history was incomplete and the tournament hasn't converged, place
  // the review at the current lo (top of the unresolved range) — better than
  // refusing the submit.
  return { rankPosition: finalRankPosition(state), listChanged: false };
}

// Writes the review + comparison rows. Returns the inserted review id and
// rank_position on success. Caller wraps with collision-retry logic.
async function attemptInsert(
  supabase: SupabaseLike,
  userId: string,
  parsed: ReturnType<typeof rankedReviewCreateSchema.parse>,
  rankPosition: number,
  bucketSizeAfter: number,
): Promise<
  | { ok: true; reviewId: string }
  | { ok: false; code: string; message: string; isCollision: boolean }
> {
  const ratingOverall = computeRatingOverall(
    parsed.bucket,
    1, // best rank within the new bucket as a sentinel; trigger overwrites.
    bucketSizeAfter,
  );

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      venue_id: parsed.venue_id,
      reviewer_id: userId,
      rating_taste: parsed.rating_taste,
      rating_body: parsed.rating_body,
      rating_aroma: parsed.rating_aroma,
      rating_ambience: parsed.rating_ambience,
      rating_service: parsed.rating_service,
      rating_value: parsed.rating_value,
      body: parsed.body,
      visited_on: parsed.visited_on,
      bucket: parsed.bucket,
      rank_position: rankPosition,
      // Placeholder; the recompute trigger will overwrite with the correct
      // band-relative value once it sees the new bucket size.
      rating_overall: ratingOverall,
    })
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
  return { ok: true, reviewId: data!.id };
}

export async function submitRankedReview(
  rawInput: unknown,
  options: { slug?: string } = {},
): Promise<SubmitRankedReviewResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", code: "unauthenticated", message: "Not authenticated" };
  }

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

  // Re-fetch the current bucket. If the user concurrently mutated their
  // list during the tournament, we'll see the up-to-date state here.
  const { data: bucketReviews, error: fetchError } = await supabase
    .from("reviews")
    .select(
      "id, venue_id, reviewer_id, rating_overall, rating_taste, rating_body, rating_aroma, rating_ambience, rating_service, rating_value, bucket, rank_position, body, visited_on, created_at, updated_at",
    )
    .eq("reviewer_id", user.id)
    .eq("bucket", parsed.bucket)
    .order("rank_position", { ascending: true });
  if (fetchError) {
    return { status: "error", code: "fetch_failed", message: fetchError.message };
  }

  const replay = replayHistory(
    (bucketReviews ?? []) as Review[],
    parsed.history,
  );
  // Server replay is authoritative — overrides the client's rankPosition.
  const rankPosition = replay.rankPosition;
  const bucketSizeAfter = (bucketReviews?.length ?? 0) + 1;

  // First insert attempt.
  let attempt = await attemptInsert(supabase, user.id, parsed, rankPosition, bucketSizeAfter);
  let listChanged = replay.listChanged;
  let finalRank = rankPosition;

  // Collision: compact the bucket and retry once.
  if (!attempt.ok && attempt.isCollision && attempt.message.includes(RANK_BUCKET_UNIQUE)) {
    const compacted = compactBucket((bucketReviews ?? []) as Review[]);
    if (compacted.length > 0) {
      // Apply the compacted positions. Rely on the deferrable unique
      // constraint to allow the swap within a single statement.
      const updates = compacted.map((c) =>
        supabase
          .from("reviews")
          .update({ rank_position: c.new_rank })
          .eq("id", c.id),
      );
      const results = await Promise.all(updates);
      const compactErr = results.find((r) => r.error)?.error;
      if (compactErr) {
        return {
          status: "error",
          code: "compact_failed",
          message: compactErr.message,
        };
      }
    }

    // Recompute insertion position against the freshly-compacted bucket.
    const { data: refreshed } = await supabase
      .from("reviews")
      .select(
        "id, venue_id, reviewer_id, rating_overall, rating_taste, rating_body, rating_aroma, rating_ambience, rating_service, rating_value, bucket, rank_position, body, visited_on, created_at, updated_at",
      )
      .eq("reviewer_id", user.id)
      .eq("bucket", parsed.bucket)
      .order("rank_position", { ascending: true });
    const replay2 = replayHistory(
      (refreshed ?? []) as Review[],
      parsed.history,
    );
    if (replay2.listChanged) listChanged = true;
    finalRank = replay2.rankPosition;
    attempt = await attemptInsert(supabase, user.id, parsed, finalRank, bucketSizeAfter);

    if (!attempt.ok && attempt.isCollision) {
      // Telemetry hook lands in Phase 4; for now log to stderr.
      console.error("rank_collision_after_compact", {
        bucket: parsed.bucket,
        reviewer_id: user.id,
      });
      return {
        status: "error",
        code: "rank_collision_after_compact",
        message: "Couldn't save — try again",
      };
    }
  }

  if (!attempt.ok) {
    return { status: "error", code: attempt.code, message: attempt.message };
  }

  // Append-only comparison rows. We tolerate a partial failure here: the
  // review itself is committed even if comparisons fail to write, since
  // historical signal is recoverable by re-asking the user later but the
  // primary review record is not.
  if (parsed.history.length > 0) {
    const rows = parsed.history.map((h) => ({
      reviewer_id: user.id,
      result: h.result,
      // The new review is the "winner" when the user said it was better,
      // and the "loser" when they said it was worse. 'same' goes in losing
      // by convention — preserves the link without implying ordering.
      winning_review_id:
        h.result === "better" ? attempt.reviewId : h.against_review_id,
      losing_review_id:
        h.result === "better" ? h.against_review_id : attempt.reviewId,
    }));
    const { error: cmpError } = await supabase
      .from("review_comparisons")
      .insert(rows);
    if (cmpError) {
      console.error("review_comparisons insert failed", cmpError);
    }
  }

  if (options.slug) {
    revalidatePath(`/venues/${options.slug}`);
  }
  revalidatePath("/venues");
  revalidatePath("/list");

  return {
    status: "ok",
    reviewId: attempt.reviewId,
    finalRank,
    bucketSize: bucketSizeAfter,
    list_changed: listChanged || undefined,
  };
}
