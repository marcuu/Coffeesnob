"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  FLAVOUR_PAIRS,
  rankVenues,
  type OnboardingVenue,
  type Prefs,
} from "./data";

type AhaRevealProps = {
  open: boolean;
  prefs: Prefs;
  venues: OnboardingVenue[];
  onClose: () => void;
  onDone: () => void;
};

export function AhaReveal({
  open,
  prefs,
  venues,
  onClose,
  onDone,
}: AhaRevealProps) {
  const top = useMemo(
    () => (open ? rankVenues(venues, prefs)[0] : null),
    [open, venues, prefs],
  );
  const picks = useMemo(() => {
    if (!prefs.pairPicks) return [];
    return FLAVOUR_PAIRS.map((p) => {
      const id = prefs.pairPicks[p.id];
      return id ? p.options.find((o) => o.id === id) : null;
    }).filter(
      (o): o is (typeof FLAVOUR_PAIRS)[number]["options"][number] => !!o,
    );
  }, [prefs.pairPicks]);

  if (!open || !top) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,14,10,0.5)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "onboardingFadeIn 220ms ease",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 540,
          width: "100%",
          background: "var(--color-background)",
          borderRadius: "var(--radius-lg)",
          padding: 28,
          border: "1px solid var(--color-accent)",
          boxShadow: "0 24px 80px -20px rgba(0,0,0,0.4)",
          animation: "onboardingFadeIn 320ms cubic-bezier(.2,.7,.2,1)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-accent)",
          }}
        >
          Based on what you told us
        </div>
        <h2
          style={{
            margin: "8px 0 14px",
            fontFamily: "var(--font-serif)",
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Go here first: {top.name}.
        </h2>
        <p
          style={{
            margin: "0 0 18px",
            fontSize: 14,
            color: "var(--color-muted-foreground)",
            textWrap: "pretty",
          }}
        >
          {top.pitch}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: 18,
            alignItems: "center",
            padding: 16,
            borderRadius: "var(--radius)",
            background: "var(--color-accent-soft)",
            border: "1px solid var(--color-accent)",
          }}
        >
          <MatchDial pct={top.match} />
          <div style={{ fontSize: 13, color: "var(--color-foreground)" }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Why this one?
            </div>
            <div
              style={{
                color: "var(--color-muted-foreground)",
                fontSize: 12.5,
                textWrap: "pretty",
              }}
            >
              {top.proof}
            </div>
          </div>
        </div>

        {picks.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--color-muted-foreground)",
                marginBottom: 8,
              }}
            >
              Your picks → this venue
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {picks.map((p) => (
                <span
                  key={p.id}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "var(--color-muted)",
                    color: "var(--color-foreground)",
                  }}
                >
                  {p.name}
                </span>
              ))}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-muted-foreground)",
                  padding: "4px 2px",
                }}
              >
                →
              </span>
              <span
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "var(--color-accent)",
                  color: "var(--color-primary-foreground)",
                  fontWeight: 600,
                }}
              >
                {top.name}
              </span>
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <Link
            href={`/venues/${top.slug}`}
            onClick={onDone}
            style={{
              height: 42,
              padding: "0 18px",
              borderRadius: "var(--radius)",
              background: "var(--color-primary)",
              color: "var(--color-primary-foreground)",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
            }}
          >
            Take me there →
          </Link>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 42,
              padding: "0 16px",
              borderRadius: "var(--radius)",
              background: "transparent",
              color: "var(--color-muted-foreground)",
              border: "none",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Browse the full list
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchDial({ pct }: { pct: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="var(--color-background)"
        strokeWidth="6"
      />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dashoffset 600ms ease-out" }}
      />
      <text
        x="36"
        y="36"
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 16,
          fontWeight: 700,
          fill: "var(--color-foreground)",
        }}
      >
        {pct}
      </text>
      <text
        x="36"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 7,
          letterSpacing: "0.14em",
          fill: "var(--color-muted-foreground)",
        }}
      >
        MATCH
      </text>
    </svg>
  );
}
