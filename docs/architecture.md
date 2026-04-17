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
  Every app-data policy composes `is_allowed_email()` with row-level ownership
  checks (`user_id = auth.uid()`).
- Treat RLS as defense-in-depth, not as the primary auth check.

## Styling

- Tailwind v4 via `@tailwindcss/postcss`. Theme tokens live in `@theme` blocks
  in `app/globals.css`.
- shadcn/ui components are generated into `components/ui/` and should not be
  modified in place — extend with wrapper components in `components/` instead.

## Testing

- Vitest + jsdom + Testing Library. Add tests under `__tests__/` alongside new
  logic in `lib/` and for page/component regressions where the output is stable
  enough to render in Vitest.
