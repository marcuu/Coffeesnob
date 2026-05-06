"use server";

import { revalidatePath } from "next/cache";

import { track } from "@/lib/analytics";
import {
  persistRankedReview,
  type PersistRankedReviewResult,
} from "@/lib/reviews/ranked-review-persistence";
import { createClient } from "@/utils/supabase/server";

export type SubmitRankedReviewResult = PersistRankedReviewResult;

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

  track({
    name: "review_submitted",
    bucket: (rawInput as { bucket?: string }).bucket,
    list_changed: result.list_changed || undefined,
  });

  return result;
}
