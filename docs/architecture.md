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
  edits/deletes until we introduce an admin role.
- **reviews** use five 1-10 axes (overall, coffee, ambience, service, value).
  Unique on `(venue_id, reviewer_id, visited_on)` — a reviewer can re-review
  the same venue on different visits.

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
  in `app/globals.css`.
- shadcn/ui components are generated into `components/ui/` and should not be
  modified in place — extend with wrapper components in `components/` instead.

## Testing

- Vitest + jsdom + Testing Library. Add tests under `__tests__/` alongside new
  logic in `lib/` and for page/component regressions where the output is stable
  enough to render in Vitest.
