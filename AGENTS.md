# AGENTS.md — Coffeesnob

## Agent Instructions
- Keep documentation up to date by updating `README.md`, `AGENTS.md`, and documents in `docs/` to reflect changes made.
- After implementing a new feature add Vitest tests if suitable for automated testing.
- If not suitable for automated testing, or manual testing is additionally required, include testing steps in the pull request description.
- Do not resolve known issues unless requested.

## Project Overview

Coffeesnob is a UK third-wave coffee review app — a TableLog analogue where
authenticated, allowlisted users review venues on a multi-axis scale. The
long-term moat is an algorithm that weights experienced and critical
reviewers more heavily. See `docs/scoring.md` for the full design of the
weighted-scoring system (schema, pure functions, pipeline, rollout plan);
it is the source of truth for any scoring work.

Built on Next.js 15, Supabase (Auth, Postgres, Storage), Tailwind CSS v4, and
shadcn/ui (Radix primitives).

## Tech Stack

- **Framework:** Next.js 15 with App Router (`app/` directory), Turbopack in dev
- **Auth:** Supabase Auth (Google OAuth), guarded by middleware (`middleware.ts` → `utils/supabase/middleware.ts`). Middleware uses `getSession()` (local JWT check, no network round-trip) for the redirect gate on app pages and excludes `/api/*` so route handlers can return JSON auth errors; server actions and API routes use `getUser()` for authoritative validation.
- **Database:** Supabase Postgres with Row Level Security (RLS). Access is restricted to emails in the `allowed_users` table via `is_allowed_email()`.
- **Storage:** Supabase Storage — add buckets per feature, with RLS gated on `is_allowed_email()`.
- **Validation:** Zod v4
- **Testing:** Vitest (tests live in `__tests__/`)
- **Package manager:** npm

## Directory Structure

```
app/
  page.tsx              # Landing page — score-desc leaderboard for visitors; personalised feed for signed-in users.
                        # Routing note: the /onboarding experience was moved here. app/onboarding/page.tsx now
                        # issues a 308 permanent redirect to / so existing links and bookmarks stay valid.
                        # Files in app/onboarding/ (data.ts, venue-mapping.ts, etc.) are kept in place so that
                        # test imports from @/app/onboarding/* continue to resolve without changes.
  api/scoring/run/      # POST-only cron endpoint (SCORING_CRON_SECRET bearer)
  auth/callback/        # OAuth + magic-link callback handler
  login/                # Login page (Google OAuth + magic-link) + server actions
  onboarding/
    page.tsx            # 308 permanentRedirect to /
    data.ts             # Ranking types + pure functions (scoreVenueFor, rankVenues, etc.)
    venue-mapping.ts    # DB→onboarding shape conversion + city helpers
    onboarding-app.tsx  # Client root for signed-in users: sidebar, localStorage prefs, aha reveal, nudge
    leaderboard.tsx     # Client renderer for logged-out visitors: score-desc feed, no personalisation
    feed.tsx            # Ranked venue cards (used inside OnboardingApp)
    sidebar.tsx         # Preference panel (city / drink / taste) for signed-in users
    aha.tsx             # Top-pick reveal modal for signed-in users
  venues/
    page.tsx            # Venue listing with avg rating, score-desc default sort, + selectable ?city= filter
                        # "Add venue" button lives here (and only here).
    map/                # Auth-gated map view with pins for geocoded venues + external navigation
    new/                # Create venue form (auth-gated)
    [slug]/             # Venue detail, reviews, and add-review form (auth-gated)
    actions.ts          # Venue server actions (createVenue, deleteVenue)
components/             # Shared React components (shadcn/ui in components/ui/)
hooks/                  # Custom React hooks
lib/                    # Types, validators, aggregation helpers
  scoring/              # Pure weighted-scoring functions + pipeline (see docs/scoring.md)
scripts/                # Node CLIs (scoring:run, scoring:backfill, venues:geocode)
utils/supabase/         # Supabase client factories (server, client, middleware, service)
supabase/               # config.toml, migrations/, seed.sql
docs/                   # Documentation
__tests__/              # Vitest tests
```

## Key Patterns

- **Server vs. Client Supabase clients:** Always use `utils/supabase/server.ts` in server components/actions and `utils/supabase/client.ts` in client components. Never import the wrong one.
- **Auth guard:** Middleware uses `getSession()` (JWT-only, no network call) to redirect unauthenticated page requests to `/login`. The middleware marks `/`, `/login`, `/auth/callback`, and static assets as public; everything else (including `/venues`, `/venues/map`, `/venues/new`, `/venues/[slug]`, `/venues/[slug]/review`) is auth-gated. The middleware matcher excludes `/api/*` so API routes do not return HTML redirects. Server actions and API routes must still call `supabase.auth.getUser()` explicitly for authoritative validation — middleware alone is not sufficient for API protection.
- **Server Actions:** Use server actions for mutations. Always verify `user` is non-null before mutating.
- **RLS as defense-in-depth:** All tables have RLS enabled. The `is_allowed_email()` function gates access. Do not rely on RLS as the sole auth check in application code.
- **Component conventions:** Client components use `"use client"`. shadcn/ui components live in `components/ui/` and should not be modified directly. App-level components live in `components/`.
- **Onboarding defaults:** `prefs.city` should default to an empty string on first load so ranking starts UK-wide; apply city boost only after explicit user selection.
- **Landing page routing:** `/` is the personalised feed for signed-in users and a public leaderboard for visitors. The `app/onboarding/` directory remains intact for test imports; `app/onboarding/page.tsx` issues a 308 to `/`. "Add venue" CTA lives only in the `/venues` page header — do not add it to the landing page.
- **Public routes:** Only `/` (exact match), `/login`, and `/auth/callback` are publicly accessible. All `/venues/*` routes are auth-gated by middleware.
- **Theme tokens:** Use semantic CSS variables from `app/globals.css` for onboarding and modal UI states; ensure new accent/soft-accent backgrounds include dark-mode-safe contrast.

## Local Development

- `npm run db:start` boots the Supabase CLI stack (Postgres, Auth, Studio,
  Inbucket, Storage) in Docker. Migrations from `supabase/migrations/` apply
  on first start, and `supabase/seed.sql` runs after.
- `npm run db:reset` wipes the local DB and re-applies migrations + seed.
- Schema changes go in a new timestamped file under `supabase/migrations/`,
  not by editing the existing `20260417190000_init.sql`.
- Seed data (`supabase/seed.sql`) is idempotent — it no-ops if any venues
  already exist. Wipe with `db:reset` to re-seed.

## Database Schema

See `supabase/migrations/` for full DDL. Core tables:

- `allowed_users` — email allowlist (`email` primary key). Gates access via `is_allowed_email()`.
- `reviewers` — profile extension of `auth.users` (1:1 by id). Holds `display_name`, `bio`, `home_city`, and denormalised stats: `review_count`, `venues_reviewed_count`, `first_review_at`, `last_review_at`. Stats are maintained by the `reviews_stats_trigger` on `public.reviews`. Also has `status text` (`'beaned' | 'invited' | 'active'`, default `'active'`) — SQL-managed tier consumed by the scoring pipeline (see `docs/scoring.md`).
- `venues` — coffee venues. Any allowlisted user can insert; only the creator can edit or delete. Third-wave-specific fields: `roasters text[]`, `brew_methods text[]`, `has_decaf`, `has_plant_milk`.
- `reviews` — six user-entered rating axes (`rating_ambience`, `rating_service`, `rating_value`, `rating_taste`, `rating_body`, `rating_aroma`, each 1-10) plus derived `rating_overall` and legacy nullable `rating_coffee`. Composite weighted scores in the pipeline are `overall`, `coffee`, and `experience`. Unique on `(venue_id, reviewer_id, visited_on)` so a reviewer can review a venue multiple times across visits.
- `reviewer_axis_weights` — per-reviewer, per-axis credibility weight. Populated by the scoring pipeline, never by user writes.
- `reviewer_tenure` — per-reviewer tenure and consistency scalars. Populated by the scoring pipeline.
- `review_weights` — cached per-review, per-axis weight used to aggregate venue scores. Populated by the scoring pipeline.
- `venue_axis_scores` — weighted per-axis score, confidence, and review counts read by the UI. Populated by the scoring pipeline; read-only to authenticated clients via RLS.
- `scoring_dirty_queue` — append-only work queue for the nightly scoring pipeline. A trigger on `public.reviews` (`reviews_enqueue_scoring_trigger`) enqueues on insert/update/delete so review writes never block on recomputation. Drained by `runFullPipeline`.

A trigger on `auth.users` insert auto-creates a `reviewers` row with
`display_name` defaulted from the email local-part, so review FKs are always
satisfied on first login.

Matching TypeScript types live in `lib/types.ts`.

## Validation

Zod schemas in `lib/validators.ts` back both create/update paths:

- `venueCreateSchema` / `venueUpdateSchema` — venue fields plus allowlists
  for `brew_methods` (enum of `BREW_METHODS`) and a slug regex.
- `reviewCreateSchema` — six 1-10 axes (`ambience`, `service`, `value`, `taste`, `body`, `aroma`), 10-5000 char body, `YYYY-MM-DD` visit date, UUID venue_id. `rating_overall` is derived server-side from weighted inputs.
- Review scoring runs in a dedicated six-step flow at `app/venues/[slug]/review/page.tsx` (rendering `review-form.tsx`), and each slider starts at `5/10` before user interaction.

Server actions parse `FormData` with the `formString` / `formNumber` /
`parseCsv` helpers in the same file, then call `schema.safeParse`. On
failure they return a `fieldErrors` map keyed by Zod path so the form can
surface inline messages.

## Auth

Two sign-in paths on `/login`:

- **Google OAuth** via `loginWithGoogle` server action. Only works when
  `[auth.external.google]` is configured.
- **Magic link** via `loginWithEmail` server action (`signInWithOtp`). This
  is the primary path for local dev — the link lands in Inbucket at
  http://localhost:54324. Works in production too as a fallback.

Both flows share `/auth/callback` for session exchange.

## Testing

```bash
npm test            # run all tests (vitest)
npm run test:watch  # watch mode
```

Tests are in `__tests__/`. When adding new logic to `lib/`, add corresponding
tests.

## Environment Variables

See `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — browser key for rendering `/venues/map`.
- `GOOGLE_MAPS_API_KEY` — server key for postcode geocoding on venue create + `npm run venues:geocode`.
- `SUPABASE_SERVICE_ROLE_KEY` — used by the scoring pipeline (server-only, never exposed to the browser).
- `SCORING_CRON_SECRET` — bearer token required by `POST /api/scoring/run`.

## Scoring pipeline

Weighted scoring is computed in a batched pipeline (`lib/scoring/pipeline.ts`),
not inline on review writes. Invocation options:

- `POST /api/scoring/run` — nightly cron endpoint, bearer-authed.
- `npm run scoring:run` — manual full run for debugging.
- `npm run scoring:backfill` — one-off full recompute for rollout staging.

Review writes enqueue into `scoring_dirty_queue` via a DB trigger; the
pipeline drains it on each run. See `docs/scoring.md` for the full design.
