"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { BucketSelector } from "@/components/review/bucket-selector";
import {
  PairwiseTournament,
  type PairwiseResult,
} from "@/components/review/pairwise-tournament";
import { ReviewSubmitReveal } from "@/components/review/review-submit-reveal";
import { TwoAxisSliders } from "@/components/review/two-axis-sliders";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics";
import type { Review, ReviewBucket } from "@/lib/types";

import { submitRankedReview, type SubmitRankedReviewResult } from "./actions";

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type Stage =
  | { kind: "bucket" }
  | { kind: "tournament"; bucket: ReviewBucket }
  | { kind: "axes"; bucket: ReviewBucket; tournament: PairwiseResult }
  | { kind: "notes"; bucket: ReviewBucket; tournament: PairwiseResult }
  | {
      kind: "reveal";
      bucket: ReviewBucket;
      finalRank: number;
      bucketSize: number;
      list_changed?: boolean;
    };

export function ReviewForm({
  venueId,
  slug,
  venueName,
  venueCity,
  venueNeighbourhood,
  reviewsByBucket,
  candidateNamesByReviewId,
  handle,
}: {
  venueId: string;
  slug: string;
  venueName: string;
  venueCity?: string;
  venueNeighbourhood?: string;
  reviewsByBucket: Record<ReviewBucket, Review[]>;
  candidateNamesByReviewId: Record<string, string>;
  handle?: string;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "bucket" });
  // No defaults: spec requires user to explicitly choose both axes before
  // they can submit. null = untouched.
  const [coffee, setCoffee] = useState<number | null>(null);
  const [vibe, setVibe] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [visitedOn, setVisitedOn] = useState(today());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleBucket = (bucket: ReviewBucket) => {
    track({ name: "bucket_selected", bucket });
    const candidates = reviewsByBucket[bucket] ?? [];
    if (candidates.length === 0) {
      // No tournament needed; treat as already converged.
      setStage({
        kind: "axes",
        bucket,
        tournament: { rankPosition: 1000, history: [] },
      });
    } else {
      track({ name: "tournament_started", bucket_size: candidates.length });
      setStage({ kind: "tournament", bucket });
    }
  };

  const handleTournamentComplete = (
    bucket: ReviewBucket,
    result: PairwiseResult,
  ) => {
    setStage({ kind: "axes", bucket, tournament: result });
  };

  const submit = (
    bucket: ReviewBucket,
    tournament: PairwiseResult,
  ) => {
    if (coffee === null || vibe === null) {
      setSubmitError("Pick a coffee and vibe rating before submitting.");
      return;
    }
    setSubmitError(null);
    startTransition(async () => {
      const result: SubmitRankedReviewResult = await submitRankedReview(
        {
          venue_id: venueId,
          visited_on: visitedOn,
          bucket,
          rank_position: tournament.rankPosition,
          history: tournament.history,
          rating_coffee_5: coffee,
          rating_vibe_5: vibe,
          body,
        },
        { slug },
      );
      if (result.status === "ok") {
        setStage({
          kind: "reveal",
          bucket,
          finalRank: rankIndexFromPosition(
            result.finalRank,
            reviewsByBucket[bucket] ?? [],
          ),
          bucketSize: result.bucketSize,
          list_changed: result.list_changed,
        });
      } else {
        setSubmitError(result.message);
      }
    });
  };

  if (stage.kind === "reveal") {
    return (
      <ReviewSubmitReveal
        venueName={venueName}
        bucket={stage.bucket}
        finalRank={stage.finalRank}
        bucketSize={stage.bucketSize}
        listChanged={stage.list_changed}
        backHref={`/venues/${slug}`}
        handle={handle}
        coffee={coffee ?? undefined}
        vibe={vibe ?? undefined}
      />
    );
  }

  const locationLine = [venueNeighbourhood, venueCity].filter(Boolean).join(", ");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div
        style={{
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Link
          href={`/venues/${slug}`}
          style={{ ...MONO, color: "hsl(24 5.4% 52%)", textDecoration: "none" }}
        >
          ← {venueName}
        </Link>
        <div style={{ ...MONO, fontSize: 11, color: "hsl(24 5.4% 42%)" }}>
          {stageLabel(stage)}
        </div>
      </div>

      {/* Persistent venue context — visible on every step so users always
          know which venue they're reviewing */}
      <div
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 15,
            color: "hsl(60 9.1% 92%)",
            letterSpacing: "-0.01em",
          }}
        >
          {venueName}
        </div>
        {locationLine && (
          <div style={{ ...MONO, fontSize: 11, color: "hsl(24 5.4% 48%)" }}>
            {locationLine}
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "28px 24px",
        }}
      >
        {stage.kind === "bucket" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", maxWidth: 480 }}>
            <div>
              <div style={{ ...MONO, fontSize: 11, color: "hsl(24 5.4% 40%)", marginBottom: 12 }}>
                Where does it land?
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "clamp(24px,4vw,36px)",
                  fontWeight: 400,
                  color: "hsl(60 9.1% 97.8%)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                  marginBottom: 18,
                }}
              >
                How does {venueName} stack up?
              </h2>
            </div>
            <BucketSelector onSelect={handleBucket} />
          </div>
        )}

        {stage.kind === "tournament" && (
          <PairwiseTournament
            bucket={stage.bucket}
            candidates={reviewsByBucket[stage.bucket] ?? []}
            candidateNames={candidateNamesByReviewId}
            newVenueName={venueName}
            onComplete={(result) => handleTournamentComplete(stage.bucket, result)}
            onBack={() => setStage({ kind: "bucket" })}
          />
        )}

        {stage.kind === "axes" && (
          <div style={{ width: "100%", maxWidth: 480 }}>
            <div style={{ ...MONO, fontSize: 11, color: "hsl(24 5.4% 40%)", marginBottom: 14 }}>
              Score it
            </div>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(24px,4vw,36px)",
                fontWeight: 400,
                color: "hsl(60 9.1% 97.8%)",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                marginBottom: 12,
              }}
            >
              Coffee and vibe
            </h2>
            <p style={{ fontSize: 14, color: "hsl(24 5.4% 52%)", lineHeight: 1.7, marginBottom: 28 }}>
              Two scores, both required. Coffee is the cup itself; vibe is everything around it.
            </p>

            <TwoAxisSliders
              coffee={coffee}
              vibe={vibe}
              onChange={(next) => {
                if (next.coffee !== undefined) setCoffee(next.coffee);
                if (next.vibe !== undefined) setVibe(next.vibe);
              }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
              <NavButton
                variant="ghost"
                onClick={() => {
                  const hasCandidates =
                    (reviewsByBucket[stage.bucket] ?? []).length > 0;
                  setStage(
                    hasCandidates
                      ? { kind: "tournament", bucket: stage.bucket }
                      : { kind: "bucket" },
                  );
                }}
              >
                ← Back
              </NavButton>
              <NavButton
                onClick={() => {
                  if (coffee === null || vibe === null) return;
                  track({ name: "axes_completed", coffee, vibe });
                  setStage({ kind: "notes", bucket: stage.bucket, tournament: stage.tournament });
                }}
                disabled={coffee === null || vibe === null}
              >
                Next →
              </NavButton>
            </div>
          </div>
        )}

        {stage.kind === "notes" && (
          <NotesStep
            visitedOn={visitedOn}
            setVisitedOn={setVisitedOn}
            body={body}
            setBody={setBody}
            error={submitError}
            pending={pending}
            onBack={() =>
              setStage({
                kind: "axes",
                bucket: stage.bucket,
                tournament: stage.tournament,
              })
            }
            onSubmit={() => submit(stage.bucket, stage.tournament)}
          />
        )}
      </div>
    </div>
  );
}

function rankIndexFromPosition(rankPosition: number, bucketReviews: Review[]): number {
  // 1-based rank within the bucket including the new review. We don't have
  // the post-insert positions here, so approximate from the existing list:
  // count the items strictly above rankPosition and add 1.
  const above = bucketReviews.filter((r) => r.rank_position < rankPosition).length;
  return above + 1;
}

function stageLabel(stage: Stage): string {
  switch (stage.kind) {
    case "bucket":
      return "Step 1 · bucket";
    case "tournament":
      return "Step 2 · ranking";
    case "axes":
      return "Step 3 · scores";
    case "notes":
      return "Step 4 · notes";
    default:
      return "";
  }
}

function NotesStep({
  visitedOn,
  setVisitedOn,
  body,
  setBody,
  error,
  pending,
  onBack,
  onSubmit,
}: {
  visitedOn: string;
  setVisitedOn: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
  error: string | null;
  pending: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div style={{ width: "100%", maxWidth: 480 }}>
      <div style={{ ...MONO, fontSize: 11, color: "hsl(24 5.4% 40%)", marginBottom: 14 }}>
        Notes
      </div>
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(24px,4vw,36px)",
          fontWeight: 400,
          color: "hsl(60 9.1% 97.8%)",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          marginBottom: 20,
        }}
      >
        Any notes to add?
      </h2>

      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="visited_on"
          style={{ ...MONO, fontSize: 11, color: "hsl(24 5.4% 40%)", display: "block", marginBottom: 8 }}
        >
          Visited on
        </label>
        <input
          id="visited_on"
          type="date"
          required
          value={visitedOn}
          max={today()}
          onChange={(e) => setVisitedOn(e.target.value)}
          style={{
            height: 36,
            padding: "0 12px",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 2,
            background: "rgba(255,255,255,0.04)",
            color: "hsl(60 9.1% 97.8%)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            colorScheme: "dark",
          }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label
          htmlFor="body"
          style={{ ...MONO, fontSize: 11, color: "hsl(24 5.4% 40%)", display: "block", marginBottom: 8 }}
        >
          Review (optional, max 5000 characters)
        </label>
        <Textarea
          id="body"
          maxLength={5000}
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="How was the coffee?"
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 2,
            background: "rgba(255,255,255,0.04)",
            color: "hsl(60 9.1% 97.8%)",
            fontSize: 14,
            resize: "vertical",
          }}
        />
      </div>

      {error ? (
        <p style={{ marginBottom: 12, fontSize: 13, color: "hsl(0 84.2% 60.2%)" }}>{error}</p>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <NavButton onClick={onBack} variant="ghost" disabled={pending}>
          ← Back
        </NavButton>
        <NavButton
          onClick={onSubmit}
          disabled={pending}
        >
          {pending ? "Posting…" : "Submit review"}
        </NavButton>
      </div>
    </div>
  );
}

function NavButton({
  children,
  onClick,
  variant = "primary",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost";
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
        padding: "0 24px",
        background: variant === "primary" ? "oklch(0.75 0.11 44)" : "transparent",
        color: variant === "primary" ? "hsl(20 14.3% 4%)" : "hsl(60 9.1% 97.8%)",
        border: variant === "primary" ? "none" : "1px solid rgba(255,255,255,0.18)",
        borderRadius: 2,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
