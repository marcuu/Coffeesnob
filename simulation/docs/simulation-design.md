# Caffiends Multiverse — Simulation Design (v1)

Canonical design reference. See `docs/architecture.md` for the file
structure summary and `docs/scoring.md §11` for pipeline integration.

## Why this exists

Caffiends' weighted-credibility algorithm needs data to work. At zero users
the leaderboards are empty, similarity matching has no population to compare
against, and reveal screens have no neighbours. The simulation provides a
populated reviewer ecosystem before real users arrive, acting as both
algorithm stress-test and cold-start data.

The simulation is **public-facing, not hidden**. Real users can browse
Bramford, read reviews, and see the leaderboard. Disclosure surfaces make the
synthetic nature explicit at every touchpoint.

## The fictional city — Bramford

A coffee-obsessed fictional UK-coastal city (population ~400k). Venues are
distributed across five neighbourhoods:

| Neighbourhood     | Character                                |
|-------------------|------------------------------------------|
| `harbourside`     | Waterfront, mix of tourist and locals    |
| `the-quarter`     | Creative district, modern third-wave     |
| `north-bank`      | Industrial conversion, roasters          |
| `old-town`        | Heritage, traditional café culture       |
| `university-park` | Academic community, value-conscious      |

v1 scope: 80 fictional venues seeded from `simulation/venues/bramford-seed.yaml`.

## The agent population — 50 personas

Hand-authored YAML files in `simulation/personas/`. Each persona defines:

- **Biography and voice register** — character, tone, length preference
- **Taste vector** — 10-dimensional preference weights (see below)
- **Calibration** — conformity, noise SD, pilgrimage/detour thresholds
- **Activity** — reviews per week, active days, sessions per visit

Population composition:
- 12 snob purists (high coffee_quality/roaster_purity weights)
- 8 modern third-wave enthusiasts (high vibe_modern)
- 7 Italian-tradition espresso heads (high espresso_skill, vibe_traditional)
- 6 baristas / industry insiders
- 5 milk-drink lovers / latte art fans
- 5 casual but curious mid-tier reviewers
- 4 contrarians (low conformity, high noise)
- 3 noisy reviewers (high noise SD, inconsistent scores)

Contrarians and noisy reviewers are present specifically to validate the
algorithm correctly down-weights them over time.

## Venue attribute vector (10 dimensions)

Each Bramford venue has an `attribute_vector` jsonb column:

| Dimension          | Description                            | Range  |
|--------------------|----------------------------------------|--------|
| `coffee_quality`   | Bean + extraction quality              | [0, 1] |
| `roaster_purity`   | Single-origin, light-roast credibility | [0, 1] |
| `espresso_skill`   | Barista talent on espresso             | [0, 1] |
| `manual_brew_skill`| V60/Aeropress/Chemex strength          | [0, 1] |
| `vibe_modern`      | Aesthetic, design-led                  | [0, 1] |
| `vibe_traditional` | Classic Italian or third-wave-classic  | [0, 1] |
| `service_warmth`   | Friendly vs austere                    | [0, 1] |
| `service_speed`    | Fast vs deliberate                     | [0, 1] |
| `value`            | Price/quality ratio                    | [0, 1] |
| `tourist_density`  | High tourist / low locals-only         | [0, 1] |

Persona taste vectors use the same dimensions but allow negative weights
(e.g., `tourist_density: -0.80` means actively avoids tourist venues).

## Preference computation

```
preference = dot(persona.taste_vector, venue.attribute_vector) / 10
           + normal(0, persona.noise)
           + venue_score_normalised × persona.conformity × 0.2
```

The result is clamped to [-1, 1] before bucket mapping.

## Bucket mapping

```
p = (preference + 1) / 2  →  [0, 1]
if p ≥ pilgrimage_threshold  → pilgrimage
if p ≥ detour_threshold      → detour
else                         → convenience
```

Coffee and vibe sub-scores (1-5) are computed from sub-vector dot products
anchored to the bucket band (pilgrimage floor = 3, detour = 2, convenience = 1).

## Daily tick

Cron: `0 8 * * *` via Vercel → `app/api/simulation/tick/route.ts`.

For each persona each day:
1. Check `active_days` — skip if today isn't an active day
2. Sample Bernoulli(`reviews_per_week / 7`) — skip if not reviewing today
3. Pick a venue (70% neighbourhood, 20% top-rated buzz, 10% random)
4. Compute preference + add noise + consensus pull
5. Map to bucket + coffee_5/vibe_5
6. Call Claude Sonnet 4.6 to write 60-220 word review body
7. Insert review directly via service role (bypasses `submitRankedReview`)
8. Insert synthesised `review_comparisons` rows consistent with rank ordering
9. Update `agent_state` (recent venues, token counts)

Monthly cost cap: $20 hard stop enforced in the cron route before running.

## Bootstrap

`npm run simulation:bootstrap` simulates 12 weeks of history in one go.
Expected output: 8,000–15,000 reviews, ~$50 total cost.
Cost cap for bootstrap: $50 (separate from the monthly cron cap).

## Disclosure

Three surfaces:

1. **Reviewer profile badge** — `SyntheticBadge` component on any reviewer
   page where `is_synthetic = true`
2. **Venue page note** — "Some reviews on this page are from Caffiends'
   calibration panel." shown when any review has `is_synthetic = true`
3. **`/about/calibration` page** — full plain-English explanation

## Soft-inclusion model

- Synthetic reviews **count toward venue scores** (so Bramford leaderboards
  are populated and functional)
- Synthetic reviewers are **excluded from the population prior** used in
  display-time cold-start smoothing (so real-user credibility calibration is
  unaffected)
- Real reviewers **cannot post against fictional venues** (gate in
  `submitRankedReview`)

## What v1 does not do

- No agent-to-agent social interactions
- No memory streams or agent planning
- No new agents joining over time
- No venue evolution (venues don't open or close)
- No events or narrative arcs
- No image generation for venues

These are v2 candidates.

## Recovery procedure

If a migration invalidates existing synthetic data:
1. `DELETE FROM reviews WHERE is_synthetic = true`
2. `DELETE FROM review_weights WHERE review_id NOT IN (SELECT id FROM reviews)`
3. Re-run scoring pipeline to clear orphaned venue scores
4. `npm run simulation:bootstrap`
