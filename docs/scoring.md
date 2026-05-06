# Weighted scoring for Coffeesnob

## Context

Coffeesnob computes venue scores from two review inputs on a 1-5 scale:
**`rating_coffee_5`** (the cup itself) and **`rating_vibe_5`** (everything around it). The pipeline scales these to a 1-10 internal representation so aggregation, prior, and confidence machinery operate on one scale.

Synthetic Bramford reviews are included in venue scoring for fictional Bramford venues. They are tagged with `reviews.is_synthetic = true`, and their reviewers are tagged with `reviewers.is_synthetic = true`. The production v1 simulation does not place synthetic reviews on real-world venues.

## Synthetic Data Behaviour

- `venue_axis_scores` reads all reviews, including synthetic reviews. This is intentional so Bramford leaderboards and reveal screens are populated.
- Real-city pages and leaderboards exclude `venues.is_fictional = true` by default.
- Real users cannot review fictional venues, and synthetic reviewers cannot review real venues. This is enforced in both app code and the `reviews_validate_population_trigger` migration.
- The current reviewer credibility algorithm is not consensus-calibrated enough to promise that contrarian or noisy synthetic personas will be down-weighted exactly as a human consensus model would. Bramford validates plumbing and necessary scoring properties, not sufficient proof of real-user behaviour.

## Existing Scoring Design

The previous six-axis schema (taste / body / aroma / ambience / service / value) was collapsed into the two axes above by migration `20260428000000_two_axis_collapse.sql`. See `docs/ranking.md` for the backfill mapping and rationale.

`rating_overall` is derived from `(bucket, rank_position, bucket_size)` via `compute_rating_overall(...)`, not user-entered. Review form captures two sliders plus the bucket choice and pairwise tournament.

The scoring pipeline remains batched and service-role driven:

1. `updateReviewerMetrics`
2. `updateReviewerAxisWeights`
3. `recomputeReviewWeights`
4. `recomputeVenueScores`

No triggers recompute scores on review insert; writes enqueue dirty scoring work and the pipeline handles aggregation later.

## Simulation Notes

See `docs/simulation-design.md` for the Bramford simulation architecture, seed scripts, cron route, and disclosure surfaces.
