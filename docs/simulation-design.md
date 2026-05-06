# Bramford simulation v1

Bramford is Coffeesnob's public calibration city: fictional venues, synthetic reviewers, and clear disclosure. It exists to populate and stress the ranking experience before real reviewer density is high enough.

## Boundaries

- Production bootstrap target is 12 weeks and roughly 1,500 synthetic reviews.
- Synthetic reviewers only review `venues.is_fictional = true` venues.
- Real reviewers cannot review fictional venues.
- Real-world leaderboards and `/venues` exclude fictional venues by default.
- Bramford review/profile reads are public, but only through synthetic/fictional paths.

The database enforces the core population boundary with `reviews_validate_population_trigger`, and the app uses the shared `persistRankedReview` helper for both user submissions and simulation submissions.

## Data model

`reviewers.is_synthetic`, `reviewers.persona_yaml`, `reviews.is_synthetic`, and `venues.is_fictional` tag the shared production tables. Simulation-only state lives in:

- `agent_state`
- `simulation_ticks`
- `simulation_venue_profiles`
- `simulation_review_metadata`

`synthetic_reviewer_profiles` is a limited public view for public synthetic profile display. The full `reviewers` table remains allowlist-gated.

## Runtime

Scripts:

- `npm run simulation:seed-personas`
- `npm run simulation:seed-bramford`
- `npm run simulation:bootstrap-history`
- `npm run simulation:run-tick`

Cron:

- `GET /api/simulation/tick`
- `POST /api/simulation/tick`

Both require `Authorization: Bearer $SIMULATION_CRON_SECRET`, falling back to Vercel's `CRON_SECRET`.

Review prose uses `claude-sonnet-4-6` when `ANTHROPIC_API_KEY` is present. Without a key, local development uses deterministic fallback prose so seed and tick plumbing can still be tested.

## Scoring

Synthetic reviews are included in `venue_axis_scores` so Bramford has populated leaderboards. They are not proof that the credibility algorithm handles real human messiness; current credibility weighting is preserved and should not be read as consensus-calibrated down-weighting of contrarians.
