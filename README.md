# Coffeesnob

Next.js 15 + Supabase coffee review app.

## Getting Started

```bash
npm install
npm run db:start
cp .env.example .env.local
npm run dev
```

## Core Scripts

```bash
npm run dev
npm run build
npm run typecheck
npm test
npm run db:reset
npm run scoring:run
```

## Bramford Simulation

Bramford is the public calibration city: fictional venues plus labelled synthetic reviewers used to exercise the ranking and scoring system before real user density is high.

```bash
npm run simulation:seed-personas
npm run simulation:seed-bramford
npm run simulation:bootstrap-history
npm run simulation:run-tick
```

The daily cron endpoint is `/api/simulation/tick` and requires `Authorization: Bearer $SIMULATION_CRON_SECRET` or Vercel's `CRON_SECRET`.

Key boundaries:

- Synthetic reviewers only review fictional Bramford venues.
- Real reviewers cannot review Bramford venues.
- Real-world leaderboards exclude `is_fictional=true` venues.
- `/bramford` and `/about/calibration` are public disclosure surfaces.

See `docs/simulation-design.md` for details.
