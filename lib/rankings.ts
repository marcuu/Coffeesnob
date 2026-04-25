import type { OverallScoreSummary } from "@/lib/aggregation";
import type { Venue } from "@/lib/types";

export type RankedVenue = {
  venue: Venue;
  rank: number;
  score: number;
  reviewCount: number;
};

export type UnrankedVenue = {
  venue: Venue;
  reviewCount: number;
};

export type RankingResult = {
  ranked: RankedVenue[];
  unranked: UnrankedVenue[];
};

/**
 * Splits venues into ranked and unranked groups, assigns rank numbers, and
 * sorts each group. Does not touch the scoring pipeline.
 *
 * Ranked: venues where the overall score is displayable, sorted by score desc.
 * Unranked: all others, sorted by review count desc then name asc.
 */
export function buildRankings(
  venues: Venue[],
  weightedScores: Map<string, OverallScoreSummary>,
): RankingResult {
  const rankedUnsorted: { venue: Venue; score: number; reviewCount: number }[] =
    [];
  const unranked: UnrankedVenue[] = [];

  for (const venue of venues) {
    const ws = weightedScores.get(venue.id);
    if (ws?.displayable) {
      rankedUnsorted.push({
        venue,
        score: ws.score,
        reviewCount: ws.rawReviewCount,
      });
    } else {
      unranked.push({ venue, reviewCount: ws?.rawReviewCount ?? 0 });
    }
  }

  rankedUnsorted.sort((a, b) => b.score - a.score);

  unranked.sort((a, b) => {
    if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
    return a.venue.name.localeCompare(b.venue.name);
  });

  return {
    ranked: rankedUnsorted.map((r, i) => ({ ...r, rank: i + 1 })),
    unranked,
  };
}
