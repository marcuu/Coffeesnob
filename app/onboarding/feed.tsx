"use client";

import { CITIES, rankVenues, reasonsFor } from "./data";
import type { Prefs, RankedVenue } from "./data";

type FeedProps = {
  prefs: Prefs;
  onOpenSidebar: () => void;
};

export function Feed({ prefs, onOpenSidebar }: FeedProps) {
  const ranked = rankVenues(prefs);
  const top = ranked[0];
  const rest = ranked.slice(1, 7);
  const hasPrefs = !!prefs.axes || (prefs.drink && prefs.drink.length > 0);
  const cityName = prefs.city
    ? CITIES.find((c) => c.id === prefs.city)?.name
    : undefined;

  return (
    <div>
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
          {hasPrefs ? "Ranked for you" : `Best in ${cityName ?? "the UK"}`}
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
          {hasPrefs
            ? "Your shortlist."
            : "Third-wave coffee, reviewed honestly."}
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
          {hasPrefs
            ? "These are ranked by your taste, not ours. The more you tell us, the tighter this gets."
            : "Start browsing below. Tap any card to see reviews, or tell us your taste for better picks →"}
        </p>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {top ? <VenueRow v={top} prefs={prefs} primary /> : null}
        {rest.map((v) => (
          <VenueRow key={v.slug} v={v} prefs={prefs} />
        ))}
      </div>

      {!hasPrefs && <FloatingNudge onOpen={onOpenSidebar} />}
    </div>
  );
}

type VenueRowProps = {
  v: RankedVenue;
  prefs: Prefs;
  primary?: boolean;
};

function VenueRow({ v, prefs, primary }: VenueRowProps) {
  const reasons = reasonsFor(v, prefs);
  const hasPrefs = !!prefs.axes || (prefs.drink && prefs.drink.length > 0);
  return (
    <button
      type="button"
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
            Top pick for you
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
          {v.city} · {v.roaster} · {v.reviews} reviews
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
        <div
          style={{
            marginTop: 10,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {reasons.map((r, i) => (
            <span
              key={i}
              style={{
                fontSize: 11,
                padding: "2px 9px",
                borderRadius: 999,
                background: primary
                  ? "var(--color-background)"
                  : "var(--color-muted)",
                border: "1px solid var(--color-border)",
                color: "var(--color-muted-foreground)",
              }}
            >
              {r}
            </span>
          ))}
        </div>
        {primary && hasPrefs && (
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "var(--color-muted-foreground)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
            }}
          >
            Why: {v.proof}
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
          {v.score.toFixed(1)}
        </div>
        {hasPrefs && (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-muted-foreground)",
              letterSpacing: "0.08em",
            }}
          >
            {v.match}% MATCH
          </div>
        )}
      </div>
    </button>
  );
}

function FloatingNudge({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        zIndex: 20,
        padding: "14px 18px",
        background: "var(--color-primary)",
        color: "var(--color-primary-foreground)",
        borderRadius: 999,
        border: "none",
        boxShadow: "0 12px 30px -12px rgba(0,0,0,0.4)",
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        animation:
          "onboardingSlideIn 420ms 800ms cubic-bezier(.2,.7,.2,1) both",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: "var(--color-accent)",
        }}
      />
      Want better matches? Take 30 seconds →
    </button>
  );
}
