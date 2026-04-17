"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";

export async function loginWithGoogle() {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.url) redirect(data.url);
}

const emailSchema = z.object({ email: z.string().trim().email() });

export type EmailLoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
};

export async function loginWithEmail(
  _prev: EmailLoginState,
  formData: FormData,
): Promise<EmailLoginState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address" };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return {
    status: "sent",
    message:
      "Magic link sent. Locally, open http://localhost:54324 to grab it from Inbucket.",
  };
}
