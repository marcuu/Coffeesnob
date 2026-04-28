-- Mark when a reviewer has acknowledged the new ranking onboarding screen.
-- Existing reviewers see the onboarding flow on their first login post-deploy
-- (see app/list/onboarding/page.tsx); the column is set to now() once they
-- click "Looks right". Newly-created reviewers are auto-bucketed too, but the
-- onboarding screen is harmless for them as well — gating purely on this
-- column keeps the logic simple.

alter table public.reviewers
  add column if not exists seen_ranking_onboarding_at timestamptz;
