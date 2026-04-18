// Simulation harness (docs/scoring.md Section 6). Reads the current DB
// snapshot, applies SCORING_CONSTANTS overrides in-memory, recomputes all
// scores without writing to the database, and outputs a JSON diff report.
//
// Usage: npm run scoring:simulate -- --config scenarios/example.json

import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";

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
import { aggregateVenueAxis } from "@/lib/scoring/aggregation";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { loadDotEnv } from "./_env";

type SimConfig = {
  description: string;
  overrides: Record<string, unknown>;
};

type ReviewerRow = {
  id: string;
  status: ReviewerStatus;
  created_at: string;
  review_count: number;
};

type ReviewRow = {
  id: string;
  venue_id: string;
  reviewer_id: string;
  visited_on: string;
  rating_overall: number;
  rating_coffee: number;
  rating_ambience: number;
  rating_service: number;
  rating_value: number;
};

const AXIS_COLUMN: Record<Axis, keyof ReviewRow> = {
  overall: "rating_overall",
  coffee: "rating_coffee",
  ambience: "rating_ambience",
  service: "rating_service",
  value: "rating_value",
};

function clamp(x: number, lo: number, hi: number): number {
  if (Number.isNaN(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function round(x: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}

// Merges overrides into SCORING_CONSTANTS in-place. Nested objects (e.g.
// PRIOR_SCORE_BY_AXIS) are merged shallowly so partial overrides work.
function applyOverrides(overrides: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in SCORING_CONSTANTS)) {
      process.stderr.write(`[warn] Unknown constant: "${key}" — skipped\n`);
      continue;
    }
    const existing = SCORING_CONSTANTS[key as keyof typeof SCORING_CONSTANTS];
    if (
      typeof existing === "object" &&
      existing !== null &&
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      Object.assign(existing, value);
    } else {
      (SCORING_CONSTANTS as Record<string, unknown>)[key] = value;
    }
  }
}

async function main() {
  loadDotEnv();

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { config: { type: "string" } },
  });

  if (!values.config) {
    process.stderr.write(
      "Usage: npm run scoring:simulate -- --config path/to/config.json\n",
    );
    process.exit(1);
  }

  const config: SimConfig = JSON.parse(readFileSync(values.config, "utf8"));
  process.stderr.write(`Simulation: ${config.description}\n`);
  process.stderr.write(
    `Overrides: ${JSON.stringify(config.overrides, null, 2)}\n`,
  );

  applyOverrides(config.overrides);

  const sb = createServiceRoleClient();
  const now = new Date();

  process.stderr.write("Fetching DB snapshot…\n");

  const [reviewersRes, reviewsRes, baselineScoresRes, baselineWeightsRes] =
    await Promise.all([
      sb.from("reviewers").select("id, status, created_at, review_count"),
      sb
        .from("reviews")
        .select(
          "id, venue_id, reviewer_id, visited_on, rating_overall, rating_coffee, rating_ambience, rating_service, rating_value",
        ),
      sb.from("venue_axis_scores").select("venue_id, axis, score, confidence"),
      sb.from("reviewer_axis_weights").select("reviewer_id, axis, weight"),
    ]);

  if (reviewersRes.error) throw reviewersRes.error;
  if (reviewsRes.error) throw reviewsRes.error;
  if (baselineScoresRes.error) throw baselineScoresRes.error;
  if (baselineWeightsRes.error) throw baselineWeightsRes.error;

  const reviewers = (reviewersRes.data ?? []) as ReviewerRow[];
  const reviews = (reviewsRes.data ?? []) as ReviewRow[];

  process.stderr.write(
    `Loaded: ${reviewers.length} reviewers, ${reviews.length} reviews\n`,
  );

  // Build baseline maps from current DB state.
  const baselineScores = new Map<
    string,
    Map<Axis, { score: number; confidence: number }>
  >();
  for (const row of (baselineScoresRes.data ?? []) as {
    venue_id: string;
    axis: Axis;
    score: number;
    confidence: number;
  }[]) {
    let m = baselineScores.get(row.venue_id);
    if (!m) {
      m = new Map();
      baselineScores.set(row.venue_id, m);
    }
    m.set(row.axis, {
      score: Number(row.score),
      confidence: Number(row.confidence),
    });
  }

  const baselineReviewerWeights = new Map<string, Map<Axis, number>>();
  for (const row of (baselineWeightsRes.data ?? []) as {
    reviewer_id: string;
    axis: Axis;
    weight: number;
  }[]) {
    let m = baselineReviewerWeights.get(row.reviewer_id);
    if (!m) {
      m = new Map();
      baselineReviewerWeights.set(row.reviewer_id, m);
    }
    m.set(row.axis, Number(row.weight));
  }

  // ---------------------------------------------------------------------------
  // Step 1: Compute tenure + consistency with overridden constants.
  // ---------------------------------------------------------------------------

  const scoresByReviewer = new Map<string, number[]>();
  const countByReviewer = new Map<string, number>();
  for (const r of reviewers) {
    scoresByReviewer.set(r.id, []);
    countByReviewer.set(r.id, 0);
  }
  for (const rev of reviews) {
    const list = scoresByReviewer.get(rev.reviewer_id);
    if (list) {
      for (const axis of AXES) {
        const v = rev[AXIS_COLUMN[axis]] as number;
        if (typeof v === "number") list.push(v);
      }
    }
    countByReviewer.set(
      rev.reviewer_id,
      (countByReviewer.get(rev.reviewer_id) ?? 0) + 1,
    );
  }

  const simTenure = new Map<string, { tenure: number; consistency: number }>();
  for (const r of reviewers) {
    simTenure.set(r.id, {
      tenure: clamp(
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
      consistency: computeReviewerConsistency(
        scoresByReviewer.get(r.id) ?? [],
      ),
    });
  }

  // ---------------------------------------------------------------------------
  // Step 2: Compute per-reviewer × axis weights.
  // ---------------------------------------------------------------------------

  const perReviewerAxisCount = new Map<string, Record<Axis, number>>();
  for (const r of reviewers) {
    perReviewerAxisCount.set(r.id, {
      overall: 0,
      coffee: 0,
      ambience: 0,
      service: 0,
      value: 0,
    });
  }
  for (const rev of reviews) {
    const per = perReviewerAxisCount.get(rev.reviewer_id);
    if (per) {
      for (const axis of AXES) {
        if (typeof (rev[AXIS_COLUMN[axis]] as unknown) === "number") per[axis]++;
      }
    }
  }

  const simAxisWeights = new Map<string, Record<Axis, number>>();
  const reviewerWeightChanges: Array<{
    reviewerId: string;
    axis: Axis;
    before: number | null;
    after: number;
    delta: number;
  }> = [];

  for (const r of reviewers) {
    const counts = perReviewerAxisCount.get(r.id)!;
    const weights: Record<Axis, number> = {
      overall: 0,
      coffee: 0,
      ambience: 0,
      service: 0,
      value: 0,
    };
    for (const axis of AXES) {
      const w = clamp(
        computeReviewerAxisWeight(
          { status: r.status, createdAt: new Date(r.created_at) },
          counts[axis],
          0,
          0,
        ),
        0,
        3,
      );
      weights[axis] = w;
      const before = baselineReviewerWeights.get(r.id)?.get(axis) ?? null;
      if (before !== null && Math.abs(w - before) > 0.0005) {
        reviewerWeightChanges.push({
          reviewerId: r.id,
          axis,
          before: round(before, 4),
          after: round(w, 4),
          delta: round(w - before, 4),
        });
      }
    }
    simAxisWeights.set(r.id, weights);
  }

  // ---------------------------------------------------------------------------
  // Step 3: Build reviewer states and compute per-review weights.
  // ---------------------------------------------------------------------------

  const reviewerStates = new Map<string, ReviewerState>();
  for (const r of reviewers) {
    const t = simTenure.get(r.id);
    const aw = simAxisWeights.get(r.id);
    if (!t || !aw) continue;
    reviewerStates.set(r.id, {
      id: r.id,
      status: r.status,
      createdAt: new Date(r.created_at),
      reviewCount: r.review_count,
      tenureScore: t.tenure,
      consistencyScore: t.consistency,
      axisWeights: aw,
      reviewsByAxis: perReviewerAxisCount.get(r.id)!,
    });
  }

  const simReviewWeights = new Map<string, Record<Axis, number>>();
  for (const rev of reviews) {
    const state = reviewerStates.get(rev.reviewer_id);
    if (!state) continue;
    const weights: Record<Axis, number> = {
      overall: 0,
      coffee: 0,
      ambience: 0,
      service: 0,
      value: 0,
    };
    for (const axis of AXES) {
      weights[axis] = clamp(
        computeReviewWeight(
          state,
          {
            id: rev.id,
            reviewerId: rev.reviewer_id,
            visitedOn: new Date(rev.visited_on),
            scores: {
              overall: rev.rating_overall,
              coffee: rev.rating_coffee,
              ambience: rev.rating_ambience,
              service: rev.rating_service,
              value: rev.rating_value,
            },
          },
          axis,
          now,
        ),
        0,
        1,
      );
    }
    simReviewWeights.set(rev.id, weights);
  }

  // ---------------------------------------------------------------------------
  // Step 4: Aggregate venue scores.
  // ---------------------------------------------------------------------------

  const reviewsByVenue = new Map<string, ReviewRow[]>();
  for (const rev of reviews) {
    let list = reviewsByVenue.get(rev.venue_id);
    if (!list) {
      list = [];
      reviewsByVenue.set(rev.venue_id, list);
    }
    list.push(rev);
  }

  const venueChanges: Array<{
    venueId: string;
    axis: Axis;
    scoreBefore: number | null;
    scoreAfter: number;
    delta: number;
    confidenceBefore: number | null;
    confidenceAfter: number;
  }> = [];

  const allVenueIds = new Set([
    ...reviewsByVenue.keys(),
    ...baselineScores.keys(),
  ]);

  for (const venueId of allVenueIds) {
    const venueReviews = reviewsByVenue.get(venueId) ?? [];
    for (const axis of AXES) {
      const weighted = venueReviews.map((rev) => ({
        score: rev[AXIS_COLUMN[axis]] as number,
        weight: simReviewWeights.get(rev.id)?.[axis] ?? 0,
      }));
      const agg = aggregateVenueAxis(
        weighted,
        SCORING_CONSTANTS.PRIOR_SCORE_BY_AXIS[axis],
        SCORING_CONSTANTS.PRIOR_STRENGTH,
      );
      const scoreAfter = clamp(agg.score, 1, 10);
      const confidenceAfter = clamp(agg.confidence, 0, 1);
      const base = baselineScores.get(venueId)?.get(axis);
      const scoreBefore = base?.score ?? null;
      const delta = scoreBefore !== null ? scoreAfter - scoreBefore : 0;
      if (Math.abs(delta) > 0.005 || scoreBefore === null) {
        venueChanges.push({
          venueId,
          axis,
          scoreBefore,
          scoreAfter: round(scoreAfter, 3),
          delta: round(delta, 3),
          confidenceBefore: base?.confidence ?? null,
          confidenceAfter: round(confidenceAfter, 3),
        });
      }
    }
  }

  venueChanges.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  reviewerWeightChanges.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // ---------------------------------------------------------------------------
  // Build report.
  // ---------------------------------------------------------------------------

  const overallChanges = venueChanges.filter(
    (c) => c.axis === "overall" && c.scoreBefore !== null,
  );
  const avgAbsDelta =
    overallChanges.length > 0
      ? overallChanges.reduce((s, c) => s + Math.abs(c.delta), 0) /
        overallChanges.length
      : 0;
  const maxAbsDelta =
    overallChanges.length > 0
      ? Math.max(...overallChanges.map((c) => Math.abs(c.delta)))
      : 0;

  const report = {
    description: config.description,
    simulatedAt: now.toISOString(),
    constantsOverridden: config.overrides,
    summary: {
      venuesWithScoreChange: overallChanges.length,
      avgAbsDeltaOverall: round(avgAbsDelta, 3),
      maxAbsDeltaOverall: round(maxAbsDelta, 3),
      reviewerWeightsChanged: reviewerWeightChanges.length,
    },
    venuesMoved: venueChanges,
    reviewerWeightChanges,
  };

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(String(err) + "\n");
  process.exit(1);
});
