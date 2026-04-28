"use server";

import { revalidatePath } from "next/cache";

import { formString } from "@/lib/validators";
import { createClient } from "@/utils/supabase/server";

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
