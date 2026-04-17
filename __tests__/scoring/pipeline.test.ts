import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  recomputeReviewWeights,
  recomputeVenueScores,
  runFullPipeline,
  updateReviewerAxisWeights,
  updateReviewerMetrics,
} from "@/lib/scoring/pipeline";

import { createFakeSupabase, type Tables } from "./fake-supabase";

const NOW = new Date("2026-04-17T00:00:00Z");
const MS_PER_DAY = 86_400_000;

function iso(date: Date): string {
  return date.toISOString();
}

function daysAgo(n: number): string {
  return iso(new Date(NOW.getTime() - n * MS_PER_DAY));
}

function monthsAgo(n: number): string {
  return iso(new Date(NOW.getTime() - n * 30 * MS_PER_DAY));
}

// Deterministic fixture. Two seeded reviewers, each writing 30 reviews
// across two venues, so per-axis review counts saturate past the 20-review
// threshold and weights comfortably exceed the 0.05 filter.
function seedTables(): Tables {
  const reviews: Record<string, unknown>[] = [];
  const scoreRing = [2, 4, 5, 6, 7, 8, 9, 10, 3, 5, 6, 7, 8, 9, 4];
  let seq = 0;
  for (const reviewerId of ["r-seeded-1", "r-seeded-2"] as const) {
    for (let v = 0; v < 2; v++) {
      const venueId = v === 0 ? "v1" : "v2";
      for (let i = 0; i < 15; i++) {
        const s = scoreRing[(seq + i) % scoreRing.length];
        const bump = reviewerId === "r-seeded-1" ? 1 : 0;
        reviews.push({
          id: `rev-${reviewerId}-${venueId}-${i}`,
          venue_id: venueId,
          reviewer_id: reviewerId,
          visited_on: daysAgo(10 + ((seq + i) % 200)),
          rating_overall: clampInt(s + bump),
          rating_coffee: clampInt(s + bump),
          rating_ambience: clampInt(s - 1 + bump),
          rating_service: clampInt(s + 1 + bump),
          rating_value: clampInt(s - 2 + bump),
        });
        seq++;
      }
    }
  }
  return {
    reviewers: [
      {
        id: "r-seeded-1",
        status: "seeded",
        created_at: monthsAgo(24),
        review_count: 30,
      },
      {
        id: "r-seeded-2",
        status: "seeded",
        created_at: monthsAgo(24),
        review_count: 30,
      },
    ],
    venues: [{ id: "v1" }, { id: "v2" }],
    reviews,
    reviewer_tenure: [],
    reviewer_axis_weights: [],
    review_weights: [],
    venue_axis_scores: [],
    scoring_dirty_queue: [
      {
        id: 1,
        review_id: reviews[0].id,
        reviewer_id: "r-seeded-1",
        venue_id: "v1",
        enqueued_at: daysAgo(0),
      },
    ],
  };
}

function clampInt(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)));
}

const VOLATILE_KEYS = new Set([
  "last_calculated_at",
  "computed_at",
  "updated_at",
  "enqueued_at",
]);

function stripVolatile(rows: Record<string, unknown>[]): string {
  return JSON.stringify(
    rows.map((r) => {
      const copy: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (!VOLATILE_KEYS.has(k)) copy[k] = v;
      }
      return copy;
    }),
  );
}

describe("pipeline orchestration", () => {
  it("runFullPipeline populates all four output tables and drains the queue", async () => {
    const fake = createFakeSupabase(seedTables());
    const sb = fake.client as SupabaseClient;
    const report = await runFullPipeline(sb);

    // Metrics: one row per reviewer (2)
    expect(fake.tables.reviewer_tenure.length).toBe(2);
    // Axis weights: 2 reviewers × 5 axes
    expect(fake.tables.reviewer_axis_weights.length).toBe(10);
    // Review weights: 60 reviews × 5 axes
    expect(fake.tables.review_weights.length).toBe(60 * 5);
    // Venue scores: 2 venues × 5 axes
    expect(fake.tables.venue_axis_scores.length).toBe(10);

    // Queue drained
    expect(fake.tables.scoring_dirty_queue.length).toBe(0);
    expect(report.queueDrained).toBe(1);

    // Report shape
    expect(report.steps.metrics.updated).toBe(2);
    expect(report.steps.axisWeights.updated).toBe(10);
    expect(report.steps.reviewWeights.updated).toBe(60 * 5);
    expect(report.steps.venueScores.updated).toBe(10);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("is idempotent: running twice produces identical output rows", async () => {
    const fake = createFakeSupabase(seedTables());
    const sb = fake.client as SupabaseClient;

    await runFullPipeline(sb, NOW);
    const firstVenueScores = stripVolatile(
      [...fake.tables.venue_axis_scores].sort(sortKey("venue_id", "axis")) as Record<string, unknown>[],
    );
    const firstReviewWeights = stripVolatile(
      [...fake.tables.review_weights].sort(sortKey("review_id", "axis")) as Record<string, unknown>[],
    );

    await runFullPipeline(sb, NOW);
    const secondVenueScores = stripVolatile(
      [...fake.tables.venue_axis_scores].sort(sortKey("venue_id", "axis")) as Record<string, unknown>[],
    );
    const secondReviewWeights = stripVolatile(
      [...fake.tables.review_weights].sort(sortKey("review_id", "axis")) as Record<string, unknown>[],
    );

    // Row counts don't double, values stay the same (timestamps excluded).
    expect(fake.tables.venue_axis_scores.length).toBe(10);
    expect(fake.tables.review_weights.length).toBe(60 * 5);
    expect(firstVenueScores).toBe(secondVenueScores);
    expect(firstReviewWeights).toBe(secondReviewWeights);
  });

  it("throws a clear error when recomputeReviewWeights is called before reviewer metrics exist", async () => {
    const fake = createFakeSupabase(seedTables());
    const sb = fake.client as SupabaseClient;
    await expect(recomputeReviewWeights(sb)).rejects.toThrow(
      /updateReviewerMetrics/,
    );
  });

  it("throws a clear error when recomputeVenueScores is called before review weights exist", async () => {
    const fake = createFakeSupabase(seedTables());
    const sb = fake.client as SupabaseClient;
    // Pre-populate reviewer state so the earlier guard doesn't fire first.
    await updateReviewerMetrics(sb, undefined, NOW);
    await updateReviewerAxisWeights(sb, undefined, NOW);
    await expect(recomputeVenueScores(sb)).rejects.toThrow(
      /recomputeReviewWeights/,
    );
  });

  it("produces venue scores in [1, 10] and confidence in [0, 1]", async () => {
    const fake = createFakeSupabase(seedTables());
    const sb = fake.client as SupabaseClient;
    await runFullPipeline(sb);
    for (const row of fake.tables.venue_axis_scores) {
      const r = row as { score: number; confidence: number };
      expect(r.score).toBeGreaterThanOrEqual(1);
      expect(r.score).toBeLessThanOrEqual(10);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("reports venuesMovedOverall empty on first run (no existing scores)", async () => {
    const fake = createFakeSupabase(seedTables());
    const sb = fake.client as SupabaseClient;
    const report = await runFullPipeline(sb);
    expect(report.venuesMovedOverall).toEqual([]);
  });

  it("reports venuesMovedOverall when a subsequent run shifts scores by >0.3", async () => {
    const fake = createFakeSupabase(seedTables());
    const sb = fake.client as SupabaseClient;
    await runFullPipeline(sb);

    // Swap v1 ratings drastically so the second run produces a big move.
    for (const row of fake.tables.reviews) {
      const r = row as Record<string, unknown>;
      if (r.venue_id === "v1") {
        r.rating_overall = 1;
        r.rating_coffee = 1;
        r.rating_ambience = 1;
        r.rating_service = 1;
        r.rating_value = 1;
      }
    }

    const report = await runFullPipeline(sb);
    expect(report.venuesMovedOverall).toContain("v1");
  });
});

function sortKey(...keys: string[]) {
  return (a: Record<string, unknown>, b: Record<string, unknown>): number => {
    for (const k of keys) {
      const av = String(a[k] ?? "");
      const bv = String(b[k] ?? "");
      if (av < bv) return -1;
      if (av > bv) return 1;
    }
    return 0;
  };
}
