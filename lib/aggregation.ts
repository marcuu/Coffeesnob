import type { SupabaseClient } from "@supabase/supabase-js";

import { deriveCoffeeScore, deriveExperienceScore } from "@/lib/review-scoring";
import { AXES, SCORING_CONSTANTS, type Axis } from "@/lib/scoring/weights";

export type AxisScore = {
  score: number;
  confidence: number;
  reviewCount: number;
};

export type VenueScores = {
  axes: Partial<Record<Axis, AxisScore>>;
  displayable: boolean;
};

const DISPLAY_CONFIDENCE_THRESHOLD = 0.2;
const MIN_EFFECTIVE_WEIGHT = 0.05;
const MS_PER_DAY = 86_400_000;

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
    displayable: overall
      ? overall.confidence > DISPLAY_CONFIDENCE_THRESHOLD
      : false,
  };
}

export type OverallScoreSummary = {
  score: number;
  confidence: number;
  rawReviewCount: number;
  displayable: boolean;
};

export async function getVenueOverallScores(
  supabase: SupabaseClient,
  venueIds: string[],
): Promise<Map<string, OverallScoreSummary>> {
  if (venueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("venue_axis_scores")
    .select("venue_id, score, confidence, raw_review_count")
    .eq("axis", "overall")
    .in("venue_id", venueIds);

  if (error) throw error;

  const result = new Map<string, OverallScoreSummary>();
  for (const row of data ?? []) {
    const confidence = Number(row.confidence);
    result.set(row.venue_id, {
      score: Number(row.score),
      confidence,
      rawReviewCount: row.raw_review_count,
      displayable: confidence > DISPLAY_CONFIDENCE_THRESHOLD,
    });
  }
  return result;
}

export type VenueScoreExplanation = {
  displayedScore: number;
  confidence: number;
  totalReviews: number;
  effectiveReviews: number;
  topContributors: Array<{
    reviewerDisplayName: string;
    weightContribution: number;
    score: number;
    visitedOn: string;
  }>;
  recencyProfile: {
    last6Months: number;
    sixTo18Months: number;
    older: number;
  };
  priorPull: number;
};

function resolveAxisScore(
  row: Record<string, number | string | null>,
  axis: Axis,
): number | null {
  if (axis === "overall") return Number(row.rating_overall ?? null);

  if (axis === "coffee") {
    if (
      typeof row.rating_taste === "number" &&
      typeof row.rating_body === "number" &&
      typeof row.rating_aroma === "number"
    ) {
      return deriveCoffeeScore({
        rating_taste: row.rating_taste,
        rating_body: row.rating_body,
        rating_aroma: row.rating_aroma,
      });
    }
    return null;
  }

  return deriveExperienceScore({
    rating_ambience: Number(row.rating_ambience ?? 0),
    rating_service: Number(row.rating_service ?? 0),
    rating_value: Number(row.rating_value ?? 0),
  });
}

export async function explainVenueScore(
  supabase: SupabaseClient,
  venueId: string,
  axis: Axis,
  now: Date = new Date(),
): Promise<VenueScoreExplanation | null> {
  if (!AXES.includes(axis)) return null;

  const { data: scoreRow, error: scoreErr } = await supabase
    .from("venue_axis_scores")
    .select("score, confidence, raw_review_count")
    .eq("venue_id", venueId)
    .eq("axis", axis)
    .maybeSingle();
  if (scoreErr) throw scoreErr;
  if (!scoreRow) return null;

  const { data: reviewRows, error: reviewsErr } = await supabase
    .from("reviews")
    .select(
      "id, visited_on, reviewer_id, rating_overall, rating_ambience, rating_service, rating_value, rating_taste, rating_body, rating_aroma, reviewer:reviewers(display_name)",
    )
    .eq("venue_id", venueId);
  if (reviewsErr) throw reviewsErr;

  const reviews = (reviewRows ?? []) as unknown as Array<
    {
      id: string;
      visited_on: string;
      reviewer_id: string;
      reviewer: { display_name: string } | null;
    } & Record<string, number | string | null>
  >;

  const reviewIds = reviews.map((r) => r.id);
  let weightByReviewId = new Map<string, number>();
  if (reviewIds.length > 0) {
    const { data: weightRows, error: weightsErr } = await supabase
      .from("review_weights")
      .select("review_id, weight")
      .eq("axis", axis)
      .in("review_id", reviewIds);
    if (weightsErr) throw weightsErr;
    weightByReviewId = new Map(
      (weightRows ?? []).map((r: { review_id: string; weight: number }) => [
        r.review_id,
        Number(r.weight),
      ]),
    );
  }

  const contributors = reviews.map((r) => ({
    reviewerDisplayName: r.reviewer?.display_name ?? "Unknown",
    weightContribution: weightByReviewId.get(r.id) ?? 0,
    score: Number(resolveAxisScore(r, axis) ?? 0),
    visitedOn: r.visited_on,
  }));

  const effective = contributors.filter(
    (c) => c.weightContribution > MIN_EFFECTIVE_WEIGHT,
  );
  const totalEffectiveWeight = effective.reduce(
    (sum, c) => sum + c.weightContribution,
    0,
  );

  const topContributors = [...contributors]
    .sort((a, b) => b.weightContribution - a.weightContribution)
    .slice(0, 5);

  let w6 = 0;
  let w18 = 0;
  let wOlder = 0;
  for (const c of effective) {
    const days = (now.getTime() - new Date(c.visitedOn).getTime()) / MS_PER_DAY;
    if (days <= 183) w6 += c.weightContribution;
    else if (days <= 548) w18 += c.weightContribution;
    else wOlder += c.weightContribution;
  }

  const recencyProfile =
    totalEffectiveWeight > 0
      ? {
          last6Months: w6 / totalEffectiveWeight,
          sixTo18Months: w18 / totalEffectiveWeight,
          older: wOlder / totalEffectiveWeight,
        }
      : { last6Months: 0, sixTo18Months: 0, older: 0 };

  const priorScore = SCORING_CONSTANTS.PRIOR_SCORE_BY_AXIS[axis];
  const posterior = Number(scoreRow.score);

  let priorPull = Math.abs(priorScore - posterior);
  if (totalEffectiveWeight > 0) {
    const weightedMean =
      effective.reduce((sum, c) => sum + c.score * c.weightContribution, 0) /
      totalEffectiveWeight;
    priorPull = Math.abs(weightedMean - posterior);
  }

  return {
    displayedScore: posterior,
    confidence: Number(scoreRow.confidence),
    totalReviews: reviews.length,
    effectiveReviews: effective.length,
    topContributors,
    recencyProfile,
    priorPull,
  };
}
