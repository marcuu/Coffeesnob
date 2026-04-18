import type { SupabaseClient } from "@supabase/supabase-js";

import type { Axis } from "@/lib/scoring/weights";

export type AxisScore = {
  score: number;
  confidence: number;
  reviewCount: number;
};

export type VenueScores = {
  axes: Partial<Record<Axis, AxisScore>>;
  displayable: boolean;
};

export async function getVenueScores(
  supabase: SupabaseClient,
  venueId: string,
): Promise<VenueScores | null> {
  const { data, error } = await supabase
    .from("venue_axis_scores")
    .select("axis, score, confidence, raw_review_count")
    .eq("venue_id", venueId);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const axes: Partial<Record<Axis, AxisScore>> = {};
  for (const row of data) {
    axes[row.axis as Axis] = {
      score: Number(row.score),
      confidence: Number(row.confidence),
      reviewCount: row.raw_review_count,
    };
  }

  const overall = axes.overall;
  return {
    axes,
    displayable: overall ? overall.confidence > 0.2 : false,
  };
}

export async function getVenueOverallScores(
  supabase: SupabaseClient,
  venueIds: string[],
): Promise<Map<string, { score: number; confidence: number; displayable: boolean }>> {
  if (venueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("venue_axis_scores")
    .select("venue_id, score, confidence")
    .eq("axis", "overall")
    .in("venue_id", venueIds);

  if (error) throw error;

  const result = new Map<string, { score: number; confidence: number; displayable: boolean }>();
  for (const row of data ?? []) {
    const confidence = Number(row.confidence);
    result.set(row.venue_id, {
      score: Number(row.score),
      confidence,
      displayable: confidence > 0.2,
    });
  }
  return result;
}
