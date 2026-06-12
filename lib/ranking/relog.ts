import type { Review } from "@/lib/types";

/**
 * Places a quick re-log immediately after the user's prior review of the
 * same venue, so the venue's standing in the bucket is preserved without
 * re-running the tournament. If the prior review has since moved bucket or
 * been deleted, the list has changed under us and the new review appends to
 * the end instead.
 */
export function relogPlacement(
  bucketReviews: Review[],
  relogOf: string,
  venueId: string,
): { rankPosition: number; listChanged: boolean } {
  const prior = bucketReviews.find(
    (r) => r.id === relogOf && r.venue_id === venueId,
  );
  if (prior) {
    return { rankPosition: prior.rank_position + 1, listChanged: false };
  }
  const lastRank = bucketReviews
    .map((r) => r.rank_position)
    .reduce((a, b) => Math.max(a, b), 0);
  return { rankPosition: lastRank + 1000, listChanged: true };
}
