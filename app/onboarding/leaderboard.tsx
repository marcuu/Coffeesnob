"use client";

import Link from "next/link";

import { VenueSearch } from "@/components/VenueSearch";
import type { OnboardingVenue } from "./data";

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

const PAGE: React.CSSProperties = {
  maxWidth: 920,
  margin: "0 auto",
  padding: "64px 36px 140px",
};

const KICKER: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 400,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--color-muted-foreground)",
  marginBottom: 20,
  display: "block",
};

const HERO: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-serif)",
  fontSize: "clamp(36px, 5vw, 56px)",
  fontWeight: 400,
  lineHeight: 1.02,
  letterSpacing: "-0.025em",
  textWrap: "balance",
};

const SUBHEAD: React.CSSProperties = {
  margin: "14px 0 0",
  fontSize: 15,
  color: "var(--color-muted-foreground)",
  maxWidth: 480,
  lineHeight: 1.65,
  textWrap: "pretty",
};

type LeaderboardProps = {
  venues: OnboardingVenue[];
};

export function Leaderboard({ venues }: LeaderboardProps) {
  const [top, ...rest] = venues;

  if (venues.length === 0) {
    return (
      <main style={PAGE}>
        <h1 style={{ ...HERO, fontSize: "clamp(28px,3vw,40px)" }}>
          No venues yet.
        </h1>
        <p style={SUBHEAD}>
          The leaderboard fills up once the first venue is added.{" "}
          <Link
            href="/login"
            style={{ color: "var(--color-accent)", textDecoration: "underline" }}
          >
            Sign in
          </Link>{" "}
          to add one.
        </p>
      </main>
    );
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
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
              href="/login"
              style={{ ...NAV_LINK, color: "var(--color-foreground)" }}
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main style={PAGE}>
        <span style={KICKER}>UK Coffee Leaderboard</span>
        <h1 style={HERO}>
          Third-wave coffee,
          <br />
          reviewed honestly.
        </h1>
        <p style={SUBHEAD}>
          Venues ranked by weighted reviewer scores.{" "}
          <Link
            href="/login"
            style={{
              color: "var(--color-foreground)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Sign in
          </Link>{" "}
          to personalise the feed.
        </p>

        <div style={{ display: "grid", gap: 8, marginTop: 48 }}>
          {top && <LeaderboardRow v={top} rank={1} primary />}
          {rest.slice(0, 5).map((v, i) => (
            <LeaderboardRow key={v.slug} v={v} rank={i + 2} />
          ))}
        </div>
      </main>
    </div>
  );
}

type LeaderboardRowProps = {
  v: OnboardingVenue;
  rank: number;
  primary?: boolean;
};

function LeaderboardRow({ v, rank, primary }: LeaderboardRowProps) {
  if (primary) {
    return (
      <Link
        href={`/venues/${v.slug}`}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          borderRadius: 2,
          background: "hsl(20 14.3% 6%)",
          cursor: "pointer",
          overflow: "hidden",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <div
          style={{
            padding: "40px 44px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 240,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "oklch(0.75 0.11 44)",
                marginBottom: 20,
              }}
            >
              No. {rank} in the UK
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 26,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: "hsl(60 9.1% 97.8%)",
              }}
            >
              {v.name}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.08em",
                color: "hsl(24 5.4% 50%)",
              }}
            >
              {v.city}
              {v.roaster ? ` · ${v.roaster}` : ""} ·{" "}
              {v.reviews} review{v.reviews !== 1 ? "s" : ""}
            </div>
            {v.pitch && (
              <div
                style={{
                  marginTop: 20,
                  fontSize: 14,
                  fontStyle: "italic",
                  lineHeight: 1.7,
                  textWrap: "pretty",
                  color: "hsl(60 9.1% 78%)",
                }}
              >
                &ldquo;{v.pitch}&rdquo;
              </div>
            )}
          </div>
        </div>
        {/* Score panel */}
        <div
          style={{
            padding: "40px 44px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            alignItems: "flex-end",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "hsl(24 5.4% 38%)",
              marginBottom: 4,
            }}
          >
            Score
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 52,
              fontWeight: 400,
              color: "oklch(0.75 0.11 44)",
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {v.score > 0 ? v.score.toFixed(1) : "—"}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "hsl(24 5.4% 38%)",
              marginTop: 4,
            }}
          >
            /10
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/venues/${v.slug}`}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 24,
        padding: "22px 28px",
        borderRadius: 2,
        border: "1px solid var(--color-border)",
        background: "var(--color-background)",
        cursor: "pointer",
        transition: "border-color 200ms",
        textDecoration: "none",
        color: "inherit",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--color-foreground)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--color-border)";
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--color-foreground)",
          }}
        >
          {v.name}
        </div>
        <div
          style={{
            marginTop: 5,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.08em",
            color: "var(--color-muted-foreground)",
          }}
        >
          {v.city}
          {v.roaster ? ` · ${v.roaster}` : ""} · {v.reviews} review
          {v.reviews !== 1 ? "s" : ""}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "space-between",
          minWidth: 56,
          paddingTop: 2,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 20,
            fontWeight: 400,
            color: "var(--color-foreground)",
            letterSpacing: "-0.01em",
          }}
        >
          {v.score > 0 ? v.score.toFixed(1) : "—"}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-muted-foreground)",
          }}
        >
          #{rank}
        </div>
      </div>
    </Link>
  );
}
