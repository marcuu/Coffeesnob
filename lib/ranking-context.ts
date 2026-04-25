import type { OverallScoreSummary } from "@/lib/aggregation";
import { getScoreDisplay } from "@/lib/scoring-display";
import type { ScoreDisplayTone } from "@/lib/scoring-display";

export type { ScoreDisplayTone };

export type VenueRankingSummary = {
  rank: number | null;
  scopeLabel: string;
  formattedScore: string;
  scoreLabel: string;
  scoreDescription: string;
  scoreTone: ScoreDisplayTone;
  signalLabel: string;
  displayable: boolean;
  rawReviewCount: number;
  isUnranked: boolean;
  reviewPrompt: string;
};

function computeSignalLabel(
  confidence: number | undefined,
  isUnranked: boolean,
): string {
  if (isUnranked) return "Needs signal";
  if (confidence == null) return "Low signal";
  if (confidence >= 0.7) return "High signal";
  if (confidence >= 0.4) return "Good signal";
  return "Low signal";
}

/**
 * Builds the full ranking summary for a single venue, given pre-fetched score
 * data and a pre-computed rank.
 *
 * `scoreEntry` comes from getVenueOverallScores; `rank` comes from
 * buildRankMap. Both are scoped to whatever venue set was used (UK or region).
 */
export function buildVenueRankingSummary(
  venueId: string,
  scoreEntry: OverallScoreSummary | undefined,
  rank: number | null,
  scopeLabel: string,
): VenueRankingSummary {
  const sd = getScoreDisplay(
    scoreEntry?.score ?? null,
    scoreEntry?.displayable ?? false,
  );
  const rawReviewCount = scoreEntry?.rawReviewCount ?? 0;
  const isUnranked = !sd.displayable;
  const signalLabel = computeSignalLabel(scoreEntry?.confidence, isUnranked);

  const reviewPrompt = isUnranked
    ? rawReviewCount === 0
      ? "No reviews yet."
      : "Needs more trusted reviews to enter the rankings."
    : "Think this ranking is wrong? Add your review.";

  return {
    rank,
    scopeLabel,
    formattedScore: sd.formattedScore,
    scoreLabel: sd.label,
    scoreDescription: sd.description,
    scoreTone: sd.tone,
    signalLabel,
    displayable: sd.displayable,
    rawReviewCount,
    isUnranked,
    reviewPrompt,
  };
}

/**
 * Builds a venue-id → rank map from a scores map.
 * Only displayable venues receive a rank; order is score descending.
 */
export function buildRankMap(
  scores: Map<string, OverallScoreSummary>,
): Map<string, number> {
  const ranked = Array.from(scores.entries())
    .filter(([, s]) => s.displayable)
    .sort(([, a], [, b]) => b.score - a.score);
  return new Map(ranked.map(([id], i) => [id, i + 1]));
}

/**
 * Returns the rank of a single venue within a scores map, or null if unranked.
 */
export function computeRank(
  venueId: string,
  scores: Map<string, OverallScoreSummary>,
): number | null {
  return buildRankMap(scores).get(venueId) ?? null;
}
