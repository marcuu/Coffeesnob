# Architecture

> The migration files in `supabase/migrations/` are the canonical source of
> truth for the schema. The descriptions below are best-effort documentation;
> if anything here disagrees with a migration, the migration wins and this
> doc should be updated.

## Request flow

```
browser ──▶ middleware.ts ──▶ utils/supabase/middleware.ts
                                    │
                                    ├─ getSession() (JWT-only)
                                    │   └─ unauthenticated page → redirect /login
                                    │
                                    └─ matcher excludes /api/* and static assets
                                        │
                                        ▼
                              app/ route (page / server action / route handler)
                                        │
                                        ├─ server component / action
                                        │   └─ utils/supabase/server.ts → getUser()
                                        │
                                        └─ client component
                                            └─ utils/supabase/client.ts
```

## Auth

- **Provider:** Google OAuth through Supabase Auth.
- **Gate:** `middleware.ts` calls `updateSession()` which validates the session
  cookie with `getSession()` (no network round-trip). Unauthenticated requests
  to protected routes are redirected to `/login`.
- **Public routes:** `/` (exact match), `/login`, and `/auth/callback` are
  accessible without a session. All `/venues/*` routes are auth-gated.
  `_next` static assets and `/favicon.ico` are also exempt from the check.
- **Authoritative check:** Server actions and API route handlers must call
  `supabase.auth.getUser()` before mutating. `getSession()` is fast but only
  trusts the local JWT — don't use it for authorization in mutations.
- **Callback:** `/auth/callback` exchanges the OAuth code for a session and
  redirects back to the app.

## Data access

- Postgres via Supabase, with RLS enabled on every table.
- `is_allowed_email()` checks the caller's JWT email against `allowed_users`.
  Every app-data policy composes `is_allowed_email()` with a row-level
  ownership check where appropriate (`created_by = auth.uid()` for venues,
  `reviewer_id = auth.uid()` for reviews, `id = auth.uid()` for reviewers).
- Treat RLS as defense-in-depth, not as the primary auth check.

## Domain model

```
auth.users ──1:1──▶ reviewers ──1:N──▶ reviews ◀──N:1── venues
                   (stats cols)                         (created_by)
```

- **reviewers** extends `auth.users`. A trigger on user signup auto-creates a
  stub profile so review FKs are always satisfied.
- **venues** are user-submitted by any allowlisted user. The submitter owns
  edits/deletes until we introduce an admin role. The `/venues` listing page
  supports an exact-match city dropdown filter populated from known venue
  cities and defaults to ranking by displayed weighted score (high to low).
  The "Add venue" CTA lives only in the `/venues` page header.
- **reviews** use two user-entered 1-5 axes (`rating_coffee_5`,
  `rating_vibe_5`, both required) plus a derived `rating_overall` (1-10
  smallint, computed from the bucket / rank-position pair) and a nullable
  legacy `rating_coffee`. Each review also carries a `bucket` enum
  (`pilgrimage` / `detour` / `convenience`) and a sparse-integer
  `rank_position` for in-bucket ordering. Unique on `(venue_id,
  reviewer_id, visited_on)` — a reviewer can re-review the same venue on
  different visits. The composite axes the scoring pipeline aggregates over
  are `overall`, `coffee` (= `rating_coffee_5 * 2`) and `vibe` (=
  `rating_vibe_5 * 2`). Schema documentation here is best-effort;
  `supabase/migrations/` is authoritative.
- **landing page** (`/`) doubles as the personalised venue feed for signed-in
  users and a public leaderboard for visitors. Server component detects auth
  via `getUser()` and branches: signed-in users get `<OnboardingApp>` with
  sidebar/localStorage/aha; visitors get `<Leaderboard>` (score-desc,
  no personalisation). The `app/onboarding/` directory is kept intact for test
  imports; `app/onboarding/page.tsx` issues a 308 redirect to `/`.
- **onboarding ranking** starts with `prefs.city = ""` (no city boost) so first
  render is effectively UK-wide; city weighting is applied only after the user
  explicitly selects a location.

### Reviewer stats

`reviewers.review_count`, `venues_reviewed_count`, `first_review_at`, and
`last_review_at` are denormalised. They're maintained by
`public.handle_review_change()` firing on every `reviews` insert / update /
delete, which calls `public.refresh_reviewer_stats(reviewer_id)` to recompute
from source. If drift is ever suspected, `migration.sql` includes a one-shot
recompute query in a comment.

These fields are the raw inputs for the eventual reviewer-weighting
algorithm. The ranking logic itself should live in the app layer so it can
iterate without schema migrations; the DB only stores the signals.

## Styling

- Tailwind v4 via `@tailwindcss/postcss`. Theme tokens live in `@theme` blocks
  in `app/globals.css`, including dark-mode overrides for accent and soft-accent
  onboarding surfaces.
- Prefer semantic tokens over hardcoded light values so cards, pills, and modal
  callouts keep sufficient contrast in both themes.
- shadcn/ui components are generated into `components/ui/` and should not be
  modified in place — extend with wrapper components in `components/` instead.

## Write path

Mutations go through server actions that:

1. `getUser()` for authoritative auth (middleware is not sufficient).
2. Narrow `FormData` with `formString` / `formNumber` / `parseCsv`.
3. `schema.safeParse` via the Zod validators in `lib/validators.ts`.
4. Supabase write. RLS is layered underneath as defense-in-depth.
5. `revalidatePath` on affected routes, then `redirect` or return state.

Actions used with `useActionState` return a `{ status, message, fieldErrors }`
shape so forms can render inline Zod messages without round-tripping. The
review flow lives on `/venues/[slug]/review` as a four-stage experience:
bucket selection (Pilgrimage / Detour / Convenience) → pairwise tournament
inside the chosen bucket → two required 1-5 sliders (coffee + vibe, no
auto-fill default) → notes → reveal. See `docs/ranking.md` for the
ranking system and `docs/scoring.md` for how the two axes feed the
weighted-scoring pipeline.

## Simulation Layer (Bramford)

`simulation/` contains everything needed to run the Bramford fictional-city
simulation. It is self-contained; the rest of the app doesn't import from it.

```
simulation/
├── lib/
│   ├── persona-loader.ts       # YAML → typed Persona (Zod)
│   ├── preference.ts           # taste_vector × attribute_vector dot product
│   ├── bucket-mapping.ts       # preference score → bucket + coffee_5/vibe_5
│   ├── llm-review-writer.ts    # Claude Sonnet 4.6 review prose generation
│   ├── tournament-injection.ts # Direct DB insert with synthetic pairwise history
│   └── tick.ts                 # Daily tick orchestrator
├── scripts/
│   ├── seed-personas.ts        # One-off: create auth users + reviewer rows
│   ├── seed-bramford.ts        # One-off: create fictional venue rows
│   ├── bootstrap-history.ts    # One-off: simulate 12 weeks of history (~$50)
│   └── run-tick.ts             # Local dev single-tick runner
├── personas/                   # Hand-authored YAML files (50 personas)
└── venues/
    └── bramford-seed.yaml      # 80 fictional venue definitions
```

**Cron**: `app/api/simulation/tick/route.ts` runs daily at 08:00 UTC via
Vercel cron, secured with `SIMULATION_CRON_SECRET`. A monthly cost circuit
breaker ($20 cap) stops ticks if the limit is reached.

**Observability**: `/admin/simulation` shows tick history, monthly spend, and
per-agent review counts. Gated by `ADMIN_EMAILS` env var.

**Disclosure**: Synthetic reviews show a "Calibration Reviewer" badge on
reviewer names. Venue pages with synthetic reviews show a link to
`/about/calibration`. All Bramford venues are marked `is_fictional = true`.

See `docs/scoring.md` §11 for how the dual-population is handled in the
scoring pipeline.

## Testing

- Vitest + jsdom + Testing Library. Add tests under `__tests__/` alongside new
  logic in `lib/` and for page/component regressions where the output is stable
  enough to render in Vitest.
- Current coverage: `cn` class-merge helper, Zod venue + review validators,
  `summariseVenue` / `formatRating` aggregation helpers, and simulation math
  (`preference.ts`, `bucket-mapping.ts`).
