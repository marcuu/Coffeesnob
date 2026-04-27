import { NextResponse } from "next/server";

import { sanitizeNext } from "@/lib/sanitize-next";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next") ?? "/");

  const unauthorized = (reason: string) =>
    NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(reason)}`,
    );

  if (!code) {
    return unauthorized("auth_callback_failed");
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return unauthorized("auth_callback_failed");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    await supabase.auth.signOut();
    return unauthorized("Could not verify your account. Please try again.");
  }

  const email = user.email.toLowerCase();

  const { data: allowed, error: allowlistError } = await supabase
    .from("allowed_users")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (!allowlistError && allowed) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const service = createServiceRoleClient();

  const { data: invite, error: inviteError } = await service
    .from("invites")
    .select("id")
    .eq("invitee_email", email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inviteError || !invite) {
    await supabase.auth.signOut();
    return unauthorized("Your account is not on the access list.");
  }

  const { error: insertAllowError } = await service
    .from("allowed_users")
    .upsert({ email }, { onConflict: "email", ignoreDuplicates: true });

  if (insertAllowError) {
    await supabase.auth.signOut();
    return unauthorized("Could not complete invite acceptance. Please retry.");
  }

  const { error: acceptError } = await service
    .from("invites")
    .update({
      status: "accepted",
      invitee_user_id: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  if (acceptError) {
    await supabase.auth.signOut();
    return unauthorized("Could not complete invite acceptance. Please retry.");
  }

  return NextResponse.redirect(`${origin}${next}`);
}
