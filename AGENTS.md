# AGENTS.md — Coffeesnob

## Agent Instructions
- Keep documentation up to date by updating `README.md`, `AGENTS.md`, and documents in `docs/` to reflect changes made.
- After implementing a new feature add Vitest tests if suitable for automated testing.
- If not suitable for automated testing, or manual testing is additionally required, include testing steps in the pull request description.
- Do not resolve known issues unless requested.

## Project Overview

Scaffold for a Next.js 15 app built on Supabase (Auth, Postgres, Storage),
styled with Tailwind CSS v4 and shadcn/ui (Radix primitives).

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

## Database Schema

See `supabase/migration.sql` for full DDL. Starter tables:

- `allowed_users` — email allowlist (`email` primary key)
- `items` — example per-user table; replace with your real domain tables

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
