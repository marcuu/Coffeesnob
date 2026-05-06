import type { SupabaseClient } from "@supabase/supabase-js";

import type { ComparisonHistory, ReviewBucket } from "@/lib/types";

export async function buildSyntheticComparisonHistory(
  supabase: SupabaseClient,
  reviewerId: string,
  bucket: ReviewBucket,
  preference: number,
): Promise<ComparisonHistory> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rank_position, simulation_review_metadata(preference_score)")
    .eq("reviewer_id", reviewerId)
    .eq("bucket", bucket)
    .order("rank_position", { ascending: true });
  if (error) throw error;

  const candidates = ((data ?? []) as Array<{
    id: string;
    rank_position: number;
    simulation_review_metadata?: { preference_score: number }[] | { preference_score: number } | null;
  }>).map((r) => {
    const meta = Array.isArray(r.simulation_review_metadata)
      ? r.simulation_review_metadata[0]
      : r.simulation_review_metadata;
    return { id: r.id, preference: Number(meta?.preference_score ?? 0) };
  });

  let lo = 0;
  let hi = candidates.length;
  const history: ComparisonHistory = [];
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const against = candidates[mid];
    const result = preference >= against.preference ? "better" : "worse";
    history.push({ against_review_id: against.id, result, step_index: history.length });
    if (result === "better") hi = mid;
    else lo = mid + 1;
  }
  return history;
}
