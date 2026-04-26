/**
 * Pure helper for rendering venue scores in the UI.
 *
 * Isolated from the scoring pipeline so display format (10-point vs 5-point)
 * can be changed here without touching aggregation or ranking logic.
 */

export type ScoreDisplayTone =
  | "exceptional"
  | "outstanding"
  | "excellent"
  | "strong"
  | "good"
  | "ranked"
  | "unranked";

export type ScoreDisplay = {
  formattedScore: string;
  label: string;
  description: string;
  tone: ScoreDisplayTone;
  displayable: boolean;
};

const UNRANKED: ScoreDisplay = {
  formattedScore: "—",
  label: "Unranked",
  description: "Insufficient signal to rank",
  tone: "unranked",
  displayable: false,
};

/**
 * Returns display metadata for a venue score.
 *
 * Pass `displayable: false` (or null score) for venues that haven't yet
 * accumulated enough trusted reviews to enter the rankings.
 */
export function getScoreDisplay(
  score: number | null | undefined,
  displayable: boolean,
): ScoreDisplay {
  if (!displayable || score == null) return UNRANKED;

  const formattedScore = score.toFixed(1);

  if (score >= 9.0) {
    return {
      formattedScore,
      label: "Exceptional",
      description: "Among the very best in the UK",
      tone: "exceptional",
      displayable: true,
    };
  }
  if (score >= 8.5) {
    return {
      formattedScore,
      label: "Outstanding",
      description: "Truly excellent coffee",
      tone: "outstanding",
      displayable: true,
    };
  }
  if (score >= 8.0) {
    return {
      formattedScore,
      label: "Excellent",
      description: "Highly recommended",
      tone: "excellent",
      displayable: true,
    };
  }
  if (score >= 7.5) {
    return {
      formattedScore,
      label: "Strong",
      description: "Well above average",
      tone: "strong",
      displayable: true,
    };
  }
  if (score >= 7.0) {
    return {
      formattedScore,
      label: "Good",
      description: "Above average",
      tone: "good",
      displayable: true,
    };
  }

  return {
    formattedScore,
    label: "Ranked",
    description: "In the rankings",
    tone: "ranked",
    displayable: true,
  };
}
