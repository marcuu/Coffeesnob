"use client";

import Link from "next/link";

import { rankVenues } from "./data";
import type { OnboardingVenue, Prefs, RankedVenue, Region } from "./data";

type FeedProps = {
  venues: OnboardingVenue[];
  regions: Region[];
  prefs: Prefs;
  onOpenSidebar: () => void;
};

export function Feed({ venues, regions, prefs, onOpenSidebar }: FeedProps) {
  const ranked = rankVenues(venues, prefs);
  const [top, ...rest] = ranked;
  const hasPrefs = !!prefs.axes || (prefs.drink && prefs.drink.length > 0);
  const regionName = prefs.region
    ? regions.find((r) => r.id === prefs.region)?.name
    : undefined;

  return (
    <div>
      <div style={{ marginBottom: 48 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 400,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--color-muted-foreground)",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {hasPrefs ? "Ranked for you" : `Best in ${regionName ?? "the UK"}`}
          {hasPrefs && (
            <button
              type="button"
              onClick={onOpenSidebar}
              style={{
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "var(--font-mono)",
                color: "var(--color-muted-foreground)",
                background: "transparent",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius)",
                padding: "2px 8px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Refine taste →
            </button>
          )}
        </span>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(36px, 5vw, 56px)",
            fontWeight: 400,
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
            textWrap: "balance",
          }}
        >
          {hasPrefs ? "Your shortlist." : "The best coffee,\nreviewed harshly."}
        </h1>
        <p
          style={{
            margin: "14px 0 0",
            fontSize: 15,
            color: "var(--color-muted-foreground)",
            maxWidth: 480,
            lineHeight: 1.65,
            textWrap: "pretty",
          }}
        >
          {hasPrefs
            ? "Personalised to your taste."
            : "Tell us about your preferences and we'll find the best coffee for you."}
        </p>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {top ? <VenueRow v={top} prefs={prefs} primary /> : null}
        {rest.slice(0, 5).map((v) => (
          <VenueRow key={v.slug} v={v} prefs={prefs} />
        ))}
      </div>

      {!hasPrefs && <TuneNudge onOpen={onOpenSidebar} />}
    </div>
  );
}

type VenueRowProps = {
  v: RankedVenue;
  prefs: Prefs;
  primary?: boolean;
};

function VenueRow({ v, prefs, primary }: VenueRowProps) {
  const hasPrefs = !!prefs.axes || (prefs.drink && prefs.drink.length > 0);

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
              {hasPrefs ? "Top pick for you" : "No. 1 in the UK"}
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
              {v.city} · {v.reviews} review{v.reviews !== 1 ? "s" : ""}
            </div>
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
          {hasPrefs && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.1em",
                color: "oklch(0.75 0.11 44)",
                marginTop: 16,
              }}
            >
              {v.match}% match
            </div>
          )}
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
          {v.city} · {v.reviews} review{v.reviews !== 1 ? "s" : ""}
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
        {hasPrefs && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--color-muted-foreground)",
            }}
          >
            {v.match}% match
          </div>
        )}
      </div>
    </Link>
  );
}

function TuneNudge({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      <style>{`@keyframes csNudge{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <button
        type="button"
        onClick={onOpen}
        style={{
          position: "fixed",
          right: 36,
          bottom: 36,
          zIndex: 20,
          display: "inline-flex",
          alignItems: "center",
          gap: 16,
          padding: "16px 24px",
          background: "hsl(20 14.3% 6%)",
          border: "none",
          borderRadius: 2,
          boxShadow: "0 16px 48px -12px rgba(0,0,0,0.5)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "hsl(60 9.1% 97.8%)",
          cursor: "pointer",
          transition: "background 180ms",
          animation: "csNudge 480ms 600ms cubic-bezier(.2,.7,.2,1) both",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "hsl(20 14.3% 10%)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "hsl(20 14.3% 6%)";
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "oklch(0.75 0.11 44)",
            flexShrink: 0,
          }}
        />
        Personalise your feed
        <span style={{ color: "oklch(0.75 0.11 44)", marginLeft: 2 }}>→</span>
      </button>
    </>
  );
}
