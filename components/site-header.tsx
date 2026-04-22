import Link from "next/link";

import { createClient } from "@/utils/supabase/server";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profileHref = "/profile";
  if (user) {
    const { data: reviewer } = await supabase
      .from("reviewers")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    if (reviewer?.username) profileHref = `/profile/${reviewer.username}`;
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background:
          "color-mix(in oklab, var(--color-background) 92%, transparent)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 19,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            textDecoration: "none",
            color: "var(--color-foreground)",
          }}
        >
          Coffeesnob
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/venues"
            aria-label="Browse venues"
            style={{
              color: "var(--color-muted-foreground)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </Link>
          <Link
            href={profileHref}
            aria-label="My profile"
            style={{
              color: "var(--color-muted-foreground)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
