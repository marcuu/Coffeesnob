# Ranking — Pilgrimage / Detour / Convenience

Coffeesnob's review input is a **pairwise tournament inside a Michelin-style
bucket**, replacing the old `rating_overall` slider. The reviewer picks one
of three buckets, then binary-searches the new venue into the existing list
in that bucket. The six axis sliders (`taste`, `body`, `aroma`, `ambience`,
`service`, `value`) and the legacy `rating_coffee` are unchanged from the
pre-ranking flow.

## Buckets

| Bucket | Copy | Score band |
| --- | --- | --- |
| **Pilgrimage** | "I'd cross the city for this" | 7–10 |
| **Detour** | "Worth going out of my way" | 4–7 |
| **Convenience** | "Fine if I'm already nearby" | 1–4 |

Stored as a Postgres enum `review_bucket` on `public.reviews.bucket`. The
band overlap at 7 and 4 is intentional: the rounded score for the worst
review in a higher band can equal the best review in a lower band, so
moving a venue across a bucket boundary always changes the score.

## `rating_overall` is derived

`rating_overall smallint` stays in `public.reviews` as the input contract
to the existing scoring pipeline (see `docs/scoring.md`). It is no longer
user-input; it is recomputed from `(bucket, rank_position, bucket_size)` by
the SQL function `compute_rating_overall(bucket, rank, size)`:

```
score = round(band_floor + 3 * (size - rank + 1) / size)
```

where `band_floor` is `7` for pilgrimage, `4` for detour, `1` for
convenience. Lower `rank_position` is better. For `size = 1` the function
returns the top of the band (10 / 7 / 4). The function is `immutable` and
monotonically non-increasing in `rank` for fixed `(bucket, size)` —
asserted in `__tests__/compute-rating-overall.test.ts`.

`rating_overall` is recomputed for an entire `(reviewer_id, bucket)` pair
by `refresh_overall_for_bucket(reviewer_id, bucket)`. The
`reviews_overall_recompute_trigger` calls it on every insert / update /
delete; an UPDATE that changes bucket recomputes both `OLD.bucket` and
`NEW.bucket`.

The trigger uses a `pg_trigger_depth() = 1` guard so the recompute UPDATEs
don't re-fire the trigger and cascade. For an N-row INSERT into a bucket
the trigger fires N times at depth 1; the UPDATEs the refresh issues fire
the trigger at depth 2 and short-circuit. See
`__tests__/sql/trigger-recursion.test.sql` for the on-DB assertion.

## Sparse-integer rank scheme

Within a `(reviewer_id, bucket)` pair, `rank_position integer` is
1000-spaced on backfill (`1000`, `2000`, `3000`, …). New inserts go to the
midpoint between the two rank_positions they land between:

- **Top** (insertion index 0): `floor(candidates[0].rank_position / 2)`.
- **Bottom** (insertion index N): `candidates[N-1].rank_position + 1000`.
- **Middle**: `floor((candidates[i-1].rank_position + candidates[i].rank_position) / 2)`.

Backfilled at 1000-spacing this gives roughly 10 inserts between any two
existing items before we need to compact. On a unique-constraint collision
on `(reviewer_id, bucket, rank_position)`, the persistence layer runs
`compactBucket` for that bucket (renumbers to clean 1000-spaced positions
preserving order) and retries the insert once. If the retry also collides,
a structured error is returned and surfaced as a generic "couldn't save"
to the user.

The split is deliberate:

- **Pure functions** in `lib/ranking/binary-tournament.ts`
  (`startTournament`, `nextComparison`, `recordComparison`,
  `finalRankPosition`, `compactBucket`) assume a midpoint exists. They never
  hit the database.
- **Persistence layer** (server actions in `app/venues/[slug]/review/actions.ts`
  and `app/list/actions.ts`) handles unique-constraint collisions, calls
  `compactBucket` and retries.

## Append-only `review_comparisons`

Every comparison the tournament UI produces is recorded in
`public.review_comparisons` (`reviewer_id`, `winning_review_id`,
`losing_review_id`, `result`, `created_at`). The table is **append-only**:

- Drag-reorders on the list view do **not** insert or modify comparison
  rows. Manual reorders are not pairwise judgments.
- Bucket changes (a review moving from detour to pilgrimage, etc.) do not
  modify or delete comparison rows.
- `winning_review_id` and `losing_review_id` use `on delete set null` so
  the historical signal survives if either review is later deleted.

Why preserve all comparisons indefinitely? They are the input for a
future Bradley-Terry / preference-model layer that infers latent venue
strength from the pairwise judgment graph. The table is not consumed by
any UI today.

RLS: insert allowed for the reviewer themselves (own rows + allowlisted
email). Select restricted to own rows (comparison history is private).
Update and delete are denied for all non-service roles — RLS default-deny
applies because no policy is defined.

## Migration order and byte-identity guarantee

The Phase 1 migration (`supabase/migrations/20260427000000_pairwise_ranking.sql`)
is structured so the existing `rating_overall` column is preserved
byte-for-byte through the migration:

1. Add `bucket` and `rank_position` columns.
1. Define `compute_rating_overall` and `refresh_overall_for_bucket`.
1. **Backfill** `bucket` and `rank_position` from current `rating_overall`
   ordering (≥7 pilgrimage, ≥4 detour, else convenience), spaced by 1000.
1. Set both columns `NOT NULL`.
1. **Then** create the recompute trigger.

Because the trigger doesn't exist during the backfill, no review's
`rating_overall` is touched. After the migration, `rating_overall` only
diverges from its original seeded value when a bucket is mutated (a new
review is added, an existing review is reordered, or a review crosses
bucket boundaries) — at which point the entire bucket is re-derived from
`compute_rating_overall`.

### Diff protocol — verifying scoring-pipeline byte-identity

The acceptance test for Phase 1 is that the scoring pipeline output in
`public.venue_axis_scores` is byte-identical before and after the
migration:

```bash
# Before applying this migration:
pg_dump --data-only --table=public.venue_axis_scores --column-inserts \
  | sort > /tmp/scores-before.sql

# Apply the migration, then run the scoring pipeline:
npm run scoring:run

# After:
pg_dump --data-only --table=public.venue_axis_scores --column-inserts \
  | sort > /tmp/scores-after.sql

diff /tmp/scores-before.sql /tmp/scores-after.sql
# must produce zero output.
```

If `diff` produces output, something in the migration accidentally
re-derived `rating_overall` and the scoring pipeline picked up the change.

## File layout

- `supabase/migrations/20260427000000_pairwise_ranking.sql` — schema +
  backfill + trigger.
- `lib/types.ts` — `ReviewBucket`, `Review.bucket`, `Review.rank_position`,
  `ReviewComparison`, `ComparisonHistory`.
- `lib/ranking/binary-tournament.ts` — pure tournament functions.
- `__tests__/binary-tournament.test.ts` — unit tests for the pure
  functions.
- `__tests__/compute-rating-overall.test.ts` — TS mirror of the SQL
  formula's monotonicity and band semantics.
- `__tests__/sql/trigger-recursion.test.sql` — on-DB fixture for the
  trigger's recursion guard.
- `docs/ranking.md` — this file.

## Out of scope (separate work)

- Bradley-Terry consumption of `review_comparisons` — future work.
- OG share-card image generation for the reveal screen — separate PR.
- Migrating `rating_overall` to numeric — explicitly rejected; stays
  smallint.
- Making axis sliders optional — separate product decision.
