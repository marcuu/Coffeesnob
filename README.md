# Coffeesnob

Next.js 15 + Supabase scaffold.

## Tech stack

- **Framework:** Next.js 15 (App Router, Turbopack)
- **Language:** TypeScript
- **Auth / DB / Storage:** Supabase (Google OAuth, Postgres with RLS)
- **Styling:** Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **Validation:** Zod v4
- **Testing:** Vitest
- **Package manager:** npm

See `AGENTS.md` for project conventions and `docs/architecture.md` for the
architecture overview.

## Getting started

Prerequisites: Node 20+, Docker running (for the local Supabase stack).

```bash
npm install
npm run db:start            # boots local Supabase in Docker
cp .env.example .env.local  # then paste the API URL + anon key from db:start output
npm run dev                 # http://localhost:3000
```

The first `db:start` applies `supabase/migrations/` and runs `supabase/seed.sql`,
which creates three email/password test users (all password `password123`):

| email                      | display name |
| -------------------------- | ------------ |
| alice@coffeesnob.local     | Alice        |
| bob@coffeesnob.local       | Bob          |
| carol@coffeesnob.local     | Carol        |

...along with four London/Leeds venues and a handful of reviews.
The `/venues` page includes an **All cities / specific city** dropdown filter
driven by cities present in the database, and defaults to sorting venues by
displayed score (high to low).

### Useful URLs when the stack is up

- App: http://localhost:3000
- Supabase Studio: http://localhost:54323
- Inbucket (emails): http://localhost:54324
- Postgres: `postgresql://postgres:postgres@localhost:54322/postgres`

To wipe and re-seed:

```bash
npm run db:reset
```

### Signing in locally

The login page offers a magic-link flow. Enter one of the seeded emails (or
any email — Supabase local accepts all), click **Send magic link**, then open
Inbucket at http://localhost:54324 and click the link in the received email.
Google OAuth on the same page is disabled locally unless you configure
`[auth.external.google]` in `supabase/config.toml`.

### Production setup

Run the SQL in `supabase/migrations/` against your Supabase project (easiest:
`supabase db push` with the project linked), then insert your email into
`allowed_users` so RLS will allow reads/writes.

## Scripts

```bash
npm run dev         # Next dev server (Turbopack)
npm run build       # production build
npm run start       # run production build
npm run lint        # next lint
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run test:watch  # vitest watch
npm run db:start    # supabase start (local stack)
npm run db:stop     # supabase stop
npm run db:reset    # re-apply migrations + re-seed
```

## Environment variables

See `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`


## Scoring model

Reviews capture six slider inputs (ambience, service, value, taste, body, aroma),
and each slider defaults to **5/10** until the reviewer changes it.
`rating_overall` is derived from weighted inputs (10/10/10/25/20/25), and the
scoring pipeline computes weighted venue composites for `overall`, `coffee`, and
`experience`.
