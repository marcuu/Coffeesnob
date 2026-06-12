import Link from "next/link";

import { BottomNav } from "@/components/bottom-nav";
import type { RecentVenue } from "@/components/log-sheet";
import { VenueSearch } from "@/components/VenueSearch";
import { createClient } from "@/utils/supabase/server";

const NAV_LINK: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  fontWeight: 400,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--color-muted-foreground)",
  textDecoration: "none",
  transition: "color 160ms",
  // Generous vertical padding keeps the tap area ≥44px inside the slim bar.
  padding: "14px 2px",
};

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profileHref = "/profile";
  let profileLabel = "Sign in";
  let recentVenues: RecentVenue[] = [];
  if (user) {
    const [{ data: reviewer }, { data: recentRows }] = await Promise.all([
      supabase
        .from("reviewers")
        .select("username, display_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("reviews")
        .select("created_at, venue:venues(slug, name, city)")
        .eq("reviewer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
    if (reviewer?.username) profileHref = `/profile/${reviewer.username}`;
    profileLabel = reviewer?.display_name ?? reviewer?.username ?? "Profile";

    // Most recent distinct venues, for the Log sheet's one-tap shortcuts.
    const seen = new Set<string>();
    for (const row of (recentRows ?? []) as unknown as Array<{
      venue: RecentVenue | null;
    }>) {
      if (!row.venue || seen.has(row.venue.slug)) continue;
      seen.add(row.venue.slug);
      recentVenues.push(row.venue);
      if (recentVenues.length >= 4) break;
    }
  }

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background:
            "color-mix(in oklab, var(--color-background) 90%, transparent)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <style>{`
          .sh-inner { max-width: 920px; margin: 0 auto; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; min-height: 56px; }
          @media (min-width: 640px) { .sh-inner { padding: 8px 36px; } }
          .sh-nav { display: flex; align-items: center; gap: 16px; }
          @media (min-width: 640px) { .sh-nav { gap: 28px; } }
          /* On mobile these links live in the bottom tab bar instead */
          .sh-link { display: none; }
          @media (min-width: 768px) { .sh-link { display: inline-block; } }
        `}</style>
        <div className="sh-inner">
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 18,
              fontWeight: 400,
              letterSpacing: "-0.01em",
              textDecoration: "none",
              color: "var(--color-foreground)",
              padding: "10px 0",
            }}
          >
            Caffiends
          </Link>
          <nav className="sh-nav">
            <VenueSearch />
            <Link href="/rankings" className="sh-link" style={NAV_LINK}>
              Rankings
            </Link>
            <Link href="/venues" className="sh-link" style={NAV_LINK}>
              Venues
            </Link>
            {user ? (
              <Link href="/list" className="sh-link" style={NAV_LINK}>
                Your list
              </Link>
            ) : null}
            <Link
              href={user ? profileHref : "/login"}
              className="sh-link"
              style={{ ...NAV_LINK, color: "var(--color-foreground)" }}
            >
              {profileLabel}
            </Link>
          </nav>
        </div>
      </header>
      <BottomNav
        isLoggedIn={!!user}
        profileHref={profileHref}
        recentVenues={recentVenues}
      />
    </>
  );
}
