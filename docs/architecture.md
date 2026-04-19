# Architecture

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
  cookie with `getSession()` (no network round-trip). Page requests for
  unauthenticated users are redirected to `/login`.
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
- **reviews** use five 1-10 axes (overall, coffee, ambience, service, value).
  Unique on `(venue_id, reviewer_id, visited_on)` — a reviewer can re-review
  the same venue on different visits.
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
review flow lives on `/venues/[slug]/review` as a six-step experience with
progress indicators; each slider starts at `5/10` and includes travel-time
calibration hints for third-wave expectations.

## Testing

- Vitest + jsdom + Testing Library. Add tests under `__tests__/` alongside new
  logic in `lib/` and for page/component regressions where the output is stable
  enough to render in Vitest.
- Current coverage: `cn` class-merge helper, Zod venue + review validators,
  and the `summariseVenue` / `formatRating` aggregation helpers.
