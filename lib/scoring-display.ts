/**
 * Pure helpers for rendering venue scores in the UI.
 *
 * Isolated from the scoring pipeline so display format can be changed here
 * without touching aggregation or ranking logic. This is the *portrayal*
 * layer: it decides how settled a score is and therefore how precisely — and
 * with how much typographic authority — it may be shown.
 *
 * The headline rule (PRD Workstream B): "You cannot render a decimal you
 * haven't earned." Precision is a claim about certainty, so display precision
 * scales with the venue's maturity.
 */

import { SCORING_CONSTANTS } from "@/lib/scoring/weights";

export type ScoreDisplayTone =
  | "exceptional"
  | "outstanding"
  | "excellent"
  | "strong"
  | "good"
  | "ranked"
  | "unranked";

/**
 * How settled a venue's score is. Derived from the existing confidence /
 * displayable signals — never recomputed in components (PRD A3).
 *
 *  - `forming`     — not yet displayable; not enough trusted reviews.
 *  - `provisional` — displayable, but confidence < SETTLED_CONFIDENCE_THRESHOLD.
 *                    The default surface at cohort scale. Shown coarsely.
 *  - `settled`     — confidence ≥ SETTLED_CONFIDENCE_THRESHOLD. Full precision.
 */
export type VenueMaturity = "forming" | "provisional" | "settled";

/** Typographic authority a score may claim, mirroring its maturity. */
export type ScoreEmphasis = "full" | "muted" | "none";

export type ScoreDisplay = {
  /** Score text to render: "8.4" (settled), "7" (provisional), or "—". */
  formattedScore: string;
  maturity: VenueMaturity;
  label: string;
  description: string;
  tone: ScoreDisplayTone;
  /** Whether a number should be shown at all. False only for `forming`. */
  displayable: boolean;
  emphasis: ScoreEmphasis;
};

/**
 * The single source of truth mapping a venue aggregate to a maturity state
 * (PRD A2). `displayable` is the forming→provisional boundary (today's
 * "not enough trusted reviews" gate); SETTLED_CONFIDENCE_THRESHOLD is the
 * provisional→settled boundary.
 */
export function deriveMaturity(input: {
  displayable: boolean;
  confidence: number | null | undefined;
}): VenueMaturity {
  if (!input.displayable) return "forming";
  const confidence = input.confidence ?? 0;
  return confidence >= SCORING_CONSTANTS.SETTLED_CONFIDENCE_THRESHOLD
    ? "settled"
    : "provisional";
}

const FORMING: ScoreDisplay = {
  formattedScore: "—",
  maturity: "forming",
  label: "Forming",
  description: "Not enough trusted reviews yet.",
  tone: "unranked",
  displayable: false,
  emphasis: "none",
};

function toneFor(score: number): { tone: ScoreDisplayTone; label: string; description: string } {
  if (score >= 9.0)
    return { tone: "exceptional", label: "Exceptional", description: "Among the very best in the UK" };
  if (score >= 8.5)
    return { tone: "outstanding", label: "Outstanding", description: "Truly excellent coffee" };
  if (score >= 8.0)
    return { tone: "excellent", label: "Excellent", description: "Highly recommended" };
  if (score >= 7.5)
    return { tone: "strong", label: "Strong", description: "Well above average" };
  if (score >= 7.0)
    return { tone: "good", label: "Good", description: "Above average" };
  return { tone: "ranked", label: "Ranked", description: "In the rankings" };
}

/**
 * Returns display metadata for a venue score, governed by its maturity.
 *
 * Precision scales with confidence:
 *  - `forming`     → no number; a "not enough reviews" label.
 *  - `provisional` → coarse whole number (e.g. "7"). Never a decimal — a
 *                    decimal would claim precision the evidence can't support.
 *                    Uncertainty is carried by the `Provisional` tag and the
 *                    muted typographic treatment, not by the number itself.
 *  - `settled`     → full precision, one decimal (e.g. "8.4"). The decimal is
 *                    earned: gaining it is the provisional→settled moment.
 */
export function getScoreDisplay(
  score: number | null | undefined,
  maturity: VenueMaturity,
): ScoreDisplay {
  if (maturity === "forming" || score == null) return FORMING;

  const { tone, label, description } = toneFor(score);

  if (maturity === "provisional") {
    return {
      formattedScore: `${Math.round(score)}`,
      maturity: "provisional",
      label,
      description,
      tone,
      displayable: true,
      emphasis: "muted",
    };
  }

  return {
    formattedScore: score.toFixed(1),
    maturity: "settled",
    label,
    description,
    tone,
    displayable: true,
    emphasis: "full",
  };
}
