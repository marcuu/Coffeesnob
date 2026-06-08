"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  PairwiseTournament,
  type PairwiseResult,
} from "@/components/review/pairwise-tournament";
import { TwoAxisSliders } from "@/components/review/two-axis-sliders";
import { BucketSelector } from "@/components/review/bucket-selector";
import { generateTasteSummary } from "@/lib/onboarding/taste-summary";
import type { ReviewBucket, Review } from "@/lib/types";
import { submitRankedReview } from "@/app/venues/[slug]/review/actions";

import {
  addToWishlist,
  completeOnboarding,
  getSimilarReviewersAndTryNext,
} from "./actions";

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

const SHELL_BG = "hsl(20 14.3% 4%)";
const TEXT_PRIMARY = "hsl(60 9.1% 97.8%)";
const TEXT_MUTED = "hsl(24 5.4% 60%)";
const TEXT_DIMMER = "hsl(24 5.4% 40%)";
const ACCENT = "oklch(0.75 0.11 44)";

const MIN_PRIMING_FOR_CONTINUE = 5;
const MAX_PRIMING = 10;

export type PrimingVenue = {
  id: string;
  slug: string;
  name: string;
  city: string;
  photoUrl: string | null;
  roasters: string[];
  brewMethods: string[];
  notes: string | null;
};

export type PrimingReviewSummary = {
  reviewId: string;
  bucket: ReviewBucket;
  ratingCoffee5: number;
  ratingVibe5: number;
  rankPosition: number;
};

type Step = "welcome" | "priming" | "reveal" | "next";

type RankFlowState =
  | null
  | { stage: "bucket"; venue: PrimingVenue }
  | { stage: "tournament"; venue: PrimingVenue; bucket: ReviewBucket }
  | {
      stage: "axes";
      venue: PrimingVenue;
      bucket: ReviewBucket;
      tournament: PairwiseResult;
    }
  | {
      stage: "submitting";
      venue: PrimingVenue;
      bucket: ReviewBucket;
      tournament: PairwiseResult;
      coffee: number;
      vibe: number;
    };

export function PrimingApp({
  venues,
  existingByVenue,
  displayName,
  nextHref,
}: {
  venues: PrimingVenue[];
  existingByVenue: Record<string, PrimingReviewSummary>;
  displayName: string;
  nextHref: string;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [ranked, setRanked] = useState<Record<string, PrimingReviewSummary>>(
    existingByVenue,
  );
  const [flow, setFlow] = useState<RankFlowState>(null);
  const [error, setError] = useState<string | null>(null);

  const rankedCount = Object.keys(ranked).length;

  // Auto-advance to reveal once user hits the cap.
  useEffect(() => {
    if (step === "priming" && rankedCount >= MAX_PRIMING) {
      setStep("reveal");
    }
  }, [rankedCount, step]);

  return (
    <div style={{ minHeight: "100vh", background: SHELL_BG, color: TEXT_PRIMARY }}>
      <main
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "32px 24px 96px",
        }}
      >
        {step === "welcome" && (
          <WelcomeScreen onStart={() => setStep("priming")} displayName={displayName} />
        )}
        {step === "priming" && (
          <PrimingScreen
            venues={venues}
            ranked={ranked}
            rankedCount={rankedCount}
            onPick={(venue) => {
              setError(null);
              setFlow({ stage: "bucket", venue });
            }}
            onContinue={() => setStep("reveal")}
          />
        )}
        {step === "reveal" && (
          <RevealScreen
            ranked={ranked}
            venues={venues}
            onContinue={() => setStep("next")}
          />
        )}
        {step === "next" && (
          <NextStepsScreen ranked={ranked} nextHref={nextHref} />
        )}
      </main>

      {flow && (
        <RankFlowModal
          flow={flow}
          venues={venues}
          ranked={ranked}
          onCancel={() => setFlow(null)}
          onError={setError}
          onSetFlow={setFlow}
          onSubmitted={(venueId, summary) => {
            setRanked((prev) => ({ ...prev, [venueId]: summary }));
            setFlow(null);
          }}
        />
      )}

      {error && (
        <div
          role="alert"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 16px",
            borderRadius: 4,
            background: "hsl(0 84.2% 60.2% / 0.16)",
            color: "hsl(0 84.2% 80%)",
            fontSize: 13,
            maxWidth: 480,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function WelcomeScreen({
  onStart,
  displayName,
}: {
  onStart: () => void;
  displayName: string;
}) {
  return (
    <div style={{ paddingTop: 40 }}>
      <div style={{ ...MONO, color: TEXT_DIMMER, marginBottom: 24 }}>
        Step 1 · welcome
      </div>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(36px, 6vw, 56px)",
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1.05,
          marginBottom: 20,
        }}
      >
        You&rsquo;re in, {displayName}.
      </h1>
      <p
        style={{
          fontSize: 16,
          lineHeight: 1.6,
          color: TEXT_MUTED,
          maxWidth: 540,
          marginBottom: 18,
        }}
      >
        Caffiends ranks UK third-wave coffee, and the reviewers who know
        their coffee count for more. The sharper your taste, the more your
        reviews shape the rankings.
      </p>
      <p
        style={{
          fontSize: 16,
          lineHeight: 1.6,
          color: TEXT_MUTED,
          maxWidth: 540,
          marginBottom: 36,
        }}
      >
        Let&rsquo;s get your taste profile started. Rank anywhere from 1 to{" "}
        {MAX_PRIMING} venues you&rsquo;ve been to. The more you rank, the
        sharper it starts out.
      </p>
      <PrimaryButton onClick={onStart}>Start →</PrimaryButton>
    </div>
  );
}

function PrimingScreen({
  venues,
  ranked,
  rankedCount,
  onPick,
  onContinue,
}: {
  venues: PrimingVenue[];
  ranked: Record<string, PrimingReviewSummary>;
  rankedCount: number;
  onPick: (venue: PrimingVenue) => void;
  onContinue: () => void;
}) {
  const showContinue = rankedCount >= MIN_PRIMING_FOR_CONTINUE;
  const remaining = Math.max(0, MAX_PRIMING - rankedCount);

  return (
    <div>
      <div style={{ ...MONO, color: TEXT_DIMMER, marginBottom: 12 }}>
        Step 2 · ranking · {rankedCount} of {MAX_PRIMING} ranked
      </div>
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(28px, 4.5vw, 40px)",
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          marginBottom: 12,
        }}
      >
        Tap any venue you&rsquo;ve been to.
      </h2>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: TEXT_MUTED,
          maxWidth: 520,
          marginBottom: 24,
        }}
      >
        {rankedCount < MIN_PRIMING_FOR_CONTINUE
          ? `Keep going for a sharper profile. ${MIN_PRIMING_FOR_CONTINUE} gets you to the reveal.`
          : `${remaining} more for the sharpest read, or carry on now.`}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 36,
        }}
      >
        {venues.map((v) => {
          const r = ranked[v.id];
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onPick(v)}
              disabled={!!r && rankedCount >= MAX_PRIMING}
              style={{
                textAlign: "left",
                padding: "14px 14px",
                borderRadius: 4,
                background: r
                  ? "rgba(241, 168, 113, 0.08)"
                  : "rgba(255,255,255,0.02)",
                border: r
                  ? `1px solid ${ACCENT}`
                  : "1px solid rgba(255,255,255,0.1)",
                color: TEXT_PRIMARY,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 16 }}>
                {v.name}
              </div>
              <div
                style={{
                  ...MONO,
                  fontSize: 9,
                  color: r ? ACCENT : TEXT_DIMMER,
                }}
              >
                {r ? r.bucket.toUpperCase() : v.city}
              </div>
            </button>
          );
        })}
      </div>

      {showContinue && (
        <PrimaryButton onClick={onContinue}>Continue →</PrimaryButton>
      )}
    </div>
  );
}

function RevealScreen({
  ranked,
  venues,
  onContinue,
}: {
  ranked: Record<string, PrimingReviewSummary>;
  venues: PrimingVenue[];
  onContinue: () => void;
}) {
  const venueById = useMemo(() => {
    const m = new Map<string, PrimingVenue>();
    for (const v of venues) m.set(v.id, v);
    return m;
  }, [venues]);

  const provisionalList = useMemo(() => {
    return Object.entries(ranked)
      .map(([venueId, r]) => ({ venueId, r, venue: venueById.get(venueId) }))
      .filter((x) => x.venue)
      .sort((a, b) => bucketOrder(a.r.bucket) - bucketOrder(b.r.bucket) || a.r.rankPosition - b.r.rankPosition);
  }, [ranked, venueById]);

  const summary = useMemo(() => {
    return generateTasteSummary(
      provisionalList.map(({ venue, r }) => ({
        venueId: venue!.id,
        venueName: venue!.name,
        bucket: r.bucket,
        ratingCoffee5: r.ratingCoffee5,
        ratingVibe5: r.ratingVibe5,
      })),
      3,
    );
  }, [provisionalList]);

  return (
    <div>
      <div style={{ ...MONO, color: TEXT_DIMMER, marginBottom: 12 }}>
        Step 3 · reveal
      </div>
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(28px, 4.5vw, 40px)",
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          marginBottom: 12,
        }}
      >
        Your provisional list
      </h2>
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          color: TEXT_MUTED,
          marginBottom: 24,
        }}
      >
        Where the venues you ranked sit on your map.
      </p>

      <ol
        style={{
          listStyle: "none",
          padding: 0,
          marginBottom: 32,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {provisionalList.map(({ venue, r }, idx) => (
          <li
            key={venue!.id}
            style={{
              padding: "12px 14px",
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              animation: `fadein 320ms ease ${idx * 80}ms both`,
            }}
          >
            <div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 17 }}>
                {venue!.name}
              </div>
              <div style={{ ...MONO, fontSize: 9, color: TEXT_DIMMER }}>
                {r.bucket.toUpperCase()} · COFFEE {r.ratingCoffee5}/5 · VIBE{" "}
                {r.ratingVibe5}/5
              </div>
            </div>
          </li>
        ))}
      </ol>

      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 22,
          fontWeight: 400,
          marginBottom: 12,
        }}
      >
        Your taste in three lines
      </h3>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          marginBottom: 32,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {summary.map((line) => (
          <li
            key={line.key}
            style={{
              padding: "10px 12px",
              borderLeft: `2px solid ${ACCENT}`,
              fontSize: 15,
              color: TEXT_PRIMARY,
              lineHeight: 1.55,
              fontStyle: "italic",
            }}
          >
            {line.text}
          </li>
        ))}
      </ul>

      <CoffeeIQ ranked={ranked} />

      <div style={{ marginTop: 32 }}>
        <PrimaryButton onClick={onContinue}>What&rsquo;s next →</PrimaryButton>
      </div>

      <style>{`@keyframes fadein { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }`}</style>
    </div>
  );
}

function CoffeeIQ({ ranked }: { ranked: Record<string, PrimingReviewSummary> }) {
  const reviewCount = Object.keys(ranked).length;
  // Display-only Coffee IQ derived from priming reviews. The pipeline
  // recomputes the real per-axis weights overnight; until then, surface a
  // proxy from the ratings the user just gave so the screen has substance.
  const avgCoffee =
    reviewCount === 0
      ? 0
      : Object.values(ranked).reduce((s, r) => s + r.ratingCoffee5, 0) /
        reviewCount;
  const avgVibe =
    reviewCount === 0
      ? 0
      : Object.values(ranked).reduce((s, r) => s + r.ratingVibe5, 0) /
        reviewCount;

  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 4,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ ...MONO, color: TEXT_DIMMER, marginBottom: 12 }}>
        Coffee IQ <ProvisionalBadge />
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        <Axis label="Coffee" value={avgCoffee} />
        <Axis label="Vibe" value={avgVibe} />
      </div>
      <p style={{ marginTop: 12, fontSize: 12, color: TEXT_DIMMER }}>
        Sharpens with each review.
      </p>
    </div>
  );
}

function Axis({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ ...MONO, color: TEXT_DIMMER, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, color: ACCENT }}>
        {value.toFixed(1)}
        <span style={{ fontSize: 14, color: TEXT_DIMMER }}>/5</span>
      </div>
    </div>
  );
}

export function ProvisionalBadge() {
  // TODO(PRD risk 4): A/B test "Provisional" vs "Calibrating" vs "Day 1"
  // vs "Bootstrapping" once feature-flag infra is in place.
  return (
    <span
      style={{
        ...MONO,
        fontSize: 9,
        padding: "2px 6px",
        borderRadius: 2,
        background: "rgba(241, 168, 113, 0.12)",
        color: ACCENT,
        marginLeft: 8,
      }}
    >
      Provisional
    </span>
  );
}

function NextStepsScreen({
  ranked,
  nextHref,
}: {
  ranked: Record<string, PrimingReviewSummary>;
  nextHref: string;
}) {
  const [matches, setMatches] = useState<
    Awaited<ReturnType<typeof getSimilarReviewersAndTryNext>> | null
  >(null);
  const [pending, startTransition] = useTransition();
  const [completing, setCompleting] = useState(false);
  const router = useRouter();
  const [wishlistAdded, setWishlistAdded] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    startTransition(async () => {
      const result = await getSimilarReviewersAndTryNext();
      setMatches(result);
    });
  }, []);

  const handleComplete = async () => {
    setCompleting(true);
    const result = await completeOnboarding();
    if (result.status === "ok") {
      router.push(nextHref);
    } else {
      setCompleting(false);
    }
  };

  const minMatches = Object.keys(ranked).length >= 3;

  return (
    <div>
      <div style={{ ...MONO, color: TEXT_DIMMER, marginBottom: 12 }}>
        Step 4 · what&rsquo;s next
      </div>
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(28px, 4.5vw, 40px)",
          fontWeight: 400,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          marginBottom: 12,
        }}
      >
        Three things to do next.
      </h2>

      <Section title="Reviewers like you">
        {pending && !matches ? (
          <Hint>Finding your matches…</Hint>
        ) : !minMatches ? (
          <Hint>
            Rank a few more venues and we&rsquo;ll find reviewers like you.
          </Hint>
        ) : matches && matches.matches.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {matches.matches.map((m) => (
              <div
                key={m.reviewerId}
                style={{
                  padding: "12px 14px",
                  borderRadius: 4,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 16 }}>
                    {m.displayName}
                  </div>
                  <div style={{ ...MONO, fontSize: 9, color: TEXT_DIMMER }}>
                    {Math.round(m.similarity * 100)}% taste match
                  </div>
                </div>
                {m.username && (
                  <Link
                    href={`/profile/${m.username}`}
                    style={{
                      ...MONO,
                      color: ACCENT,
                      textDecoration: "none",
                    }}
                  >
                    View →
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Hint>Your matches will appear once others have ranked more.</Hint>
        )}
      </Section>

      <Section title="Try next">
        {matches && matches.tryNext.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {matches.tryNext.map((v) => (
              <TryNextCard
                key={v.venueId}
                name={v.name}
                city={v.city}
                slug={v.slug}
                matchCount={v.matchCount}
                added={!!wishlistAdded[v.venueId]}
                onAdd={async () => {
                  const result = await addToWishlist(v.venueId);
                  if (result.status === "ok") {
                    setWishlistAdded((p) => ({ ...p, [v.venueId]: true }));
                  }
                }}
              />
            ))}
          </div>
        ) : (
          <Hint>
            Recommendations show up once we find a few similar reviewers.
          </Hint>
        )}
      </Section>

      <Section title="Log your next visit">
        <p style={{ fontSize: 14, color: TEXT_MUTED, lineHeight: 1.6 }}>
          When you&rsquo;re next at a café, head to{" "}
          <Link href="/venues" style={{ color: ACCENT }}>
            browse venues
          </Link>{" "}
          and add a review. Your Coffee IQ sharpens with each one.
        </p>
      </Section>

      <div style={{ marginTop: 36 }}>
        <PrimaryButton onClick={handleComplete} disabled={completing}>
          {completing ? "Saving…" : "Take me to my list →"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 20,
          fontWeight: 400,
          marginBottom: 10,
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 13,
        color: TEXT_DIMMER,
        fontStyle: "italic",
        lineHeight: 1.5,
      }}
    >
      {children}
    </p>
  );
}

function TryNextCard({
  name,
  city,
  slug,
  matchCount,
  added,
  onAdd,
}: {
  name: string;
  city: string;
  slug: string;
  matchCount: number;
  added: boolean;
  onAdd: () => void | Promise<void>;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 4,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div>
        <Link
          href={`/venues/${slug}`}
          style={{ color: TEXT_PRIMARY, textDecoration: "none" }}
        >
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 16 }}>
            {name}
          </div>
        </Link>
        <div style={{ ...MONO, fontSize: 9, color: TEXT_DIMMER }}>
          {city} · {matchCount} of your matches Pilgrimage&rsquo;d this
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={added}
        style={{
          ...MONO,
          height: 32,
          padding: "0 12px",
          background: added ? "transparent" : ACCENT,
          color: added ? TEXT_DIMMER : "hsl(20 14.3% 4%)",
          border: added
            ? "1px solid rgba(255,255,255,0.18)"
            : "none",
          borderRadius: 2,
          cursor: added ? "default" : "pointer",
        }}
      >
        {added ? "Saved" : "Save"}
      </button>
    </div>
  );
}

function PrimaryButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...MONO,
        height: 44,
        padding: "0 24px",
        background: ACCENT,
        color: "hsl(20 14.3% 4%)",
        border: "none",
        borderRadius: 2,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function bucketOrder(b: ReviewBucket): number {
  switch (b) {
    case "pilgrimage":
      return 0;
    case "detour":
      return 1;
    case "convenience":
      return 2;
  }
}

// ---------------------------------------------------------------------------
// Rank flow modal — consumes the existing tournament + sliders components.
// ---------------------------------------------------------------------------

function RankFlowModal({
  flow,
  venues,
  ranked,
  onCancel,
  onError,
  onSubmitted,
  onSetFlow,
}: {
  flow: NonNullable<RankFlowState>;
  venues: PrimingVenue[];
  ranked: Record<string, PrimingReviewSummary>;
  onCancel: () => void;
  onError: (msg: string | null) => void;
  onSubmitted: (venueId: string, summary: PrimingReviewSummary) => void;
  onSetFlow: (next: RankFlowState) => void;
}) {
  const [coffee, setCoffee] = useState<number | null>(null);
  const [vibe, setVibe] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reviews-by-bucket pseudo-data for the tournament. We fabricate Review
  // shapes from the ranked map; only id, venue_id, bucket, rank_position
  // are read by binary-tournament.
  const tournamentCandidates: Record<ReviewBucket, Review[]> = useMemo(() => {
    const out: Record<ReviewBucket, Review[]> = {
      pilgrimage: [],
      detour: [],
      convenience: [],
    };
    for (const [venueId, r] of Object.entries(ranked)) {
      out[r.bucket].push({
        id: r.reviewId,
        venue_id: venueId,
        reviewer_id: "",
        rating_overall: 0,
        rating_coffee_5: r.ratingCoffee5,
        rating_vibe_5: r.ratingVibe5,
        bucket: r.bucket,
        rank_position: r.rankPosition,
        body: "",
        visited_on: "",
        created_at: "",
        updated_at: "",
      });
    }
    for (const k of Object.keys(out) as ReviewBucket[]) {
      out[k].sort((a, b) => a.rank_position - b.rank_position);
    }
    return out;
  }, [ranked]);

  const candidateNamesByReviewId = useMemo(() => {
    const m: Record<string, string> = {};
    const venueById = new Map(venues.map((v) => [v.id, v]));
    for (const [venueId, r] of Object.entries(ranked)) {
      const v = venueById.get(venueId);
      if (v) m[r.reviewId] = v.name;
    }
    return m;
  }, [ranked, venues]);

  const close = () => {
    setCoffee(null);
    setVibe(null);
    onCancel();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) close();
      }}
    >
      <div
        style={{
          background: SHELL_BG,
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 4,
          padding: 28,
          maxWidth: 560,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ ...MONO, color: TEXT_DIMMER, marginBottom: 12 }}>
          Ranking · {flow.venue.name}
        </div>

        {flow.stage === "bucket" && (
          <>
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 24,
                fontWeight: 400,
                marginBottom: 16,
              }}
            >
              How does {flow.venue.name} stack up?
            </h3>
            <BucketSelector
              onSelect={(bucket) => {
                const candidates = tournamentCandidates[bucket] ?? [];
                if (candidates.length === 0) {
                  onSetFlow({
                    stage: "axes",
                    venue: flow.venue,
                    bucket,
                    tournament: { rankPosition: 1000, history: [] },
                  });
                } else {
                  onSetFlow({ stage: "tournament", venue: flow.venue, bucket });
                }
              }}
            />
          </>
        )}

        {flow.stage === "tournament" && (
          <PairwiseTournament
            bucket={flow.bucket}
            candidates={tournamentCandidates[flow.bucket] ?? []}
            candidateNames={candidateNamesByReviewId}
            newVenueName={flow.venue.name}
            onComplete={(result) =>
              onSetFlow({
                stage: "axes",
                venue: flow.venue,
                bucket: flow.bucket,
                tournament: result,
              })
            }
          />
        )}

        {flow.stage === "axes" && (
          <>
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                fontWeight: 400,
                marginBottom: 16,
              }}
            >
              Coffee and vibe
            </h3>
            <TwoAxisSliders
              coffee={coffee}
              vibe={vibe}
              onChange={(next) => {
                if (next.coffee !== undefined) setCoffee(next.coffee);
                if (next.vibe !== undefined) setVibe(next.vibe);
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 24,
              }}
            >
              <GhostButton onClick={close} disabled={submitting}>
                Cancel
              </GhostButton>
              <PrimaryButton
                disabled={coffee === null || vibe === null || submitting}
                onClick={async () => {
                  if (coffee === null || vibe === null) return;
                  setSubmitting(true);
                  onError(null);
                  const result = await submitRankedReview(
                    {
                      venue_id: flow.venue.id,
                      visited_on: new Date().toISOString().slice(0, 10),
                      bucket: flow.bucket,
                      rank_position: flow.tournament.rankPosition,
                      history: flow.tournament.history,
                      rating_coffee_5: coffee,
                      rating_vibe_5: vibe,
                      body: "",
                    },
                    { slug: flow.venue.slug },
                  );
                  setSubmitting(false);
                  if (result.status === "ok") {
                    onSubmitted(flow.venue.id, {
                      reviewId: result.reviewId,
                      bucket: flow.bucket,
                      ratingCoffee5: coffee,
                      ratingVibe5: vibe,
                      rankPosition: result.finalRank,
                    });
                    setCoffee(null);
                    setVibe(null);
                  } else {
                    onError(result.message);
                  }
                }}
              >
                {submitting ? "Saving…" : "Save ranking"}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GhostButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...MONO,
        height: 36,
        padding: "0 18px",
        background: "transparent",
        color: TEXT_PRIMARY,
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 2,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
