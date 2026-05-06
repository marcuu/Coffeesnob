"use server";

import { revalidatePath } from "next/cache";

import { track } from "@/lib/analytics";
import type { ReviewBucket } from "@/lib/types";
import {
  persistRankedReview,
  type PersistRankedReviewResult,
} from "@/lib/reviews/ranked-review-persistence";
import { createClient } from "@/utils/supabase/server";

export type SubmitRankedReviewResult = PersistRankedReviewResult;

function isReviewBucket(value: unknown): value is ReviewBucket {
  return value === "pilgrimage" || value === "detour" || value === "convenience";
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

  const result = await persistRankedReview({
    supabase,
    reviewerId: user.id,
    rawInput,
    synthetic: false,
  });

  if (result.status !== "ok") return result;

  if (options.slug) revalidatePath(`/venues/${options.slug}`);
  revalidatePath("/venues");
  revalidatePath("/bramford");
  revalidatePath("/list");

  const bucket = (rawInput as { bucket?: unknown }).bucket;
  if (isReviewBucket(bucket)) {
    track({
      name: "review_submitted",
      bucket,
      list_changed: result.list_changed || undefined,
    });
  }

  return result;
}
