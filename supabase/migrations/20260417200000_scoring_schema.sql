-- Scoring system schema (PR 1 of the weighted-scoring rollout).
-- See docs/scoring.md for the full design. This migration only lays the
-- foundation: reviewer status + four new tables for the batched pipeline.
-- Tables are populated by the scoring pipeline (PR 3), never by user writes.

-- ---------------------------------------------------------------------------
-- Reviewer status
-- ---------------------------------------------------------------------------
-- SQL-managed tier: 'seeded' (trusted curators, manually promoted), 'invited'
-- (vetted joiners), 'active' (default self-signed-up). Feeds
-- STATUS_BASE_WEIGHT in the scoring formula.

alter table public.reviewers
  add column if not exists status text not null default 'active'
    check (status in ('seeded', 'invited', 'active'));

-- Partial index: the vast majority of reviewers will be 'active', so we only
-- index the rarer tiers (seeded / invited) that the pipeline needs to look up.
create index if not exists reviewers_status_idx
  on public.reviewers (status)
  where status != 'active';

-- ---------------------------------------------------------------------------
-- reviewer_axis_weights — per-reviewer, per-axis credibility weight
-- ---------------------------------------------------------------------------

create table if not exists public.reviewer_axis_weights (
  reviewer_id uuid not null references public.reviewers(id) on delete cascade,
  axis text not null check (axis in ('overall', 'coffee', 'ambience', 'service', 'value')),
  weight numeric(4,3) not null default 0.500 check (weight >= 0 and weight <= 3),
  review_count_in_axis int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (reviewer_id, axis)
);

-- ---------------------------------------------------------------------------
-- reviewer_tenure — tenure / consistency scalars per reviewer
-- ---------------------------------------------------------------------------

create table if not exists public.reviewer_tenure (
  reviewer_id uuid primary key references public.reviewers(id) on delete cascade,
  tenure_score numeric(4,3) not null default 0.100
    check (tenure_score >= 0 and tenure_score <= 1),
  consistency_score numeric(4,3) not null default 0.500
    check (consistency_score >= 0 and consistency_score <= 1),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- review_weights — cached computed weight per review per axis
-- ---------------------------------------------------------------------------

create table if not exists public.review_weights (
  review_id uuid not null references public.reviews(id) on delete cascade,
  axis text not null check (axis in ('overall', 'coffee', 'ambience', 'service', 'value')),
  weight numeric(5,4) not null check (weight >= 0 and weight <= 1),
  computed_at timestamptz not null default now(),
  primary key (review_id, axis)
);

-- ---------------------------------------------------------------------------
-- venue_axis_scores — output read by the UI
-- ---------------------------------------------------------------------------

create table if not exists public.venue_axis_scores (
  venue_id uuid not null references public.venues(id) on delete cascade,
  axis text not null check (axis in ('overall', 'coffee', 'ambience', 'service', 'value')),
  score numeric(4,2) not null check (score >= 1 and score <= 10),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  effective_review_count numeric(6,2) not null,
  raw_review_count int not null,
  last_calculated_at timestamptz not null default now(),
  primary key (venue_id, axis)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- All four tables: read for any allowlisted user (confidence and review
-- counts are surfaced in the UI for transparency). Writes are service-role
-- only — no authenticated insert/update/delete policy exists, so RLS
-- default-denies those operations.

alter table public.reviewer_axis_weights enable row level security;
alter table public.reviewer_tenure       enable row level security;
alter table public.review_weights        enable row level security;
alter table public.venue_axis_scores     enable row level security;

drop policy if exists "reviewer_axis_weights_select" on public.reviewer_axis_weights;
create policy "reviewer_axis_weights_select"
  on public.reviewer_axis_weights for select
  to authenticated
  using (public.is_allowed_email());

drop policy if exists "reviewer_tenure_select" on public.reviewer_tenure;
create policy "reviewer_tenure_select"
  on public.reviewer_tenure for select
  to authenticated
  using (public.is_allowed_email());

drop policy if exists "review_weights_select" on public.review_weights;
create policy "review_weights_select"
  on public.review_weights for select
  to authenticated
  using (public.is_allowed_email());

drop policy if exists "venue_axis_scores_select" on public.venue_axis_scores;
create policy "venue_axis_scores_select"
  on public.venue_axis_scores for select
  to authenticated
  using (public.is_allowed_email());
