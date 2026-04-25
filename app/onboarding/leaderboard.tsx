"use client";

import Link from "next/link";

import type { OnboardingVenue } from "./data";
import { TopNav } from "./top-nav";

type LeaderboardProps = {
  venues: OnboardingVenue[];
};

export function Leaderboard({ venues }: LeaderboardProps) {
  const top = venues[0];
  const rest = venues.slice(1, 7);

  if (venues.length === 0) {
    return (
      <main
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "40px 20px 120px",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 34,
            fontWeight: 500,
            letterSpacing: "-0.02em",
          }}
        >
          No venues yet.
        </h1>
        <p
          style={{
            marginTop: 12,
            fontSize: 14,
            color: "var(--color-muted-foreground)",
          }}
        >
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
      <TopNav ctaHref="/login" ctaLabel="Sign in to personalise" />

      <main
        style={{
          maxWidth: 820,
          margin: "0 auto",
          padding: "40px 20px 120px",
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-muted-foreground)",
              marginBottom: 12,
            }}
          >
            UK Coffee Leaderboard
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(30px, 4vw, 44px)",
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              textWrap: "balance",
            }}
          >
            Third-wave coffee, reviewed honestly.
          </h1>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 15,
              color: "var(--color-muted-foreground)",
              maxWidth: 520,
              textWrap: "pretty",
            }}
          >
            Venues ranked by weighted reviewer scores.{" "}
            <Link
              href="/login"
              style={{
                color: "var(--color-foreground)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              Sign in
            </Link>{" "}
            to personalise the feed for your taste.
          </p>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {top ? <LeaderboardRow v={top} rank={1} primary /> : null}
          {rest.map((v, i) => (
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
  return (
    <Link
      href={`/venues/${v.slug}`}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 18,
        width: "100%",
        padding: primary ? "24px 26px" : "18px 22px",
        borderRadius: "var(--radius-lg)",
        border: primary
          ? "1px solid var(--color-accent)"
          : "1px solid var(--color-border)",
        background: primary
          ? "linear-gradient(180deg, var(--color-accent-soft), var(--color-background))"
          : "var(--color-background)",
        boxShadow: primary
          ? "0 8px 30px -18px var(--color-accent-ring)"
          : "0 1px 0 rgba(0,0,0,0.02)",
        textAlign: "left",
        color: "var(--color-foreground)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        transition: "background 160ms, border-color 160ms",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        if (!primary) e.currentTarget.style.background = "var(--color-muted)";
      }}
      onMouseLeave={(e) => {
        if (!primary)
          e.currentTarget.style.background = "var(--color-background)";
      }}
    >
      <div style={{ minWidth: 0 }}>
        {primary && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-accent)",
              marginBottom: 6,
            }}
          >
            #{rank} in the UK
          </div>
        )}
        <div
          style={{
            fontFamily: primary ? "var(--font-serif)" : "var(--font-sans)",
            fontSize: primary ? 22 : 16,
            fontWeight: primary ? 500 : 600,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          {v.name}
        </div>
        <div
          style={{
            marginTop: 4,
            fontSize: 12.5,
            color: "var(--color-muted-foreground)",
          }}
        >
          {v.city} · {v.roaster} · {v.reviews} review
          {v.reviews === 1 ? "" : "s"}
        </div>
        {primary && (
          <div
            style={{
              marginTop: 10,
              fontSize: 13.5,
              color: "var(--color-foreground)",
              fontStyle: "italic",
              textWrap: "pretty",
            }}
          >
            &ldquo;{v.pitch}&rdquo;
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "space-between",
          minWidth: 64,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 15,
            color: primary
              ? "var(--color-accent)"
              : "var(--color-foreground)",
            fontWeight: 600,
          }}
        >
          {v.score > 0 ? v.score.toFixed(1) : "—"}
        </div>
        {!primary && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-muted-foreground)",
              letterSpacing: "0.08em",
            }}
          >
            #{rank}
          </div>
        )}
      </div>
    </Link>
  );
}
