import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

// Exported for testing. Allows only safe relative paths to prevent open redirect.
export function sanitizeNext(raw: string): string {
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return "/";
  }
  // Must start with / but not // (protocol-relative).
  // Reject backslashes (browsers may normalise \ to /) and any scheme: pattern.
  if (
    /^\/(?!\/)/.test(path) &&
    !path.includes("\\") &&
    !/[a-z][a-z+\-.]*:/i.test(path)
  ) {
    return path;
  }
  return "/";
}

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

  const { data: allowed, error: allowlistError } = await supabase
    .from("allowed_users")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (allowlistError || !allowed) {
    await supabase.auth.signOut();
    return unauthorized("Your account is not on the access list.");
  }

  return NextResponse.redirect(`${origin}${next}`);
}
