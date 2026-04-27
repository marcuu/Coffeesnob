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

const GENERIC_SUCCESS_MESSAGE =
  "Invite recorded. If they are not already a member, they can claim access by signing in with that email.";

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
  const weeklyLimit = getWeeklyInviteLimit(
    reviewer as Pick<Reviewer, "status" | "review_count">,
  );

  const { data: inviteResult, error: inviteError } = await supabase.rpc(
    "issue_invite",
    {
      p_inviter_id: user.id,
      p_invitee_email: parsed.data.email,
      p_week_start: weekStart,
      p_weekly_limit: weeklyLimit,
    },
  );

  if (inviteError) {
    return { status: "error", message: "Could not send invite. Please retry." };
  }

  if (inviteResult === "quota_exceeded") {
    return {
      status: "error",
      message: `You've used all ${weeklyLimit} invites for this week.`,
    };
  }

  if (!["created", "already_member", "already_pending"].includes(inviteResult)) {
    return { status: "error", message: "Could not send invite. Please retry." };
  }

  revalidatePath("/profile");
  return {
    status: "success",
    message: GENERIC_SUCCESS_MESSAGE,
  };
}
