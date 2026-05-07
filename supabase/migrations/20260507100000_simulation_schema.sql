-- Simulation schema: synthetic reviewers, fictional venues, agent state, tick log.
-- All changes are additive — existing tables/policies are untouched.

-- ── Reviewers ─────────────────────────────────────────────────────────────────
alter table public.reviewers
  add column if not exists is_synthetic boolean not null default false,
  add column if not exists persona_yaml text;

create index if not exists reviewers_is_synthetic_idx
  on public.reviewers (is_synthetic);

-- ── Venues ────────────────────────────────────────────────────────────────────
alter table public.venues
  add column if not exists is_fictional boolean not null default false,
  -- Deterministic 10-dim attribute vector used by the simulation preference math.
  -- Stored as jsonb so the simulation library can read it without a schema migration
  -- every time we tune a venue's characteristics.
  add column if not exists attribute_vector jsonb;

create index if not exists venues_is_fictional_idx
  on public.venues (is_fictional);

-- ── Reviews ───────────────────────────────────────────────────────────────────
alter table public.reviews
  add column if not exists is_synthetic boolean not null default false;

create index if not exists reviews_is_synthetic_idx
  on public.reviews (is_synthetic);

-- ── Agent state ───────────────────────────────────────────────────────────────
-- Minimal v1 state persisted between daily ticks. Expanded in v2.
create table if not exists public.agent_state (
  reviewer_id          uuid        primary key references public.reviewers(id) on delete cascade,
  last_tick_at         timestamptz,
  reviews_written      int         not null default 0,
  current_obsession    text,
  recent_venue_ids     uuid[]      not null default '{}',
  cumulative_prompt_tokens     int not null default 0,
  cumulative_completion_tokens int not null default 0
);

alter table public.agent_state enable row level security;
-- No authenticated policies intentionally — service role only.

-- ── Tick log ─────────────────────────────────────────────────────────────────
create table if not exists public.simulation_ticks (
  id                uuid        primary key default gen_random_uuid(),
  tick_at           timestamptz not null default now(),
  agents_active     int,
  reviews_generated int,
  total_cost_usd    numeric(10, 6),
  notes             text
);

alter table public.simulation_ticks enable row level security;
-- Service role only.
