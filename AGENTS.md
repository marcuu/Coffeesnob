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
reviewers more heavily.

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
  page.tsx              # Home
  auth/callback/        # OAuth callback handler
  login/                # Login page (Google OAuth) + server action
components/             # Shared React components (shadcn/ui in components/ui/)
hooks/                  # Custom React hooks
lib/                    # Types, utilities
utils/supabase/         # Supabase client factories (server, client, middleware)
supabase/               # SQL migrations and RLS policies
docs/                   # Documentation
__tests__/              # Vitest tests
```

## Key Patterns

- **Server vs. Client Supabase clients:** Always use `utils/supabase/server.ts` in server components/actions and `utils/supabase/client.ts` in client components. Never import the wrong one.
- **Auth guard:** Middleware uses `getSession()` (JWT-only, no network call) to redirect unauthenticated page requests to `/login`. The middleware matcher excludes public routes (`/login`, `/auth/callback`, static assets) and `/api/*`, so API routes do not return HTML redirects. Server actions and API routes must still call `supabase.auth.getUser()` explicitly for authoritative validation — middleware alone is not sufficient for API protection.
- **Server Actions:** Use server actions for mutations. Always verify `user` is non-null before mutating.
- **RLS as defense-in-depth:** All tables have RLS enabled. The `is_allowed_email()` function gates access. Do not rely on RLS as the sole auth check in application code.
- **Component conventions:** Client components use `"use client"`. shadcn/ui components live in `components/ui/` and should not be modified directly. App-level components live in `components/`.

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
- `reviewers` — profile extension of `auth.users` (1:1 by id). Holds `display_name`, `bio`, `home_city`, and denormalised stats: `review_count`, `venues_reviewed_count`, `first_review_at`, `last_review_at`. Stats are maintained by the `reviews_stats_trigger` on `public.reviews`.
- `venues` — coffee venues. Any allowlisted user can insert; only the creator can edit or delete. Third-wave-specific fields: `roasters text[]`, `brew_methods text[]`, `has_decaf`, `has_plant_milk`.
- `reviews` — multi-axis ratings (`rating_overall`, `rating_coffee`, `rating_ambience`, `rating_service`, `rating_value`, each 1-10) plus `body` and `visited_on`. Unique on `(venue_id, reviewer_id, visited_on)` so a reviewer can review a venue multiple times across visits.

A trigger on `auth.users` insert auto-creates a `reviewers` row with
`display_name` defaulted from the email local-part, so review FKs are always
satisfied on first login.

Matching TypeScript types live in `lib/types.ts`.

### Known limitations

- The app login page supports Google OAuth only. For local dev you can either
  wire `[auth.external.google]` in `supabase/config.toml` or talk to the DB
  via Studio / `psql` using the seeded email/password test accounts. A magic
  link / email fallback on the login page will be added when the venue/review
  UI lands.

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
