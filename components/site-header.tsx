import Link from "next/link";

import { VenueSearch } from "@/components/VenueSearch";
import { createClient } from "@/utils/supabase/server";

const NAV_LINK: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 400,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--color-muted-foreground)",
  textDecoration: "none",
  transition: "color 160ms",
};

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profileHref = "/profile";
  let profileLabel = "Sign in";
  if (user) {
    const { data: reviewer } = await supabase
      .from("reviewers")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle();
    if (reviewer?.username) profileHref = `/profile/${reviewer.username}`;
    profileLabel = reviewer?.display_name ?? reviewer?.username ?? "Profile";
  }

  return (
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
        .sh-inner { max-width: 920px; margin: 0 auto; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; }
        @media (min-width: 640px) { .sh-inner { padding: 16px 36px; } }
        .sh-nav { display: flex; align-items: center; gap: 16px; }
        @media (min-width: 640px) { .sh-nav { gap: 28px; } }
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
          }}
        >
          Coffeesnob
        </Link>
        <nav className="sh-nav">
          <VenueSearch />
          <Link href="/rankings" style={NAV_LINK}>
            Rankings
          </Link>
          <Link
            href={user ? profileHref : "/login"}
            style={{ ...NAV_LINK, color: "var(--color-foreground)" }}
          >
            {profileLabel}
          </Link>
        </nav>
      </div>
    </header>
  );
}
