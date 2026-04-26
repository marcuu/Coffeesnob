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
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "16px 36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
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
        <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
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
