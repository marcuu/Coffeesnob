import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: CookieOptions;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // JWT-only check: fast, no network round-trip. Server actions and API
  // routes must still call getUser() for authoritative validation.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (!session && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Cold-start gate: authenticated users without a completed onboarding
  // are pinned to /onboarding (and a small set of allowed paths) until
  // they finish. The flag is read once per request; once set, gating is a
  // no-op so the steady-state cost is one indexed PK lookup.
  if (session) {
    const allowedDuringOnboarding =
      pathname === "/onboarding" ||
      pathname === "/" ||
      pathname === "/login" ||
      pathname.startsWith("/auth/") ||
      pathname.startsWith("/_next") ||
      pathname === "/favicon.ico";

    if (!allowedDuringOnboarding) {
      const { data: reviewer } = await supabase
        .from("reviewers")
        .select("seen_onboarding_at")
        .eq("id", session.user.id)
        .maybeSingle();

      if (reviewer && !reviewer.seen_onboarding_at) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
