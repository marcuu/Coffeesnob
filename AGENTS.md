# AGENTS.md - Coffeesnob

## Agent Instructions
- Keep documentation up to date by updating `README.md`, `AGENTS.md`, and documents in `docs/` to reflect changes made.
- After implementing a new feature add Vitest tests if suitable for automated testing.
- If not suitable for automated testing, or manual testing is additionally required, include testing steps in the pull request description.
- Do not resolve known issues unless requested.

## Project Overview

Coffeesnob is a UK third-wave coffee review app built on Next.js 15, Supabase, Tailwind CSS v4, and shadcn/ui. The long-term moat is a weighted scoring algorithm that gives more useful reviewer histories more influence. See `docs/scoring.md` and `docs/ranking.md` for scoring/ranking details.

## Bramford Simulation

Bramford is the v1 synthetic calibration city.

- Synthetic reviewers are normal `reviewers` rows with `is_synthetic=true` and frozen `persona_yaml`.
- Synthetic reviews are normal `reviews` rows with `is_synthetic=true`.
- Bramford venues are normal `venues` rows with `is_fictional=true` plus `simulation_venue_profiles` metadata.
- Real reviewers cannot review fictional venues; synthetic reviewers cannot review real venues. This is enforced by `persistRankedReview` and by the `reviews_validate_population_trigger` database trigger.
- Default real-world leaderboards and `/venues` exclude fictional venues. `/bramford` is the public fictional-city surface.
- `/api/simulation/tick` is a bearer-secured Vercel cron endpoint. Scripts live under `scripts/simulation-*`.

## Key Patterns

- Server components/actions use `utils/supabase/server.ts`; service-role work uses `utils/supabase/service.ts` and must stay server-only.
- Mutations must call `getUser()` or be service-role cron/script work.
- RLS remains defense-in-depth. Do not expose `service_role` or simulation internals to clients.
- Schema changes go in new migration files under `supabase/migrations/`.
- Tests live in `__tests__/` and should cover pure logic in `lib/` or `simulation/lib/`.

## Useful Commands

```bash
npm run dev
npm run typecheck
npm test
npm run scoring:run
npm run simulation:seed-personas
npm run simulation:seed-bramford
npm run simulation:bootstrap-history
npm run simulation:run-tick
```
