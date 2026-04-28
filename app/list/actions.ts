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
      "id, venue_id, reviewer_id, rating_overall, rating_taste, rating_body, rating_aroma, rating_ambience, rating_service, rating_value, bucket, rank_position, body, visited_on, created_at, updated_at",
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
      "id, venue_id, reviewer_id, rating_overall, rating_taste, rating_body, rating_aroma, rating_ambience, rating_service, rating_value, bucket, rank_position, body, visited_on, created_at, updated_at",
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
    // Compact the destination bucket excluding this review, then retry at the
    // recomputed rank position. We approximate by compacting all rows in the
    // bucket and inserting at end+1000 if mid-list collision.
    const dest = await fetchBucket(supabase, user.id, newBucket);
    const compacted = compactBucket(
      dest.filter((r) => r.id !== reviewId),
    );
    for (const c of compacted) {
      const { error: e } = await supabase
        .from("reviews")
        .update({ rank_position: c.new_rank })
        .eq("id", c.id);
      if (e) {
        return { status: "error", code: "compact_failed", message: e.message };
      }
    }
    // Place at the same target slot expressed in the new spacing: scale to
    // 1000-spaced slots by ratio of position-in-old-list.
    const newDest = compacted.map((c) => c.new_rank);
    const dropPosition = newDest.length === 0 ? 1000 : newDest[newDest.length - 1] + 1000;
    appliedRank = dropPosition;
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

  // For an optimistic-merge-friendly response, derive the new rating_overall
  // from the post-update bucket size if the trigger hasn't already populated
  // updated.rating_overall on the returned row (some Supabase mock drivers
  // don't refresh the returning row after the trigger runs).
  let newRatingOverall = (updated as { rating_overall?: number } | null)?.rating_overall ?? 0;
  if (!newRatingOverall) {
    const sizeAfter = (await fetchBucket(supabase, user.id, newBucket)).length;
    newRatingOverall = sizeAfter > 0 ? computeRatingOverall(newBucket, 1, sizeAfter) : 0;
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
