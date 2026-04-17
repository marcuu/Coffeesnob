import type { Venue } from "@/lib/types";

export type VenueSummary = Venue & {
  review_count: number;
  avg_overall: number | null;
};

// Given the shape returned by
//   supabase.from("venues").select("*, reviews(rating_overall)")
// compute aggregate stats for display.
export function summariseVenue(
  row: Venue & { reviews: { rating_overall: number }[] | null },
): VenueSummary {
  const ratings = row.reviews ?? [];
  const count = ratings.length;
  const avg =
    count === 0
      ? null
      : ratings.reduce((s, r) => s + r.rating_overall, 0) / count;

  const { reviews: _reviews, ...venue } = row;
  return { ...venue, review_count: count, avg_overall: avg };
}

export function formatRating(avg: number | null): string {
  return avg === null ? "—" : avg.toFixed(1);
}
