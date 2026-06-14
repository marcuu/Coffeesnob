# Seed trusted palates (Option A)

Caffiends opens to a ~25-person, single-city cohort with almost no history. At
that scale the model **cannot yet measure who has a good palate** — there isn't
enough data for credibility, consistency, or predictive validity to mean
anything. So we bootstrap: a small, hand-picked seed set is crowned trusted at
launch, and measured credibility takes over as data accrues. This is "Option A"
from the PRD (Workstream E).

## What "crowned" means

A seed palate is set to the `beaned` reviewer tier — the anchor tier with base
weight `3.0` (`SCORING_CONSTANTS.STATUS_BASE_WEIGHT.beaned`). `beaned`
reviewers:

- carry the highest base credibility, and
- **bypass the new-account tenure/consistency penalty** in
  `computeReviewWeight`, so their *first* review can anchor an otherwise
  unreviewed venue off the prior.

Everything else about scoring is unchanged.

## The mechanism (built) vs. the rule (Marcus's call)

The **mechanism** is shipped and auditable:

- `lib/scoring/seed-palates.ts` — a typed registry. Every entry records the
  reviewer's `username`, a **stated `justification`**, and a `designatedOn`
  date. `validateSeedPalates()` rejects any entry missing a justification or
  with a duplicate/blank username, so no one can be crowned without a recorded
  reason.
- `npm run scoring:seed-palates` — idempotent script that promotes listed
  reviewers to `beaned`. It never demotes, and it reports any username with no
  matching `reviewers` row.

The **selection rule is a values decision for Marcus** (PRD §13.1 / E2) and is
deliberately *not* invented in code. Fill it in here before crowning anyone:

> **Selection rule (TO BE SET BY MARCUS):** _e.g. demonstrated review volume +
> breadth, professional background (Q-grader, roaster, barista champ), or a
> predictive track record from prior data. State the criteria explicitly so
> each designation can be audited against them._

Then add entries to `SEED_PALATES` whose `justification` cites this rule, and
run the apply script.

## Why this won't calcify into a clique

Seed status is intended to be **transitional**. As reviews accumulate, measured
signals — predictive validity (do early scores predict where venues settle?)
and inter-rater agreement (do trusted reviewers agree above chance?) — should
become the basis of credibility (Workstream F). Automated promotion/demotion
from those measures is a planned follow-up; until then, the registry is
reviewed by hand against the stated rule.

## Audit trail

- The registry lives in version control: every crowning is a reviewable diff
  with a justification.
- The apply script logs each promotion with its justification and never grants
  status outside the registry.
- No reviewer is silently privileged: `beaned` status is only meant to be set
  via this path.
