"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";

export async function acknowledgeRankingOnboarding(): Promise<{
  status: "ok" | "error";
  message?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Not authenticated" };

  const { error } = await supabase
    .from("reviewers")
    .update({ seen_ranking_onboarding_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { status: "error", message: error.message };

  revalidatePath("/list");
  return { status: "ok" };
}
