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
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;
  const isPublicVenueRead =
    pathname.startsWith("/venues/") &&
    !pathname.startsWith("/venues/new") &&
    !pathname.endsWith("/review");
  const isPublicProfileRead = pathname.startsWith("/profile/") && pathname !== "/profile/edit";
  const isPublic =
    pathname === "/" ||
    pathname === "/bramford" ||
    pathname === "/about/calibration" ||
    pathname === "/login" ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    isPublicVenueRead ||
    isPublicProfileRead;

  if (!session && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (session) {
    const allowedDuringOnboarding =
      pathname === "/onboarding" ||
      pathname === "/" ||
      pathname === "/bramford" ||
      pathname === "/about/calibration" ||
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
