"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { compactBucket, computeRatingOverall } from "@/lib/ranking/binary-tournament";
import type { Review } from "@/lib/types";
import { REVIEW_BUCKETS } from "@/lib/validators";
import { createClient } from "@/utils/supabase/server";

export type ReorderReviewResult =
  | {
      status: "ok";
      reviewId: string;
      bucket: (typeof REVIEW_BUCKETS)[number];
      newRankPosition: number;
      newRatingOverall: number;
    }
  | { status: "error"; code: string; message: string };

const reorderInputSchema = z.object({
  reviewId: z.string().uuid(),
  newBucket: z.enum(REVIEW_BUCKETS),
  newRankPosition: z.number().int(),
});

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /duplicate key value/i.test(error.message ?? "");
}

async function fetchBucket(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  reviewerId: string,
  bucket: (typeof REVIEW_BUCKETS)[number],
): Promise<Review[]> {
  const { data, error } = await supabase
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

export async function reorderReview(
  reviewId: string,
  newBucket: (typeof REVIEW_BUCKETS)[number],
  newRankPosition: number,
): Promise<ReorderReviewResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", code: "unauthenticated", message: "Not authenticated" };
  }

  const parsed = reorderInputSchema.safeParse({ reviewId, newBucket, newRankPosition });
  if (!parsed.success) {
    return {
      status: "error",
      code: "invalid_input",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  // Ownership check.
  const { data: existing, error: fetchError } = await supabase
    .from("reviews")
    .select(
      "id, venue_id, reviewer_id, rating_overall, rating_coffee_5, rating_vibe_5, bucket, rank_position, body, visited_on, created_at, updated_at",
    )
    .eq("id", reviewId)
    .maybeSingle();
  if (fetchError) {
    return { status: "error", code: "fetch_failed", message: fetchError.message };
  }
  if (!existing) {
    return { status: "error", code: "not_found", message: "Review not found" };
  }
  if ((existing as Review).reviewer_id !== user.id) {
    return { status: "error", code: "forbidden", message: "Not your review" };
  }

  // Apply the update. The recompute trigger on reviews recomputes
  // rating_overall for both OLD.bucket and NEW.bucket when bucket changes.
  // We retry once with compactBucket on collision.
  const tryUpdate = async (rank: number) => {
    return await supabase
      .from("reviews")
      .update({ bucket: newBucket, rank_position: rank })
      .eq("id", reviewId)
      .eq("reviewer_id", user.id)
      .select(
        "id, bucket, rank_position, rating_overall",
      )
      .single();
  };

  let { data: updated, error: updateError } = await tryUpdate(newRankPosition);
  let appliedRank = newRankPosition;

  if (updateError && isUniqueViolation(updateError)) {
    // Compact the destination bucket excluding this review, then retry at
    // the post-compaction midpoint between the same neighbours the user
    // originally targeted. We have to figure out where in the destination
    // ordering the moving review was meant to land *before* compacting,
    // because compaction renumbers everything.
    const dest = await fetchBucket(supabase, user.id, newBucket);
    const destExcl = dest.filter((r) => r.id !== reviewId);
    // Insertion index in destExcl that newRankPosition was meant to fill.
    const firstAfter = destExcl.findIndex(
      (r) => r.rank_position > newRankPosition,
    );
    const insertIdx = firstAfter === -1 ? destExcl.length : firstAfter;

    // Compute the post-compaction targets BEFORE parking — the parking
    // step mutates rank_position on the same Review objects we're about
    // to compact, and compactBucket sorts by rank_position. Snapshot
    // first to capture the user-intended ordering.
    const compacted = compactBucket(destExcl);

    // Park the moving review and every destExcl row at unique negative
    // rank_positions. The unique constraint is checked per statement
    // (deferrable initially immediate), so renumbering rows one-by-one
    // into colliding positive ranks would bounce off the constraint —
    // either against the moving review's existing rank (within-bucket
    // case) or against a sibling that hasn't been renumbered yet.
    // Negative ranks are guaranteed not to be in use. The moving review
    // stays in its old bucket while parked; the final retry below
    // applies the new bucket and rank in one statement.
    const { error: parkMoveErr } = await supabase
      .from("reviews")
      .update({ rank_position: -1 })
      .eq("id", reviewId)
      .eq("reviewer_id", user.id);
    if (parkMoveErr) {
      return {
        status: "error",
        code: "park_failed",
        message: parkMoveErr.message,
      };
    }
    for (let i = 0; i < destExcl.length; i++) {
      const { error: e } = await supabase
        .from("reviews")
        .update({ rank_position: -(i + 2) })
        .eq("id", destExcl[i].id);
      if (e) {
        return { status: "error", code: "park_failed", message: e.message };
      }
    }

    for (const c of compacted) {
      const { error: e } = await supabase
        .from("reviews")
        .update({ rank_position: c.new_rank })
        .eq("id", c.id);
      if (e) {
        return { status: "error", code: "compact_failed", message: e.message };
      }
    }

    // Compute the post-compaction midpoint at insertIdx, preserving the
    // user's original placement intent across the compact + retry.
    let retryRank: number;
    if (compacted.length === 0) {
      retryRank = 1000;
    } else if (insertIdx === 0) {
      retryRank = Math.max(1, Math.floor(compacted[0].new_rank / 2));
    } else if (insertIdx >= compacted.length) {
      retryRank = compacted[compacted.length - 1].new_rank + 1000;
    } else {
      retryRank = Math.floor(
        (compacted[insertIdx - 1].new_rank + compacted[insertIdx].new_rank) / 2,
      );
    }
    appliedRank = retryRank;

    const retry = await tryUpdate(appliedRank);
    if (retry.error) {
      if (isUniqueViolation(retry.error)) {
        return {
          status: "error",
          code: "rank_collision_after_compact",
          message: "Couldn't reorder — try again",
        };
      }
      return {
        status: "error",
        code: retry.error.code ?? "update_failed",
        message: retry.error.message,
      };
    }
    updated = retry.data;
    updateError = null;
  } else if (updateError) {
    return {
      status: "error",
      code: updateError.code ?? "update_failed",
      message: updateError.message,
    };
  }

  // Derive the moved review's rating_overall. The trigger should have
  // populated updated.rating_overall on the returned row, but if the driver
  // doesn't refresh the returning row after the trigger fires we recompute
  // it from the post-update bucket ordering. Critically: rank is derived
  // from the row's actual position, NOT a hardcoded 1 — otherwise every
  // reorder would optimistically display the top-of-band score.
  let newRatingOverall =
    (updated as { rating_overall?: number } | null)?.rating_overall ?? 0;
  if (!newRatingOverall) {
    const finalBucket = await fetchBucket(supabase, user.id, newBucket);
    const sizeAfter = finalBucket.length;
    const idx = finalBucket.findIndex((r) => r.id === reviewId);
    const derivedRank = idx >= 0 ? idx + 1 : 1;
    newRatingOverall =
      sizeAfter > 0
        ? computeRatingOverall(newBucket, derivedRank, sizeAfter)
        : 0;
  }

  revalidatePath("/list");
  revalidatePath("/venues");

  return {
    status: "ok",
    reviewId,
    bucket: newBucket,
    newRankPosition: appliedRank,
    newRatingOverall,
  };
}
