# Weighted scoring for Coffeesnob

## Context

Coffeesnob currently computes venue scores as simple averages across the five
rating axes. This doc specifies the weighted-scoring system that replaces
simple averaging. The goal is the moat mechanism described in `AGENTS.md`:
reviews from experienced and critical reviewers count more than reviews from
casual contributors, applied per-axis so expertise in one domain doesn't leak
into others.

## Non-goals

- No new rating axes — stay with the existing five (`rating_overall`,
  `rating_coffee`, `rating_ambience`, `rating_service`, `rating_value`).
- No review form UX changes.
- No public reviewer profiles or follow graph.
- No auth or allowlist changes.

## Section 1: Schema additions

All changes in a new timestamped migration under `supabase/migrations/`. Do
not edit the existing init migration.

Add to `reviewers` table:

- `status text not null default 'active' check (status in ('seeded', 'invited', 'active'))`
- Partial index: `create index reviewers_status_idx on public.reviewers(status) where status != 'active'`

New table `reviewer_axis_weights`:

- `reviewer_id uuid references reviewers(id) on delete cascade`
- `axis text check (axis in ('overall', 'coffee', 'ambience', 'service', 'value'))`
- `weight numeric(4,3) not null default 0.500 check (weight >= 0 and weight <= 3)`
- `review_count_in_axis int not null default 0`
- `updated_at timestamptz not null default now()`
- Primary key `(reviewer_id, axis)`

New table `reviewer_tenure`:

- `reviewer_id uuid primary key references reviewers(id) on delete cascade`
- `tenure_score numeric(4,3) not null default 0.100 check (tenure_score >= 0 and tenure_score <= 1)`
- `consistency_score numeric(4,3) not null default 0.500 check (consistency_score >= 0 and consistency_score <= 1)`
- `updated_at timestamptz not null default now()`

New table `review_weights` — cached computed weight per review per axis:

- `review_id uuid references reviews(id) on delete cascade`
- `axis text check (axis in ('overall', 'coffee', 'ambience', 'service', 'value'))`
- `weight numeric(5,4) not null check (weight >= 0 and weight <= 1)`
- `computed_at timestamptz not null default now()`
- Primary key `(review_id, axis)`

New table `venue_axis_scores` — output read by the UI:

- `venue_id uuid references venues(id) on delete cascade`
- `axis text check (axis in ('overall', 'coffee', 'ambience', 'service', 'value'))`
- `score numeric(4,2) not null check (score >= 1 and score <= 10)`
- `confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1)`
- `effective_review_count numeric(6,2) not null`
- `raw_review_count int not null`
- `last_calculated_at timestamptz not null default now()`
- Primary key `(venue_id, axis)`

### RLS

All four new tables: readable by any allowlisted user via `is_allowed_email()`
(confidence and review counts are surfaced in the UI for transparency).
Writable only by the service role — populated by the scoring pipeline, never
by user actions. RLS policies must be in the same migration as the table DDL.

### No triggers

Do not add triggers that recompute scores on review insert. Scoring is batched
(Section 4). The existing `reviews_stats_trigger` on `public.reviews` stays
as-is.

## Section 2: Pure functions in `lib/scoring/`

New directory `lib/scoring/`. All functions here are pure — no database
access, no imports from `utils/supabase/*`.

### File `lib/scoring/weights.ts`

```typescript
export type Axis = 'overall' | 'coffee' | 'ambience' | 'service' | 'value';

export type ReviewerState = {
  id: string;
  status: 'seeded' | 'invited' | 'active';
  createdAt: Date;
  reviewCount: number;
  tenureScore: number;
  consistencyScore: number;
  axisWeights: Record<Axis, number>;
  reviewsByAxis: Record<Axis, number>;
};

export type ReviewForWeighting = {
  id: string;
  reviewerId: string;
  visitedOn: Date;
  scores: Partial<Record<Axis, number>>;
};

export const SCORING_CONSTANTS = {
  RECENCY_HALF_LIFE_DAYS: 540,
  COMPLETENESS_FULL_THRESHOLD: 3,
  COMPLETENESS_PARTIAL_MULTIPLIER: 0.7,
  STATUS_BASE_WEIGHT: { seeded: 3.0, invited: 1.0, active: 0.5 },
  AXIS_COUNT_SATURATION: 20,
  AXIS_COUNT_MAX_MULTIPLIER: 1.5,
  TENURE_MONTHS_WEIGHT: 0.5,
  TENURE_COUNT_WEIGHT: 0.5,
  TENURE_MONTHS_SATURATION: 12,
  TENURE_COUNT_SATURATION: 50,
  PRIOR_SCORE_BY_AXIS: { overall: 6.0, coffee: 6.0, ambience: 6.0, service: 6.5, value: 6.0 },
  PRIOR_STRENGTH: 5.0,
};

export function computeReviewWeight(
  reviewer: ReviewerState,
  review: ReviewForWeighting,
  axis: Axis,
  now: Date
): number;

export function computeReviewerAxisWeight(
  reviewer: { status: ReviewerState['status']; createdAt: Date },
  reviewsInAxis: number,
  validationsPositive: number,  // default 0 until validations ship
  validationsNegative: number   // default 0 until validations ship
): number;

export function computeReviewerTenure(
  reviewer: { createdAt: Date; reviewCount: number },
  now: Date
): number;

export function computeReviewerConsistency(
  reviewerScores: number[]  // all scores across all reviews/axes
): number;
```

`computeReviewWeight` formula:

```
daysSinceVisit = (now - visitedOn) / 86400000
recency = Math.exp(-daysSinceVisit / RECENCY_HALF_LIFE_DAYS)
base = Math.min(reviewer.axisWeights[axis] / 3.0, 1.0)
filledAxes = count of keys in review.scores with defined values
completeness = filledAxes >= COMPLETENESS_FULL_THRESHOLD ? 1.0 : COMPLETENESS_PARTIAL_MULTIPLIER
weight = base * reviewer.tenureScore * reviewer.consistencyScore * recency * completeness
return clamp(weight, 0, 1)
```

`computeReviewerAxisWeight` formula:

```
base = STATUS_BASE_WEIGHT[reviewer.status]
countMult = Math.min(reviewsInAxis / AXIS_COUNT_SATURATION, AXIS_COUNT_MAX_MULTIPLIER)
validationRatio = (positive + 1) / (positive + negative + 2)  // Laplace smoothing
weight = base * countMult * (0.5 + validationRatio)
return clamp(weight, 0, 3.0)
```

Validations aren't yet implemented — default `positive=0`, `negative=0` which
yields a neutral ratio. Add a code comment flagging this.

`computeReviewerTenure` formula:

```
monthsActive = (now - createdAt) / (30 * 86400000)
monthsNormalised = Math.min(monthsActive / TENURE_MONTHS_SATURATION, 1.0)
countNormalised = Math.min(reviewCount / TENURE_COUNT_SATURATION, 1.0)
return TENURE_MONTHS_WEIGHT * monthsNormalised + TENURE_COUNT_WEIGHT * countNormalised
```

`computeReviewerConsistency` formula:

- If `reviewerScores.length < 5`, return `0.500` (not enough signal — see
  Section 9a).
- Bucket scores into 5 buckets: `[1-2, 3-4, 5-6, 7-8, 9-10]`.
- Compute entropy of the bucket distribution.
- Normalise by `log2(5) ≈ 2.3219` (max entropy of 5-bucket uniform).
- Return that ratio, clamped to `[0, 1]`.

### File `lib/scoring/aggregation.ts`

```typescript
export type WeightedReview = { score: number; weight: number };

export function aggregateVenueAxis(
  reviews: WeightedReview[],
  priorScore: number,
  priorStrength: number
): { score: number; confidence: number; effectiveN: number; rawCount: number };
```

Implementation:

```
filtered = reviews.filter(r => r.weight > 0.05)
if (filtered.length === 0) return { score: priorScore, confidence: 0, effectiveN: 0, rawCount: 0 }
weightedSum = sum(r.score * r.weight for r in filtered)
weightTotal = sum(r.weight for r in filtered)
posteriorScore = (weightedSum + priorScore * priorStrength) / (weightTotal + priorStrength)
confidence = weightTotal / (weightTotal + priorStrength)
return { score: posteriorScore, confidence, effectiveN: weightTotal, rawCount: filtered.length }
```

## Section 3: Pipeline in `lib/scoring/pipeline.ts`

This module does touch the database — it's the orchestration layer.

```typescript
export async function updateReviewerMetrics(supabase, reviewerIds?: string[]): Promise<{ updated: number }>;
export async function updateReviewerAxisWeights(supabase, reviewerIds?: string[]): Promise<{ updated: number }>;
export async function recomputeReviewWeights(supabase, reviewIds?: string[]): Promise<{ updated: number }>;
export async function recomputeVenueScores(supabase, venueIds?: string[]): Promise<{ updated: number; scoresMoved: number }>;
export async function runFullPipeline(supabase): Promise<PipelineRunReport>;
```

`PipelineRunReport` includes per-step counts, timing, and list of venues
whose overall score changed by `>0.3`.

Sequencing: metrics → axis weights → review weights → venue scores.
Out-of-order execution must raise a clear error.

Idempotency: every step safe to run multiple times. No partial state leakage.

Invocation: Next.js API route at `app/api/scoring/run/route.ts`, POST-only,
protected by `SCORING_CRON_SECRET` env var passed as bearer token. Triggered
nightly by cron. Also invokable locally via `npm run scoring:run`. Not
exposed to user traffic.

Latency-sensitive path: on review insert, do NOT trigger the pipeline.
Instead, add a row to a `scoring_dirty_queue` table marking reviewer and
venue dirty. Nightly job processes the queue. Keeps review submission fast.

## Section 4: Reading scores

Replace the current simple-average aggregation. New helper in
`lib/aggregation.ts` (or wherever the existing aggregation helpers live):

```typescript
export async function getVenueScores(supabase, venueId: string): Promise<{
  axes: Record<Axis, { score: number; confidence: number; reviewCount: number }>;
  displayable: boolean;  // true if confidence on 'overall' > 0.2
}>;
```

Below confidence `0.2`, UI shows "Not yet rated" rather than a misleading
number. Update `app/venues/page.tsx` and `app/venues/[slug]/page.tsx` to read
via this helper. Update sort-by-rating logic to use `score` and filter out
`!displayable` venues from ranked lists.

## Section 5: Transparency — explain endpoint

```typescript
explainVenueScore(supabase, venueId, axis): Promise<{
  displayedScore: number;
  confidence: number;
  totalReviews: number;
  effectiveReviews: number;
  topContributors: Array<{ reviewerDisplayName: string; weightContribution: number; score: number }>;  // top 5
  recencyProfile: { last6Months: number; sixTo18Months: number; older: number };  // % of weight
  priorPull: number;
}>;
```

Surface on venue detail page behind a "How is this calculated?" disclosure.

## Section 6: Simulation harness — `scripts/simulate.ts`

`npm run scoring:simulate -- --config scenarios/example.json` reads JSON
config that overrides `SCORING_CONSTANTS`, runs the pipeline against the
current DB snapshot, outputs a diff report: venues that moved, by how much,
reviewer weight changes, summary stats. Build before any tuning.

Example config:

```json
{
  "description": "Test halving the recency half-life",
  "overrides": { "RECENCY_HALF_LIFE_DAYS": 270 }
}
```

## Section 7: Testing requirements

Tests in `__tests__/scoring/`.

Pure function unit tests (Vitest):

- `weights.test.ts`: tabulated input/output pairs for every function. Edge
  cases: zero reviews, visit date = now, 10-year-old reviews, all-zero
  weights, malformed axis values.
- `aggregation.test.ts`: zero-review case returns prior; one-review case
  pulled strongly toward prior; many-review case converges on weighted mean;
  all-zero-weight case returns prior.

Property-based tests (fast-check):

- Review weight always in `[0, 1]`.
- Venue score always in `[1, 10]`.
- Confidence always in `[0, 1]`.
- Adding a review can't decrease venue confidence.
- Adding identical reviews asymptotically pulls score toward that score's
  value.

Golden dataset regression test:

- `__tests__/scoring/golden.test.ts` loads 50 venues × 500 reviews × 30
  reviewers fixture.
- Asserts specific scores within `±0.05` tolerance.
- PRs changing these values require conscious fixture update with PR comment
  explaining why.

Pipeline integration tests:

- Against test Supabase instance, not mocked.
- Idempotency: running full pipeline twice produces identical results.
- Ordering: running steps out of order produces clear error.

## Section 8: Rollout sequence

Each PR updates `AGENTS.md` and `docs/scoring.md`.

- **PR 1** (merged): Schema migration only. Empty tables. No app behaviour
  change.
- **PR 2** (merged): Pure functions in `lib/scoring/weights.ts` and
  `lib/scoring/aggregation.ts` with unit, property-based (`fast-check`), and
  golden-fixture test coverage in `__tests__/scoring/`. No DB integration.
- **PR 3**: Pipeline implementation, API route, one-off backfill script
  `npm run scoring:backfill`. Run backfill in staging first, inspect output,
  then production. App still reads from old aggregation.
- **PR 4**: Switch read path to `venue_axis_scores`. Behind feature flag
  `SCORING_USE_WEIGHTED`. Compare for a week. Keep old aggregation code
  intact under flag — do not clean up in this PR.
- **PR 5**: Remove feature flag and old aggregation. Add explain UI.
- **PR 6**: Simulation harness.

## Section 9: Non-negotiables

- No external API calls or DB access in `lib/scoring/weights.ts` or
  `lib/scoring/aggregation.ts`. Pure functions only.
- No rounding in intermediate computations. Round only at display time: 1
  decimal for scores, 2 for confidence.
- All scoring constants in `SCORING_CONSTANTS`. No magic numbers elsewhere.
- Pipeline must be idempotent. Partial runs re-runnable safely.
- `venue_axis_scores` is write-only from the scoring pipeline.
- RLS policies for new tables in the same migration as the table DDL.

## Section 9a: Decisions locked in

- Reviewer status is SQL-managed: `status text not null default 'active'
  check (status in ('seeded', 'invited', 'active'))` on `reviewers`.
  Promotion to `seeded` via SQL, no admin UI.
- New reviewer consistency default is `0.500`. Reviewers with fewer than 5
  scored values across their review history receive this default from
  `computeReviewerConsistency`, independent of tenure.
- Simulation harness ships in PR 6. No tuning of `SCORING_CONSTANTS` is
  permitted in PRs 1-5. If tuning becomes necessary mid-rollout, pull the
  harness forward — do not tune blind.

## Section 10: Deliberate omissions at MVP

- No reviewer validation table (helpful/disagree). Weighting formula has
  placeholder defaulting to neutral.
- No chain vs independent handling. UK third-wave split is less stark than
  Japanese restaurant platforms — revisit with real data.
- No recency-bucketed separate analytics. The explain endpoint surfaces
  bucket percentages for transparency only.
