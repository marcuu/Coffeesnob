import Link from "next/link";

import { CityChips } from "@/components/CityChips";
import { formatDistanceMiles } from "@/lib/geo";
import { getScoreDisplay } from "@/lib/scoring-display";
import type { RankedVenue, UnrankedVenue } from "@/lib/rankings";

const KICKER: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  fontWeight: 400,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--color-muted-foreground)",
  marginBottom: 14,
  display: "block",
};

const HERO: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-serif)",
  fontSize: "clamp(32px, 6vw, 50px)",
  fontWeight: 400,
  lineHeight: 1.05,
  letterSpacing: "-0.025em",
  textWrap: "balance",
};

const SUBHEAD: React.CSSProperties = {
  margin: "12px 0 0",
  fontSize: 15,
  color: "var(--color-muted-foreground)",
  maxWidth: 480,
  lineHeight: 1.6,
  textWrap: "pretty",
};

const MONO_LABEL: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--color-muted-foreground)",
};

type Region = { id: string; name: string };

export type LeaderboardProps = {
  ranked: RankedVenue[];
  unranked: UnrankedVenue[];
  regions: Region[];
  activeRegion: Region | null;
  isLoggedIn?: boolean;
  /** Names of the signed-in user's wishlist venues within the current scope. */
  wishlistInScope?: string[];
  /** Distance-sorted "near me" view: no hero card, distances on rows. */
  nearMode?: boolean;
};

const UNRANKED_SAMPLE = 4;

export function Leaderboard({
  ranked,
  unranked,
  regions,
  activeRegion,
  isLoggedIn = false,
  wishlistInScope = [],
  nearMode = false,
}: LeaderboardProps) {
  const scopeLabel = nearMode ? "your area" : (activeRegion?.name ?? "the UK");
  // In near mode every venue renders as a row — a hero card would imply
  // "No. 1" while the list is ordered by distance.
  const top = nearMode ? undefined : ranked[0];
  const rest = nearMode ? ranked : ranked.slice(1);

  return (
    <main
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding:
          "clamp(28px, 5vw, 48px) clamp(16px, 4vw, 36px) clamp(64px, 10vw, 140px)",
      }}
    >
      {nearMode ? (
        <span style={KICKER}>Coffee near you</span>
      ) : null}
      <h1 style={HERO}>
        The best coffee,
        <br />
        reviewed harshly.
      </h1>
      <p style={SUBHEAD}>
        Bored of every coffee shop being rated 4.6 stars on Google? We&rsquo;ve
        built a better way of rating. Scores you can trust, from people who
        know their coffee.
      </p>
      <p style={{ ...SUBHEAD, marginTop: 8, fontSize: 14 }}>
        <Link
          href={isLoggedIn ? "/list" : "/login"}
          style={{
            color: "var(--color-foreground)",
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          {isLoggedIn ? "Go to your list" : "Sign in to personalise"} →
        </Link>
      </p>

      <div style={{ marginTop: 28 }}>
        <CityChips
          regions={regions}
          activeRegion={activeRegion?.id ?? null}
          nearActive={nearMode}
        />
      </div>

      {/* The nudge only earns its place when the view is scoped — "in the UK"
          is noise, "in Leeds" is a reason to act. */}
      {wishlistInScope.length > 0 && (nearMode || activeRegion) ? (
        <Link
          href="/list#wishlist"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 16,
            padding: "12px 16px",
            border: "1px solid var(--color-accent)",
            borderRadius: 2,
            background: "var(--color-accent-soft)",
            textDecoration: "none",
            fontSize: 13,
            color: "var(--color-foreground)",
            lineHeight: 1.5,
          }}
        >
          <span aria-hidden="true" style={{ color: "var(--color-accent)" }}>
            ◆
          </span>
          <span>
            {wishlistInScope.length === 1 ? (
              <>
                <strong>{wishlistInScope[0]}</strong> from your wishlist is in{" "}
                {scopeLabel}.
              </>
            ) : (
              <>
                {wishlistInScope.length} venues from your wishlist are in{" "}
                {scopeLabel}, including <strong>{wishlistInScope[0]}</strong>.
              </>
            )}
          </span>
        </Link>
      ) : null}

      {ranked.length === 0 ? (
        <p style={{ ...SUBHEAD, marginTop: 40 }}>
          No ranked venues in {scopeLabel} yet — rankings appear once venues
          have enough trusted reviews.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 28 }}>
          {top && <HeroCard item={top} scopeLabel={scopeLabel} />}
          {rest.map((item) => (
            <RankedRow key={item.venue.slug} item={item} />
          ))}
        </div>
      )}

      {unranked.length > 0 ? (
        <BeFirstModule unranked={unranked} scopeLabel={scopeLabel} />
      ) : null}

      {/* Always-present path into the full directory — the only other place
          to reach it on mobile now that Venues isn't a nav tab. */}
      <p style={{ marginTop: unranked.length > 0 ? 28 : 48 }}>
        <Link
          href={
            activeRegion
              ? `/venues?region=${encodeURIComponent(activeRegion.id)}`
              : "/venues"
          }
          style={{
            ...MONO_LABEL,
            color: "var(--color-foreground)",
            textDecoration: "underline",
            textUnderlineOffset: 4,
            display: "inline-block",
            padding: "8px 0",
          }}
        >
          Browse all venues →
        </Link>
      </p>
    </main>
  );
}

function HeroCard({
  item,
  scopeLabel,
}: {
  item: RankedVenue;
  scopeLabel: string;
}) {
  const { venue: v, reviewCount, score, maturity } = item;
  const display = getScoreDisplay(score, maturity);

  return (
    <Link
      href={`/venues/${v.slug}`}
      className="group block"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div className="rankings-hero">
        {v.photo_url ? (
          <div className="rankings-hero-img">
            <img
              src={v.photo_url}
              alt={v.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
                filter:
                  "grayscale(10%) brightness(0.78) contrast(1.1) saturate(0.85)",
                display: "block",
                transition: "transform 600ms cubic-bezier(.2,.7,.2,1)",
              }}
              className="group-hover:scale-[1.03]"
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, transparent 60%, hsl(20 14.3% 6%) 100%)",
              }}
            />
          </div>
        ) : null}
        <div className="rankings-hero-content">
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "oklch(0.75 0.11 44)",
                marginBottom: 16,
              }}
            >
              No. 1 in {scopeLabel}
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(24px, 5vw, 30px)",
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
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.08em",
                color: "hsl(24 5.4% 58%)",
              }}
            >
              {v.city} · {reviewCount} review{reviewCount === 1 ? "" : "s"}
            </div>
          </div>
          <div
            style={{
              marginTop: 28,
              display: "flex",
              alignItems: "baseline",
              gap: 6,
            }}
          >
            <span
              className="score-value"
              data-maturity={display.maturity}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "clamp(40px, 9vw, 52px)",
                fontWeight: 400,
                color: "oklch(0.75 0.11 44)",
                lineHeight: 1,
                letterSpacing: "-0.02em",
              }}
            >
              {display.formattedScore}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                color: "hsl(24 5.4% 50%)",
              }}
            >
              /10
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RankedRow({ item }: { item: RankedVenue }) {
  const { venue: v, rank, reviewCount, score, maturity, distanceMi } = item;
  const display = getScoreDisplay(score, maturity);
  const distanceLabel =
    distanceMi !== undefined && Number.isFinite(distanceMi)
      ? ` · ${formatDistanceMiles(distanceMi)}`
      : "";

  return (
    <Link href={`/venues/${v.slug}`} className="lb-row">
      <span
        style={{
          flexShrink: 0,
          width: 30,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--color-muted-foreground)",
        }}
        aria-label={`Rank ${rank}`}
      >
        #{rank}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span
          style={{
            display: "block",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--color-foreground)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {v.name}
        </span>
        <span
          style={{
            display: "block",
            marginTop: 5,
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.06em",
            color: "var(--color-muted-foreground)",
          }}
        >
          {v.city}
          {distanceLabel} · {reviewCount} review{reviewCount === 1 ? "" : "s"}
        </span>
      </span>
      <span
        className="score-value"
        data-maturity={display.maturity}
        style={{
          flexShrink: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 20,
          color: "var(--color-foreground)",
          letterSpacing: "-0.01em",
        }}
      >
        {display.formattedScore}
      </span>
    </Link>
  );
}

function BeFirstModule({
  unranked,
  scopeLabel,
}: {
  unranked: UnrankedVenue[];
  scopeLabel: string;
}) {
  const sample = unranked.slice(0, UNRANKED_SAMPLE);

  return (
    <section aria-label="Venues awaiting review" style={{ marginTop: 56 }}>
      <div style={{ ...MONO_LABEL, marginBottom: 12 }}>Not yet ranked</div>
      <p style={{ ...SUBHEAD, margin: 0, fontSize: 14 }}>
        {unranked.length} venue{unranked.length === 1 ? "" : "s"} in{" "}
        {scopeLabel} {unranked.length === 1 ? "is" : "are"} waiting for enough
        trusted reviews. Know one of them? Have a say in where it lands.
      </p>
      <ul
        style={{
          listStyle: "none",
          margin: "20px 0 0",
          padding: 0,
          display: "grid",
          gap: 8,
        }}
      >
        {sample.map(({ venue: v, distanceMi }) => (
          <li key={v.id}>
            <Link
              href={`/venues/${v.slug}`}
              className="lb-row"
              style={{ alignItems: "center" }}
            >
              <span style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--color-foreground)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {v.name}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 4,
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.06em",
                    color: "var(--color-muted-foreground)",
                  }}
                >
                  {v.city}
                  {distanceMi !== undefined && Number.isFinite(distanceMi)
                    ? ` · ${formatDistanceMiles(distanceMi)}`
                    : ""}
                </span>
              </span>
              <span
                style={{
                  ...MONO_LABEL,
                  flexShrink: 0,
                  fontSize: 11,
                  color: "var(--color-accent)",
                }}
              >
                Review →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
