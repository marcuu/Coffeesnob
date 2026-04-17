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

```bash
npm install
cp .env.example .env.local   # fill in Supabase values
npm run dev                  # http://localhost:3000
```

Run the SQL in `supabase/migration.sql` against your Supabase project, then
insert your email into `allowed_users` so RLS will allow reads/writes.

## Scripts

```bash
npm run dev         # Next dev server (Turbopack)
npm run build       # production build
npm run start       # run production build
npm run lint        # next lint
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run test:watch  # vitest watch
```

## Environment variables

See `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
