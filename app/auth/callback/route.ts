import { NextResponse } from "next/server";

import { sanitizeNext } from "@/lib/sanitize-next";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";

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
  const { data: acceptedInviteId, error: acceptError } = await service.rpc(
    "accept_invite_for_email",
    { p_email: email, p_user_id: user.id },
  );

  if (acceptError || !acceptedInviteId) {
    await supabase.auth.signOut();
    return unauthorized("Your account is not on the access list.");
  }

  return NextResponse.redirect(`${origin}${next}`);
}
