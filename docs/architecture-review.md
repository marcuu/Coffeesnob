# Architecture Review

**Branch:** `claude/architecture-review-tQqB5`
**Date:** 2026-05-09
**Scope:** `app/`, `components/`, `lib/`, `utils/`, `simulation/`, `supabase/`
**Lines reviewed:** ~19,500 TS/TSX across 94 source files + 14 SQL migrations

This document is a snapshot critique. It does not prescribe a refactor; it
ranks options so the team can choose. Every score is opinionated and
defended in the methodology section.

---

## 1. Executive summary

Coffeesnob is a small Next.js 15 + Supabase app with a non-trivial weighted
scoring pipeline glued onto a personal-ranking review flow. The bones are
sound — pure scoring functions are tested, RLS is consistent, server
actions are typed end-to-end with Zod — but the app layer has
accumulated three structural problems:

1. **The "page" boundary leaks.** Several route folders (`app/onboarding/`,
   `app/list/onboarding/`, `app/venues/[slug]/review/`) host page-private
   client components, server actions, and pure helpers in the same
   directory as the route file, with no `_components` / `_lib`
   convention applied consistently. `app/profile/` *does* use that
   convention; nowhere else does.
2. **Two parallel onboarding flows exist.** `app/onboarding/` (the priming
   flow) and `app/list/onboarding/` (a separate cold-start client) both
   write `seen_onboarding_at` and overlap conceptually. The 308-redirect
   from `app/onboarding/page.tsx` to `/` is preserved only because tests
   import `@/app/onboarding/*`. Tests are dictating layout.
3. **Styling is bimodal.** README says Tailwind v4 + shadcn. In practice
   17 client components use heavy inline `style={{...}}` with hardcoded
   HSL/oklch literals, while 12 use Tailwind. The two systems share
   tokens (`var(--color-*)`) inconsistently.

None of these are bugs. All three increase the cost of every future
change.

---

## 2. Scoring methodology

Each dimension is scored 1–5:

| Score | Meaning |
|-------|---------|
| 5     | Best-in-class for an app at this stage. No friction. |
| 4     | Healthy. Minor improvements possible but no real cost. |
| 3     | Workable. Friction noticeable; hot paths suffer. |
| 2     | Drag. Every related change pays a tax. |
| 1     | Actively misleading or broken. |

Scores are weighted by **change frequency × blast radius**:
- *Change frequency* = how often this area is touched (commit log proxy).
- *Blast radius* = how many other files break if this changes.

A 3 in a high-weight area (e.g. server actions) hurts more than a 2 in a
low-weight area (e.g. simulation tooling). The weighted total is
**Architecture Health Index (AHI)**, range 0–100.

### Dimensions

| # | Dimension | What we look for |
|---|-----------|------------------|
| D1 | **Module boundaries** | Are layers (route / page-private / shared / pure / data) consistent? |
| D2 | **Cohesion** | Does each file/module own one thing? |
| D3 | **Coupling** | Are imports flowing the right way? Any circular or god-modules? |
| D4 | **Testability** | Can business logic be tested without DB or DOM? |
| D5 | **Type safety** | Schema → types → validators all aligned? |
| D6 | **Auth / data correctness** | RLS, server-side validation, race-safe writes? |
| D7 | **Observability** | Logs, analytics, error paths legible? |
| D8 | **Read-path performance** | DB round-trips per page, N+1, payload size. |
| D9 | **Write-path performance** | Round-trips per mutation, retries, transactions. |
| D10 | **Styling consistency** | One system or a stable mix? |
| D11 | **Documentation accuracy** | Docs match code? |
| D12 | **Onboarding cost** | How long for a new contributor to ship a small change? |

### Rubric anchors (worked example for D1)

> *Module boundaries — D1*
>
> - **5:** Every directory has a single, named purpose. `_components` /
>   `_lib` / `actions.ts` separation enforced. No back-imports from
>   `app/` to `components/`.
> - **4:** Convention applied consistently with one or two exceptions
>   documented in `AGENTS.md`.
> - **3:** Convention exists but is applied unevenly. *(← Coffeesnob)*
> - **2:** No clear convention; cross-cutting concerns scattered.
> - **1:** App and library code interleaved; ad-hoc paths.

---

## 3. Scoring results

| # | Dimension | Score | Weight | Contribution | Notes |
|---|-----------|------:|-------:|-------------:|-------|
| D1 | Module boundaries | **3** | 9 | 27 | `_components`/`_lib` only used in `app/profile/`. `app/onboarding/` is a non-routed module folder. |
| D2 | Cohesion | **2** | 8 | 16 | `priming-app.tsx` (1112L), `pipeline.ts` (622L), `review-form.tsx` (494L), `submitRankedReview` (203L) each own multiple unrelated concerns. |
| D3 | Coupling | **3** | 8 | 24 | `lib/aggregation.ts` mixes pure helpers and DB calls. `lib/scoring/pipeline.ts` is "pure-ish" but takes Supabase. No real circulars. |
| D4 | Testability | **4** | 7 | 28 | `lib/scoring/{weights,aggregation}.ts` are pure; `lib/ranking/binary-tournament.ts` is property-tested. Server-action tests are large but they exist. |
| D5 | Type safety | **3** | 6 | 18 | `lib/types.ts` is hand-written and admittedly "best-effort". Migrations are source of truth but no codegen. |
| D6 | Auth / correctness | **4** | 9 | 36 | Middleware + `getUser()` + RLS + Zod is layered correctly. Submit-review compaction is race-aware. |
| D7 | Observability | **3** | 4 | 12 | `lib/analytics.ts` is a thin track helper. Errors mostly bubble; no structured logging on the cron pipeline. |
| D8 | Read-path perf | **3** | 5 | 15 | Most pages parallelise queries with `Promise.all`. Middleware adds a per-request `reviewers` SELECT for non-onboarded users. |
| D9 | Write-path perf | **2** | 5 | 10 | `submitRankedReview` does 4–7 round-trips and a fan-out of compaction `UPDATE`s with no batching. No RPC. |
| D10 | Styling consistency | **2** | 5 | 10 | 17 files inline-style with HSL literals; 12 use Tailwind. Hardcoded `oklch(0.75 0.11 44)` accent appears in 6 files. |
| D11 | Doc accuracy | **3** | 4 | 12 | `AGENTS.md` says `/onboarding` exists; `app/onboarding/page.tsx` 308-redirects to `/`. Migrations vs `lib/types.ts` flagged as "best effort". |
| D12 | Onboarding cost | **3** | 5 | 15 | New contributor needs to read `AGENTS.md`, `docs/architecture.md`, `docs/scoring.md`, `docs/ranking.md` before touching reviews. |

**Architecture Health Index** = Σ(score × weight) / Σ(5 × weight)
= (27+16+24+28+18+36+12+15+10+10+12+15) / (9+8+8+7+6+9+4+5+5+5+4+5)·5
= **223 / 375 = 59.5 / 100**

> Translation: serviceable, but every category that is going to matter as
> the codebase grows (D2, D5, D9, D10) is a 2 or a 3.

---

## 4. Top findings

### F1. `app/onboarding/` is a non-routed module folder

`app/onboarding/page.tsx` 308-redirects to `/`, but the directory still
holds `priming-app.tsx`, `leaderboard.tsx`, `data.ts`, `venue-mapping.ts`,
`actions.ts`. `AGENTS.md` documents the situation honestly:

> Files in `app/onboarding/` (data.ts, venue-mapping.ts, etc.) are kept in
> place so that test imports from `@/app/onboarding/*` continue to resolve
> without changes.

That's a tail wagging a dog. Either move modules to `app/_priming/` or
`lib/priming/` and update tests, or actually use `app/onboarding/` as a
real route again. Picking neither leaves a folder whose meaning is "the
graveyard of the previous routing decision".

### F2. Two onboardings

- `app/onboarding/priming-app.tsx` — 1112-line client god-component.
  Welcome → priming grid → reveal → next-steps + a modal hosting the full
  rank flow.
- `app/list/onboarding/onboarding-client.tsx` — 114-line cold-start
  client.

Both write to `reviewers.seen_onboarding_at` (or `seen_ranking_onboarding_at` —
two different columns). The middleware gate at
`utils/supabase/middleware.ts:74` only checks one of them. From a cold
read I cannot tell which one is canonical. Council members in §6 split on
this.

### F3. `submitRankedReview` is a 200-line imperative pipeline

`app/venues/[slug]/review/actions.ts` does, in sequence:
1. `getUser()`
2. Zod parse
3. Fetch venue (fictional gate)
4. Fetch existing review for visit-date conflict
5. Fetch the user's bucket
6. Replay tournament history
7. Insert review (attempt 1)
8. On rank-collision: fetch+compact bucket, fan-out N updates, refetch
   bucket, replay again, retry insert
9. Insert N comparison rows (best-effort)
10. `revalidatePath` × 3
11. `track`

Each numbered step is 20–40 lines of imperative code. The function is
correct, race-aware, and well-commented — but it has at minimum
**six independent reasons to change** (auth, gating, schema, ranking,
collision, analytics). Splitting along those reasons would let you test
the rank-replay-and-collision logic without a Supabase fixture.

### F4. `lib/scoring/pipeline.ts` is "pure-ish"

The module decorator is `// Pure scoring functions. No DB access`
(weights.ts) but `pipeline.ts` (622 lines) lives next to it and takes a
`SupabaseClient` parameter. This is fine — orchestration *should*
concentrate I/O — but the four `fetch*ByVenues / fetch*ByReviewers /
fetch*ByIds` helpers replicate the same SELECT string. A 5-line
`reviewSelect` constant would deduplicate it.

The harder issue: `aggregateVenueAxis` is in `lib/scoring/aggregation.ts`
(pure) and `getVenueScores` / `explainVenueScore` are in
`lib/aggregation.ts` (data). Two files named "aggregation" doing
different things, both imported across `app/`. Easy bug magnet.

### F5. Inline-style sprawl

```bash
$ grep -rE "style=\{|style: React.CSSProperties" app components --include="*.tsx" -l | wc -l
17
```

Six files contain the literal accent `oklch(0.75 0.11 44)`. Three
contain identical `MONO` style objects. Eleven contain
`hsl(20 14.3% 4%)`. Theme tokens exist in `app/globals.css` for these,
but the inline blocks bypass them. A typography pass (e.g. moving from
serif to sans) would currently require touching each file.

### F6. Middleware adds a DB hit on every authenticated page

`utils/supabase/middleware.ts:67-79` reads `reviewers.seen_onboarding_at`
on every authenticated request to a non-allowed route. The comment claims
"once set, gating is a no-op so the steady-state cost is one indexed PK
lookup" — but **the SELECT happens regardless** of `seen_onboarding_at`.
For a logged-in active user, every page navigation pays this latency.

Fix: stash the boolean in a JWT custom claim or in a long-lived cookie
the middleware can read without a round-trip.

### F7. `lib/types.ts` is hand-rolled

`AGENTS.md` flags this:
> *"Matching TypeScript types live in lib/types.ts… prefer generating
> types from the Supabase CLI once the project is connected."*

The migrations folder has 14 files with non-trivial schema changes. Each
schema change is currently **two** edits (SQL + TS), with no compile-time
guarantee they agree. `supabase gen types typescript` would close this.

### F8. SELECT-string duplication

```ts
"id, venue_id, reviewer_id, rating_overall, rating_coffee_5, rating_vibe_5, bucket, rank_position, body, visited_on, created_at, updated_at"
```

…appears verbatim in `app/list/actions.ts`,
`app/venues/[slug]/review/actions.ts`, and the bucket-refetch path in
the same file. If the column set ever changes (and it has — see
`20260418120000_review_axes_twin_scores.sql`), all sites must be edited.

---

## 5. Simplification options

Three coherent paths. Each is internally consistent — picking two halves
of different options is the worst outcome.

### Option A — "Tighten the seams" (low risk, ~1 sprint)

Smallest delta. Keep the existing layering; enforce conventions.

- **A1.** Apply `_components/` and `_lib/` convention to every route
  that has page-private modules: `app/onboarding/`, `app/list/`,
  `app/venues/[slug]/review/`. Mechanical rename, no logic change.
- **A2.** Merge `lib/aggregation.ts` (data) into `lib/scoring/queries.ts`;
  rename `lib/scoring/aggregation.ts` → `lib/scoring/aggregate.ts`.
  Delete the name collision.
- **A3.** Extract a `reviewColumns` constant + a `selectReview()` helper
  for the shared SELECT string. Single source of truth.
- **A4.** Generate `lib/database.types.ts` via Supabase CLI; switch
  `lib/types.ts` to re-export the generated types and add app-specific
  augmentations (e.g. `ReviewBucket` union).
- **A5.** Cookie-cache the onboarding-completion bit in middleware.

**Cost:** ~3–5 days. Almost all mechanical. Test churn limited to
imports.
**Benefit:** D1 → 4, D3 → 4, D5 → 4, D8 → 4. AHI ≈ 70.
**Risk:** Low. No public-API change.

### Option B — "Service layer + UI primitives" (medium, ~2-3 sprints)

A real refactor. Introduces internal abstractions.

- **B1.** Everything in A, plus:
- **B2.** Carve `submitRankedReview` into:
  - `lib/reviews/replay.ts` — pure rank-replay & compaction (already
    half-done; centralize).
  - `lib/reviews/submit.ts` — orchestrator: auth, validate, replay,
    insert, retry.
  - `app/.../actions.ts` — thin wrapper that calls `submit()` and maps
    errors to action-result shape.
  Test the orchestrator with a fake Supabase (already exists at
  `__tests__/scoring/fake-supabase.ts`).
- **B3.** Replace inline-styled `Button`, `Section`, `Hint`, `Axis`,
  `MONO`-styled labels with shadcn primitives + a small typography
  set: `<Mono>`, `<Serif>`, `<Kicker>`. Live in `components/ui/typography.tsx`.
- **B4.** Move `app/onboarding/` modules into `lib/priming/` (logic) and
  `app/_priming/` (UI). Update test imports. Delete the redirect-only
  `app/onboarding/page.tsx`.
- **B5.** Decide which onboarding flag is canonical
  (`seen_onboarding_at` vs. `seen_ranking_onboarding_at`). Add a
  migration that drops the loser. Update middleware to match.

**Cost:** 2–3 sprints. Real test refactor: ~30% of `__tests__/` will need
import updates.
**Benefit:** D1 → 5, D2 → 4, D3 → 5, D9 → 4, D10 → 4, D12 → 4. AHI ≈ 82.
**Risk:** Medium. The submit-review carve risks regressing collision
behavior; mitigate with the existing 422-line test as the contract.

### Option C — "Server-action-as-RPC" (large, ~4-6 sprints)

A bigger rethink. Pushes write-path complexity into Postgres.

- **C1.** Everything in B, plus:
- **C2.** Replace the imperative `submitRankedReview` flow with a single
  Postgres RPC `submit_ranked_review(reviewer_id uuid, payload jsonb)`
  that:
  - Validates the venue / fictional gate / duplicate-visit check.
  - Replays the tournament inside the DB (pure function, no DDL).
  - Inserts the review and comparison rows in one transaction.
  - Returns the final rank + bucket size.

  The TS server action shrinks to ~30 lines: parse → call RPC →
  revalidate → analytics.
- **C3.** Move review weights, axis weights, and venue scores into a
  *materialized view* refreshed on a schedule, instead of four upsert
  loops. The pipeline becomes a single SQL query plus
  `REFRESH MATERIALIZED VIEW CONCURRENTLY`.
- **C4.** Generate the entire client API surface from
  Supabase + Postgres functions; the `lib/scoring/pipeline.ts` and
  `recomputeReviewWeights/recomputeVenueScores` become SQL.

**Cost:** 4–6 sprints. Requires Postgres expertise. New CI for SQL.
**Benefit:** D2 → 5, D4 → 5, D5 → 5, D9 → 5. AHI ≈ 88. Eliminates the
N+1 compaction fan-out.
**Risk:** High. Postgres functions have a worse local dev-loop than TS;
the team's bus-factor tightens around Postgres knowledge.

### Side-by-side

|                       | A | B | C |
|-----------------------|---|---|---|
| Effort (engineer-weeks) | 1 | 4 | 10 |
| AHI after              | 70 | 82 | 88 |
| Risk                   | Low | Medium | High |
| Reversibility          | Trivial | Easy | Hard |
| New skills required    | None | Light | Postgres functions, RLS-on-RPC |
| Pays for itself if…    | shipping minor features | hiring, multiple committers | scaling beyond 10k reviewers |

---

## 6. LLM-council assessment

Four "tech leads" with explicit, distinct priors review the options.
Each has a track record visible to the others; consensus is **not**
required.

### The council

| Persona | Background | Bias |
|---------|-----------|------|
| **Maya** — *Pragmatist Tech Lead* | 10 yr Rails / Next.js shops | "Ship the smallest thing that fixes the symptom." |
| **Ravi** — *Platform Architect* | Ex-FAANG, distributed systems | "Boundaries pay compound interest." |
| **Lena** — *Frontend Staff* | Design systems lead | "If the styling system isn't enforced, it doesn't exist." |
| **Sven** — *Data / Postgres* | Built two analytics platforms | "Anything you can express in SQL, should be." |

### Round 1 — opening positions

> **Maya:** *Option A.* The codebase is 19k lines and has paying-zero
> users that we've been told about. Spending two months on B is
> premature. A unblocks every other change: doc accuracy, Tailwind-only,
> generated types. The team can revisit B in three months when they
> actually feel pain.

> **Ravi:** *Option B.* I'd reject A as insufficient and C as
> over-rotation. The real failure mode here isn't perf, it's
> **orientation cost**. New contributors will keep stumbling on the
> "two onboardings" question and the inline-style/Tailwind split.
> B fixes the orientation problems with bounded scope. C creates
> Postgres-sized expertise debt the team hasn't earned.

> **Lena:** *Option B, but reorder.* Do B3 (typography primitives) and
> B4 (kill the second onboarding) first; do B2 (service layer) only if
> the review-flow changes again. Lena will not vote for any plan that
> leaves the inline-style sprawl in place — it's a tax on every UX
> change. Score D10 is the actual blocker.

> **Sven:** *Option C, conditional.* The submit-review flow does
> 4–7 round-trips with a serial fan-out. That number does not scale to
> a healthy review velocity (think 100 simultaneous submits during a
> launch). The pipeline is similarly inefficient: four upserts walking
> the whole table every nightly run. C is the only option that fixes
> these. But C is wrong if the team isn't going to grow Postgres
> expertise — and Maya is probably right that they aren't.

### Round 2 — cross-examination

> **Maya → Ravi:** "You said B has bounded scope, but B5 (kill one of
> the two onboarding flags) is a migration — that's the most
> destabilizing kind of work. Aren't you understating risk?"
>
> **Ravi:** "Granted. B5 is the riskiest item in B. We could split it:
> ship B1–B4 first, file a separate ticket for the migration once the
> winning flag is decided in code review."

> **Lena → Maya:** "A doesn't touch styling. If we ship A and stop,
> we've enshrined the inline-style sprawl as the de facto system. You
> okay with that?"
>
> **Maya:** "Add Tailwind enforcement as A6 — an ESLint rule that bans
> `style=` in `app/` and `components/` (allowlist `components/ui/` for
> shadcn internals). That's a 1-day spike that gives you 80% of B3 for
> 5% of the cost."

> **Sven → Ravi:** "B leaves `submitRankedReview` as TS. The collision
> retry is correct but it's ~80 LoC of imperative state machine that an
> RPC would replace with 20 LoC of TS + 50 LoC of SQL. Why pay that
> cost forever?"
>
> **Ravi:** "Because the team can debug a TS function with a
> stacktrace. They cannot, today, debug a Postgres function failing
> inside a transaction. The optimization is real but the operational
> cost is also real."

> **Ravi → Sven:** "Materialized views in B3 — sorry, C3 — break the
> 'incremental drain the dirty queue' design that already exists.
> You'd be replacing a working incremental system with a full refresh.
> Is that an upgrade?"
>
> **Sven:** "If the review count stays under ~100k, full refresh is
> faster than incremental. If it grows past that, incremental wins.
> The current design pre-optimizes for scale you don't have. But yes —
> if you expect 10x growth in 12 months, keep the queue."

### Round 3 — closing votes

| Vote | Maya | Ravi | Lena | Sven |
|------|------|------|------|------|
| **First choice** | A + ESLint | B (split) | B (reordered) | C (conditional) |
| **Second choice** | B (split) | A + ESLint | A + ESLint | B |
| **Veto** | C | — | A as-is | — |

### Council recommendation

The plurality of votes lands on **a hybrid: A + B's "easy wins"**:

- All of **Option A** (mechanical cleanup).
- **B3** — typography primitives + ESLint ban on inline `style=`.
- **B4** — collapse the dual onboarding directories.
- Defer **B2** (service layer for submit-review) until the next
  meaningful change to the review flow forces it.
- Defer all of **C** unless review velocity makes the round-trip count
  measurably painful (signal: P95 submit > 800ms or pipeline run >
  2 min).

This is roughly *Option B-minus*. Estimated cost: **6–8 engineer-days**.
Estimated AHI lift: **59 → ~75**.

The council is unanimous that:
1. Picking neither A nor B is the worst outcome.
2. F6 (middleware DB hit) and F7 (hand-rolled types) ship in *every*
   plan.
3. Inline-style sprawl is the blocker on UX iteration speed, not
   submit-review performance.

---

## 7. Recommended path forward

If the team picks the council recommendation, the order of work is:

1. **Day 1.** F7 — generate `database.types.ts`. Re-export from
   `lib/types.ts`. (Type-safety baseline before any other refactor.)
2. **Day 1.** F6 — cookie-cache `seen_onboarding_at`. (Removes
   per-request DB hit immediately.)
3. **Day 2.** F8 — extract `reviewColumns` + `selectReview()`.
4. **Day 2–3.** A1 — apply `_components` / `_lib` convention to every
   route folder. Mechanical.
5. **Day 3.** A2 — merge `lib/aggregation.ts` into `lib/scoring/`.
6. **Day 4–5.** B3 — typography primitives + Tailwind-only ESLint rule.
   Migrate the 17 inline-styled files in two PRs.
7. **Day 6–7.** B4 — pick one onboarding flow, archive the other,
   migrate the redundant column.
8. **Day 8.** Update `docs/architecture.md` and `AGENTS.md` to match
   the new layout. Close out.

After this, re-score. If D2 (cohesion) is still ≤3, schedule **B2** as
the next architectural sprint.

---

## 8. Appendix — file-level scoring (top offenders)

| File | Lines | Score | Why |
|------|------:|------:|-----|
| `app/onboarding/priming-app.tsx` | 1112 | 1.5 | God-component: 4 step screens + modal + tournament-candidate adapter + UI primitives. |
| `lib/scoring/pipeline.ts` | 622 | 3 | Long but cohesive. Could split per pipeline step; SELECT-string duplication. |
| `app/venues/[slug]/review/review-form.tsx` | 494 | 2.5 | 4-stage state machine + inline `NavButton` + inline `NotesStep`. |
| `app/onboarding/leaderboard.tsx` | 392 | 2 | All inline styles; renders nav, hero, leaderboard rows in one file. |
| `app/venues/[slug]/review/actions.ts` | 317 | 2 | See F3. |
| `components/list/ranked-list.tsx` | 316 | 3 | DnD logic dense but cohesive. |
| `app/venues/[slug]/page.tsx` | 311 | 3 | Lots of `Promise.all` + branching. Reasonable. |
| `simulation/lib/tick.ts` | 304 | 4 | Self-contained; well-bounded. |
| `app/rankings/[region]/page.tsx` | 292 | 3 | Inline styles, otherwise tidy. |
| `lib/onboarding/taste-summary.ts` | 225 | 4 | Pure, tested. |

---

## 9. Out of scope (deliberately)

- Bundle size analysis. (Run `next build --profile`; not part of this
  review.)
- Accessibility audit. (Several inline-styled buttons appear to have
  contrast issues but a real audit needs a tool.)
- The Bramford simulation layer. (Self-contained per
  `docs/architecture.md` §"Simulation Layer"; revisit only if it leaks
  into the main app.)
- The Postgres query plans. (See Sven's caveat in §6 round 2.)
