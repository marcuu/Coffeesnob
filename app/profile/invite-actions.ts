"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getWeeklyInviteLimit, startOfUtcWeek } from "@/lib/invites";
import type { Reviewer } from "@/lib/types";
import { createClient } from "@/utils/supabase/server";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export type InviteFormState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function createInvite(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const parsed = inviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "error", message: "Not authenticated" };

  const { data: reviewer, error: reviewerError } = await supabase
    .from("reviewers")
    .select("status, review_count")
    .eq("id", user.id)
    .maybeSingle();

  if (reviewerError || !reviewer) {
    return { status: "error", message: "Could not load your reviewer profile" };
  }

  const weekStart = startOfUtcWeek(new Date());
  const weeklyLimit = getWeeklyInviteLimit(reviewer as Pick<Reviewer, "status" | "review_count">);

  const { count: usedThisWeek } = await supabase
    .from("invites")
    .select("id", { count: "exact", head: true })
    .eq("inviter_id", user.id)
    .gte("created_at", weekStart)
    .in("status", ["pending", "accepted"]);

  if ((usedThisWeek ?? 0) >= weeklyLimit) {
    return {
      status: "error",
      message: `You've used all ${weeklyLimit} invites for this week.`,
    };
  }

  const email = parsed.data.email;

  const { data: alreadyAllowed } = await supabase
    .from("allowed_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (alreadyAllowed) {
    return {
      status: "error",
      message: "That email already has access.",
    };
  }

  const { data: existingPending } = await supabase
    .from("invites")
    .select("id")
    .eq("inviter_id", user.id)
    .eq("invitee_email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPending) {
    return {
      status: "error",
      message: "You already have a pending invite for that email.",
    };
  }

  const { error } = await supabase.from("invites").insert({
    inviter_id: user.id,
    invitee_email: email,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/profile");
  return {
    status: "success",
    message: `Invite sent to ${email}. They can sign in with that email to claim it.`,
  };
}
