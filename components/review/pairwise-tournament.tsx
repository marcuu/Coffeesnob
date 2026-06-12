"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import {
  finalRankPosition,
  nextComparison,
  recordComparison,
  startTournament,
  type Comparison,
  type TournamentState,
} from "@/lib/ranking/binary-tournament";
import type { ComparisonHistory, Review, ReviewBucket } from "@/lib/types";

const MONO: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

// We need the venue name for each candidate review to render the head-to-head.
// The page resolves names server-side and hands them as a separate map; we
// fall back to the review id if a name is missing.
type CandidateNames = Record<string, string>;

export type PairwiseResult = {
  rankPosition: number;
  history: ComparisonHistory;
};

export function PairwiseTournament({
  bucket,
  candidates,
  candidateNames,
  newVenueName,
  onComplete,
  onBack,
}: {
  bucket: ReviewBucket;
  candidates: Review[];
  candidateNames: CandidateNames;
  newVenueName: string;
  onComplete: (result: PairwiseResult) => void;
  onBack?: () => void;
}) {
  const [state, setState] = useState<TournamentState>(() =>
    startTournament(candidates),
  );
  // History stack for back-step: each entry is the state before a comparison.
  const [stateHistory, setStateHistory] = useState<TournamentState[]>([]);
  const [step, setStep] = useState(0);
  const startedAtRef = useRef<number>(Date.now());
  const trackedStartRef = useRef(false);
  const next = useMemo(() => nextComparison(state), [state]);
  const totalEstimate = useMemo(
    () => Math.max(1, Math.ceil(Math.log2(candidates.length + 1))),
    [candidates.length],
  );

  useEffect(() => {
    if (!trackedStartRef.current) {
      trackedStartRef.current = true;
      track({ name: "tournament_started", bucket_size: candidates.length });
    }
  }, [candidates.length]);

  useEffect(() => {
    if (!next) {
      const final = finalRankPosition(state);
      track({
        name: "tournament_completed",
        bucket,
        comparisons_count: state.history.length,
        duration_ms: Date.now() - startedAtRef.current,
        final_rank: final,
      });
      onComplete({
        rankPosition: final,
        history: state.history,
      });
    }
  }, [next, state, onComplete, bucket]);

  if (!next) return null;

  const handle = (result: Comparison) => {
    const button =
      result === "better"
        ? "new_venue"
        : result === "worse"
          ? "comparison_venue"
          : "same";
    track({ name: "tournament_comparison_made", step_index: step, result });
    track({ name: "tournament_button_tap", button });
    setStateHistory((h) => [...h, state]);
    setState((s) => recordComparison(s, result));
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (stateHistory.length === 0) {
      onBack?.();
      return;
    }
    track({ name: "tournament_back_step_used" });
    const prev = stateHistory[stateHistory.length - 1];
    setStateHistory((h) => h.slice(0, -1));
    setState(prev);
    setStep((s) => s - 1);
  };

  const otherName = candidateNames[next.id] ?? "another venue";
  const canGoBack = stateHistory.length > 0 || !!onBack;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        width: "100%",
        maxWidth: 520,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {canGoBack && (
          <button
            type="button"
            onClick={handleBack}
            style={{
              ...MONO,
              fontSize: 11,
              color: "hsl(24 5.4% 40%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              letterSpacing: "0.18em",
            }}
          >
            ← Back
          </button>
        )}
        <div style={{ ...MONO, fontSize: 11, color: "hsl(24 5.4% 40%)" }}>
          Comparison {step + 1} of ~{totalEstimate} · {bucket}
        </div>
      </div>

      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "clamp(22px,3.4vw,30px)",
          fontWeight: 400,
          color: "hsl(60 9.1% 97.8%)",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          marginBottom: 4,
        }}
      >
        Which one wins?
      </h2>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${next.id}-${step}`}
          initial={{ opacity: 0, rotateY: -10 }}
          animate={{ opacity: 1, rotateY: 0 }}
          exit={{ opacity: 0, rotateY: 10 }}
          transition={{ duration: 0.2 }}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            perspective: 800,
          }}
        >
          <Card name={newVenueName} tag="NEW" />
          <Card name={otherName} tag="EXISTING" />
        </motion.div>
      </AnimatePresence>

      {/* Venue-named buttons: left = new venue (better), middle = same, right = comparison */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 8,
          marginTop: 4,
        }}
      >
        <VenueButton
          name={newVenueName}
          onClick={() => handle("better")}
          variant="primary"
          testId="tournament-btn-better"
        />
        <button
          type="button"
          data-testid="tournament-btn-same"
          onClick={() => handle("same")}
          style={{
            ...MONO,
            minHeight: 56,
            padding: "0 14px",
            background: "transparent",
            color: "hsl(24 5.4% 52%)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 2,
            cursor: "pointer",
            fontSize: 11,
            whiteSpace: "nowrap",
          }}
        >
          About the same
        </button>
        <VenueButton
          name={otherName}
          onClick={() => handle("worse")}
          variant="ghost"
          testId="tournament-btn-worse"
        />
      </div>
    </div>
  );
}

function Card({ name, tag }: { name: string; tag: string }) {
  return (
    <div
      style={{
        padding: "20px 16px",
        borderRadius: 4,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.1)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 120,
      }}
    >
      <span style={{ ...MONO, color: "hsl(24 5.4% 52%)" }}>{tag}</span>
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 20,
          color: "hsl(60 9.1% 97.8%)",
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
        }}
      >
        {name}
      </span>
    </div>
  );
}

// Max chars before truncating the venue name on a button.
const NAME_TRUNCATE_AT = 28;

function VenueButton({
  name,
  onClick,
  variant,
  testId,
}: {
  name: string;
  onClick: () => void;
  variant: "primary" | "ghost";
  testId?: string;
}) {
  const truncated =
    name.length > NAME_TRUNCATE_AT
      ? name.slice(0, NAME_TRUNCATE_AT - 1) + "…"
      : name;
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      title={name.length > NAME_TRUNCATE_AT ? name : undefined}
      style={{
        ...MONO,
        minHeight: 56,
        padding: "8px 14px",
        background:
          variant === "primary" ? "oklch(0.75 0.11 44)" : "transparent",
        color:
          variant === "primary"
            ? "hsl(20 14.3% 4%)"
            : "hsl(60 9.1% 97.8%)",
        border:
          variant === "primary" ? "none" : "1px solid rgba(255,255,255,0.18)",
        borderRadius: 2,
        cursor: "pointer",
        textAlign: "center",
        wordBreak: "break-word",
        lineHeight: 1.4,
        fontSize: 10,
      }}
    >
      {truncated}
    </button>
  );
}
