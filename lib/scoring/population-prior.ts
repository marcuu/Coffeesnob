// Display-time helper for the real-reviewer-only credibility prior used in
// applyColdStartSmoothing. Excludes synthetic reviewers so the calibration
// baseline reflects human behaviour only. See docs/scoring.md §"Dual-Population".
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Axis } from "./weights";

export async function fetchRealReviewerWeightPrior(
  sb: SupabaseClient,
  axis: Axis,
): Promise<number> {
  const { data, error } = await sb
    .from("reviewer_axis_weights")
    .select("weight, reviewers!inner(is_synthetic)")
    .eq("axis", axis)
    .eq("reviewers.is_synthetic", false);
  if (error) throw error;

  const weights = (data ?? []).map(
    (r: { weight: number }) => Number(r.weight),
  );
  if (weights.length === 0) return 1.0;
  return weights.reduce((a, b) => a + b, 0) / weights.length;
}
