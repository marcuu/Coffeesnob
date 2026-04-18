// Scoring pipeline orchestration. Unlike lib/scoring/{weights,aggregation}.ts,
// this module DOES touch the database — it's the bridge between pure scoring
// logic and persisted state. Service-role Supabase client required; RLS on
// the four output tables is read-only to authenticated clients by design.
//
// Sequencing: metrics → axis weights → review weights → venue scores.
// Each step's upserts are idempotent, so a full rerun is safe. See
// docs/scoring.md Section 3.

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AXES,
  SCORING_CONSTANTS,
  computeReviewerAxisWeight,
  computeReviewerConsistency,
  computeReviewerTenure,
  computeReviewWeight,
  type Axis,
  type ReviewerState,
  type ReviewerStatus,
} from "@/lib/scoring/weights";
import { deriveCoffeeScore, deriveExperienceScore, deriveOverallScore } from "@/lib/review-scoring";
import { aggregateVenueAxis } from "@/lib/scoring/aggregation";

// Score-movement threshold for `venuesMovedOverall` in the run report.
const SIGNIFICANT_MOVE = 0.3;

export type StepResult = { updated: number };
export type VenueStepResult = { updated: number; scoresMoved: number };

export type PipelineRunReport = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  steps: {
    metrics: StepResult;
    axisWeights: StepResult;
    reviewWeights: StepResult;
    venueScores: VenueStepResult;
  };
  queueDrained: number;
  venuesMovedOverall: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Sb = SupabaseClient;

type ReviewerRow = {
  id: string;
  status: ReviewerStatus;
  created_at: string;
};

type ReviewRow = {
  id: string;
  venue_id: string;
  reviewer_id: string;
  visited_on: string;
  rating_overall: number;
  rating_ambience: number;
  rating_service: number;
  rating_value: number;
  rating_taste: number | null;
  rating_body: number | null;
  rating_aroma: number | null;
};

async function fetchReviewers(
  sb: Sb,
  ids?: string[],
): Promise<ReviewerRow[]> {
  let q = sb.from("reviewers").select("id, status, created_at");
  if (ids && ids.length > 0) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ReviewerRow[];
}

async function fetchReviewsByReviewers(
  sb: Sb,
  reviewerIds: string[],
): Promise<ReviewRow[]> {
  if (reviewerIds.length === 0) return [];
  const { data, error } = await sb
    .from("reviews")
    .select(
      "id, venue_id, reviewer_id, visited_on, rating_overall, rating_ambience, rating_service, rating_value, rating_taste, rating_body, rating_aroma",
    )
    .in("reviewer_id", reviewerIds);
  if (error) throw error;
  return (data ?? []) as ReviewRow[];
}

async function fetchReviewsByVenues(
  sb: Sb,
  venueIds: string[],
): Promise<ReviewRow[]> {
  if (venueIds.length === 0) return [];
  const { data, error } = await sb
    .from("reviews")
    .select(
      "id, venue_id, reviewer_id, visited_on, rating_overall, rating_ambience, rating_service, rating_value, rating_taste, rating_body, rating_aroma",
    )
    .in("venue_id", venueIds);
  if (error) throw error;
  return (data ?? []) as ReviewRow[];
}

async function fetchReviewsByIds(sb: Sb, ids: string[]): Promise<ReviewRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await sb
    .from("reviews")
    .select(
      "id, venue_id, reviewer_id, visited_on, rating_overall, rating_ambience, rating_service, rating_value, rating_taste, rating_body, rating_aroma",
    )
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as ReviewRow[];
}

async function fetchAllReviewIds(sb: Sb): Promise<string[]> {
  const { data, error } = await sb.from("reviews").select("id");
  if (error) throw error;
  return (data ?? []).map((r: { id: string }) => r.id);
}

async function fetchAllVenueIds(sb: Sb): Promise<string[]> {
  const { data, error } = await sb.from("venues").select("id");
  if (error) throw error;
  return (data ?? []).map((r: { id: string }) => r.id);
}

function reviewScores(r: ReviewRow): Record<Axis, number> {
  const taste = r.rating_taste;
  const body = r.rating_body;
  const aroma = r.rating_aroma;
  const hasCoffeeInputs =
    typeof taste === "number" && typeof body === "number" && typeof aroma === "number";

  const coffee = hasCoffeeInputs
    ? deriveCoffeeScore({ rating_taste: taste, rating_body: body, rating_aroma: aroma })
    : r.rating_overall;
  const experience = deriveExperienceScore({
    rating_ambience: r.rating_ambience,
    rating_service: r.rating_service,
    rating_value: r.rating_value,
  });
  const overall = hasCoffeeInputs
    ? deriveOverallScore({
        rating_ambience: r.rating_ambience,
        rating_service: r.rating_service,
        rating_value: r.rating_value,
        rating_taste: taste,
        rating_body: body,
        rating_aroma: aroma,
      })
    : r.rating_overall;

  return { overall, coffee, experience };
}

// ---------------------------------------------------------------------------
// Step 1: reviewer tenure + consistency
// ---------------------------------------------------------------------------

export async function updateReviewerMetrics(
  sb: Sb,
  reviewerIds?: string[],
  nowOverride?: Date,
): Promise<StepResult> {
  const now = nowOverride ?? new Date();
  const reviewers = await fetchReviewers(sb, reviewerIds);
  if (reviewers.length === 0) return { updated: 0 };

  const reviews = await fetchReviewsByReviewers(
    sb,
    reviewers.map((r) => r.id),
  );

  const scoresByReviewer = new Map<string, number[]>();
  const countByReviewer = new Map<string, number>();
  for (const r of reviewers) {
    scoresByReviewer.set(r.id, []);
    countByReviewer.set(r.id, 0);
  }
  for (const rev of reviews) {
    const list = scoresByReviewer.get(rev.reviewer_id);
    if (!list) continue;
    for (const axis of AXES) list.push(reviewScores(rev)[axis]);
    countByReviewer.set(
      rev.reviewer_id,
      (countByReviewer.get(rev.reviewer_id) ?? 0) + 1,
    );
  }

  const rows = reviewers.map((r) => ({
    reviewer_id: r.id,
    tenure_score: clamp(
      computeReviewerTenure(
        {
          createdAt: new Date(r.created_at),
          reviewCount: countByReviewer.get(r.id) ?? 0,
        },
        now,
      ),
      0,
      1,
    ),
    consistency_score: computeReviewerConsistency(
      scoresByReviewer.get(r.id) ?? [],
    ),
    updated_at: now.toISOString(),
  }));

  const { error } = await sb
    .from("reviewer_tenure")
    .upsert(rows, { onConflict: "reviewer_id" });
  if (error) throw error;
  return { updated: rows.length };
}

// ---------------------------------------------------------------------------
// Step 2: reviewer × axis weights
// ---------------------------------------------------------------------------

export async function updateReviewerAxisWeights(
  sb: Sb,
  reviewerIds?: string[],
  nowOverride?: Date,
): Promise<StepResult> {
  const now = nowOverride ?? new Date();
  const reviewers = await fetchReviewers(sb, reviewerIds);
  if (reviewers.length === 0) return { updated: 0 };

  const reviews = await fetchReviewsByReviewers(
    sb,
    reviewers.map((r) => r.id),
  );

  const perReviewerAxisCount = new Map<string, Record<Axis, number>>();
  for (const r of reviewers) {
    perReviewerAxisCount.set(r.id, {
      overall: 0,
      coffee: 0,
      experience: 0,
    });
  }
  for (const rev of reviews) {
    const per = perReviewerAxisCount.get(rev.reviewer_id);
    if (!per) continue;
    for (const axis of AXES) {
      const v = reviewScores(rev)[axis];
      if (typeof v === "number") per[axis]++;
    }
  }

  const rows: Array<{
    reviewer_id: string;
    axis: Axis;
    weight: number;
    review_count_in_axis: number;
    updated_at: string;
  }> = [];
  for (const r of reviewers) {
    const counts = perReviewerAxisCount.get(r.id)!;
    for (const axis of AXES) {
      const n = counts[axis];
      const raw = computeReviewerAxisWeight(
        { status: r.status, createdAt: new Date(r.created_at) },
        n,
        0,
        0,
      );
      rows.push({
        reviewer_id: r.id,
        axis,
        weight: clamp(raw, 0, 3),
        review_count_in_axis: n,
        updated_at: now.toISOString(),
      });
    }
  }

  const { error } = await sb
    .from("reviewer_axis_weights")
    .upsert(rows, { onConflict: "reviewer_id,axis" });
  if (error) throw error;
  return { updated: rows.length };
}

// ---------------------------------------------------------------------------
// Step 3: per-review × axis weights
// ---------------------------------------------------------------------------
// Dependency: reviewer_tenure + reviewer_axis_weights must exist for every
// reviewer whose review we're recomputing. If not, throws — this is the
// "out-of-order execution" guard from Section 3.

export async function recomputeReviewWeights(
  sb: Sb,
  reviewIds?: string[],
  nowOverride?: Date,
): Promise<StepResult> {
  const now = nowOverride ?? new Date();
  const reviews =
    reviewIds && reviewIds.length > 0
      ? await fetchReviewsByIds(sb, reviewIds)
      : await fetchReviewsByIds(sb, await fetchAllReviewIds(sb));
  if (reviews.length === 0) return { updated: 0 };

  const reviewerIds = Array.from(new Set(reviews.map((r) => r.reviewer_id)));
  const reviewerState = await loadReviewerStates(sb, reviewerIds);

  const rows: Array<{
    review_id: string;
    axis: Axis;
    weight: number;
    computed_at: string;
  }> = [];
  for (const rev of reviews) {
    const state = reviewerState.get(rev.reviewer_id);
    if (!state) {
      throw new Error(
        `recomputeReviewWeights: reviewer ${rev.reviewer_id} missing tenure/axis-weight rows. ` +
          "Run updateReviewerMetrics + updateReviewerAxisWeights first.",
      );
    }
    for (const axis of AXES) {
      const w = computeReviewWeight(
        state,
        {
          id: rev.id,
          reviewerId: rev.reviewer_id,
          visitedOn: new Date(rev.visited_on),
          scores: reviewScores(rev),
        },
        axis,
        now,
      );
      rows.push({
        review_id: rev.id,
        axis,
        weight: clamp(w, 0, 1),
        computed_at: now.toISOString(),
      });
    }
  }

  const { error } = await sb
    .from("review_weights")
    .upsert(rows, { onConflict: "review_id,axis" });
  if (error) throw error;
  return { updated: rows.length };
}

async function loadReviewerStates(
  sb: Sb,
  reviewerIds: string[],
): Promise<Map<string, ReviewerState>> {
  if (reviewerIds.length === 0) return new Map();

  const [reviewersRes, tenureRes, axisRes] = await Promise.all([
    sb
      .from("reviewers")
      .select("id, status, created_at, review_count")
      .in("id", reviewerIds),
    sb
      .from("reviewer_tenure")
      .select("reviewer_id, tenure_score, consistency_score")
      .in("reviewer_id", reviewerIds),
    sb
      .from("reviewer_axis_weights")
      .select("reviewer_id, axis, weight, review_count_in_axis")
      .in("reviewer_id", reviewerIds),
  ]);
  if (reviewersRes.error) throw reviewersRes.error;
  if (tenureRes.error) throw tenureRes.error;
  if (axisRes.error) throw axisRes.error;

  const tenureById = new Map(
    (tenureRes.data ?? []).map((t: {
      reviewer_id: string;
      tenure_score: number;
      consistency_score: number;
    }) => [t.reviewer_id, t]),
  );
  const axisByReviewer = new Map<
    string,
    { weights: Record<Axis, number>; counts: Record<Axis, number> }
  >();
  for (const row of (axisRes.data ?? []) as {
    reviewer_id: string;
    axis: Axis;
    weight: number;
    review_count_in_axis: number;
  }[]) {
    let entry = axisByReviewer.get(row.reviewer_id);
    if (!entry) {
      entry = {
        weights: {
          overall: 0,
          coffee: 0,
          experience: 0,
        },
        counts: {
          overall: 0,
          coffee: 0,
          experience: 0,
        },
      };
      axisByReviewer.set(row.reviewer_id, entry);
    }
    entry.weights[row.axis] = Number(row.weight);
    entry.counts[row.axis] = Number(row.review_count_in_axis);
  }

  const out = new Map<string, ReviewerState>();
  for (const r of (reviewersRes.data ?? []) as (ReviewerRow & {
    review_count: number;
  })[]) {
    const tenure = tenureById.get(r.id);
    const axis = axisByReviewer.get(r.id);
    if (!tenure || !axis) continue; // missing → dependency guard in caller
    out.set(r.id, {
      id: r.id,
      status: r.status,
      createdAt: new Date(r.created_at),
      reviewCount: r.review_count,
      tenureScore: Number(tenure.tenure_score),
      consistencyScore: Number(tenure.consistency_score),
      axisWeights: axis.weights,
      reviewsByAxis: axis.counts,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Step 4: per-venue × axis aggregates
// ---------------------------------------------------------------------------

export async function recomputeVenueScores(
  sb: Sb,
  venueIds?: string[],
  nowOverride?: Date,
): Promise<VenueStepResult & { movedOverall: string[] }> {
  const now = nowOverride ?? new Date();
  const targets = venueIds ?? (await fetchAllVenueIds(sb));
  if (targets.length === 0) {
    return { updated: 0, scoresMoved: 0, movedOverall: [] };
  }

  const reviews = await fetchReviewsByVenues(sb, targets);
  const reviewIds = reviews.map((r) => r.id);
  const weightsByReview = await loadReviewWeights(sb, reviewIds);

  if (reviews.length > 0 && weightsByReview.size === 0) {
    throw new Error(
      "recomputeVenueScores: no review_weights rows found for the target reviews. " +
        "Run recomputeReviewWeights first.",
    );
  }

  const existing = await loadVenueAxisScores(sb, targets);

  const rows: Array<{
    venue_id: string;
    axis: Axis;
    score: number;
    confidence: number;
    effective_review_count: number;
    raw_review_count: number;
    last_calculated_at: string;
  }> = [];
  const movedOverall: string[] = [];

  const reviewsByVenue = new Map<string, ReviewRow[]>();
  for (const v of targets) reviewsByVenue.set(v, []);
  for (const r of reviews) reviewsByVenue.get(r.venue_id)?.push(r);

  for (const venueId of targets) {
    const venueReviews = reviewsByVenue.get(venueId) ?? [];
    for (const axis of AXES) {
      const weighted = venueReviews.map((rev) => ({
        score: reviewScores(rev)[axis],
        weight: weightsByReview.get(rev.id)?.[axis] ?? 0,
      }));
      const agg = aggregateVenueAxis(
        weighted,
        SCORING_CONSTANTS.PRIOR_SCORE_BY_AXIS[axis],
        SCORING_CONSTANTS.PRIOR_STRENGTH,
      );
      if (
        axis === "overall" &&
        Math.abs(agg.score - (existing.get(venueId)?.overall ?? agg.score)) >
          SIGNIFICANT_MOVE &&
        existing.has(venueId)
      ) {
        movedOverall.push(venueId);
      }
      rows.push({
        venue_id: venueId,
        axis,
        // venue_axis_scores.score has a DB check score >= 1 — clamp for
        // safety since aggregateVenueAxis can return the prior (1..10).
        score: clamp(agg.score, 1, 10),
        confidence: clamp(agg.confidence, 0, 1),
        effective_review_count: agg.effectiveN,
        raw_review_count: agg.rawCount,
        last_calculated_at: now.toISOString(),
      });
    }
  }

  const { error } = await sb
    .from("venue_axis_scores")
    .upsert(rows, { onConflict: "venue_id,axis" });
  if (error) throw error;
  return { updated: rows.length, scoresMoved: movedOverall.length, movedOverall };
}

async function loadReviewWeights(
  sb: Sb,
  reviewIds: string[],
): Promise<Map<string, Record<Axis, number>>> {
  if (reviewIds.length === 0) return new Map();
  const out = new Map<string, Record<Axis, number>>();
  // Chunk to avoid PostgREST URL-length limits.
  const CHUNK = 500;
  for (let i = 0; i < reviewIds.length; i += CHUNK) {
    const chunk = reviewIds.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("review_weights")
      .select("review_id, axis, weight")
      .in("review_id", chunk);
    if (error) throw error;
    for (const row of (data ?? []) as {
      review_id: string;
      axis: Axis;
      weight: number;
    }[]) {
      let entry = out.get(row.review_id);
      if (!entry) {
        entry = {
          overall: 0,
          coffee: 0,
          experience: 0,
        };
        out.set(row.review_id, entry);
      }
      entry[row.axis] = Number(row.weight);
    }
  }
  return out;
}

async function loadVenueAxisScores(
  sb: Sb,
  venueIds: string[],
): Promise<Map<string, Record<Axis, number>>> {
  if (venueIds.length === 0) return new Map();
  const { data, error } = await sb
    .from("venue_axis_scores")
    .select("venue_id, axis, score")
    .in("venue_id", venueIds);
  if (error) throw error;
  const out = new Map<string, Record<Axis, number>>();
  for (const row of (data ?? []) as {
    venue_id: string;
    axis: Axis;
    score: number;
  }[]) {
    let entry = out.get(row.venue_id);
    if (!entry) {
      entry = {
        overall: 0,
        coffee: 0,
        experience: 0,
      };
      out.set(row.venue_id, entry);
    }
    entry[row.axis] = Number(row.score);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Full pipeline run
// ---------------------------------------------------------------------------

export async function runFullPipeline(
  sb: Sb,
  nowOverride?: Date,
): Promise<PipelineRunReport> {
  const startedAt = nowOverride ?? new Date();
  const nowIso = startedAt.toISOString();

  const metrics = await updateReviewerMetrics(sb, undefined, startedAt);
  const axisWeights = await updateReviewerAxisWeights(sb, undefined, startedAt);
  const reviewWeights = await recomputeReviewWeights(sb, undefined, startedAt);
  const venueScores = await recomputeVenueScores(sb, undefined, startedAt);

  // Drain the dirty queue — everything just got recomputed.
  const { count: queueBefore } = await sb
    .from("scoring_dirty_queue")
    .select("*", { count: "exact", head: true });
  const { error: deleteErr } = await sb
    .from("scoring_dirty_queue")
    .delete()
    .lte("enqueued_at", nowIso);
  if (deleteErr) throw deleteErr;

  const finishedAt = nowOverride ?? new Date();
  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    steps: {
      metrics,
      axisWeights,
      reviewWeights: reviewWeights,
      venueScores: {
        updated: venueScores.updated,
        scoresMoved: venueScores.scoresMoved,
      },
    },
    queueDrained: queueBefore ?? 0,
    venuesMovedOverall: venueScores.movedOverall,
  };
}

// ---------------------------------------------------------------------------
// Shared utility
// ---------------------------------------------------------------------------

function clamp(x: number, lo: number, hi: number): number {
  if (Number.isNaN(x)) return lo;
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}
