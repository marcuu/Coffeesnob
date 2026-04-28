"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

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
}: {
  bucket: ReviewBucket;
  candidates: Review[];
  candidateNames: CandidateNames;
  newVenueName: string;
  onComplete: (result: PairwiseResult) => void;
}) {
  const [state, setState] = useState<TournamentState>(() =>
    startTournament(candidates),
  );
  const [step, setStep] = useState(0);
  const next = useMemo(() => nextComparison(state), [state]);
  const totalEstimate = useMemo(
    () => Math.max(1, Math.ceil(Math.log2(candidates.length + 1))),
    [candidates.length],
  );

  // Empty bucket: converge immediately. Run as an effect so the parent
  // doesn't see the component flash a head-to-head it can't render.
  useEffect(() => {
    if (!next) {
      onComplete({
        rankPosition: finalRankPosition(state),
        history: state.history,
      });
    }
    // We only ever fire once per state change; onComplete is stable enough
    // for our usage but listed to keep eslint quiet in strict mode.
  }, [next, state, onComplete]);

  if (!next) return null;

  const handle = (result: Comparison) => {
    setState((s) => recordComparison(s, result));
    setStep((s) => s + 1);
  };

  const otherName = candidateNames[next.id] ?? "another venue";

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
      <div style={{ ...MONO, fontSize: 9, color: "hsl(24 5.4% 40%)" }}>
        Comparison {step + 1} of ~{totalEstimate} · {bucket}
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

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 4,
        }}
      >
        <Choice label="Better" onClick={() => handle("better")} primary />
        <Choice
          label="About the same"
          onClick={() => handle("same")}
        />
        <Choice label="Worse" onClick={() => handle("worse")} />
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

function Choice({
  label,
  onClick,
  primary,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...MONO,
        height: 44,
        padding: "0 18px",
        background: primary ? "oklch(0.75 0.11 44)" : "transparent",
        color: primary ? "hsl(20 14.3% 4%)" : "hsl(60 9.1% 97.8%)",
        border: primary ? "none" : "1px solid rgba(255,255,255,0.18)",
        borderRadius: 2,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {label}
    </button>
  );
}
