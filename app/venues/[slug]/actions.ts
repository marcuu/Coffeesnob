"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import { deriveOverallRatingInt } from "@/lib/review-scoring";
import { formNumber, formString, reviewCreateSchema } from "@/lib/validators";

export type ReviewFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success" };

const initial: ReviewFormState = { status: "idle" };

export async function createReview(
  _prev: ReviewFormState = initial,
  formData: FormData,
): Promise<ReviewFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not authenticated" };

  const venue_id = formString(formData.get("venue_id"));
  const slug = formString(formData.get("slug"));

  const raw = {
    venue_id,
    rating_ambience: formNumber(formData.get("rating_ambience")),
    rating_service: formNumber(formData.get("rating_service")),
    rating_value: formNumber(formData.get("rating_value")),
    rating_taste: formNumber(formData.get("rating_taste")),
    rating_body: formNumber(formData.get("rating_body")),
    rating_aroma: formNumber(formData.get("rating_aroma")),
    body: formString(formData.get("body")),
    visited_on: formString(formData.get("visited_on")),
  };

  const parsed = reviewCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "form";
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors,
    };
  }

  const derivedOverall = deriveOverallRatingInt(parsed.data);

  const { error } = await supabase
    .from("reviews")
    .insert({ ...parsed.data, rating_overall: derivedOverall, reviewer_id: user.id });

  if (error) return { status: "error", message: error.message };

  if (slug) revalidatePath(`/venues/${slug}`);
  revalidatePath("/venues");

  return { status: "success" };
}

export async function deleteReview(formData: FormData) {
  const id = formString(formData.get("id"));
  const slug = formString(formData.get("slug"));
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("reviews")
    .delete()
    .eq("id", id)
    .eq("reviewer_id", user.id);

  if (slug) revalidatePath(`/venues/${slug}`);
  revalidatePath("/venues");
}
