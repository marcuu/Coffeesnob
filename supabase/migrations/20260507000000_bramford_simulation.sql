-- Bramford synthetic-reviewer simulation v1.
-- Synthetic reviewers and reviews live in the same production tables but are
-- explicitly tagged. Fictional Bramford venues are real rows in `venues` with
-- `is_fictional=true`; v1 guardrails prevent synthetic reviewers from touching
-- real venues and real reviewers from touching fictional venues.

alter table public.reviewers
  add column if not exists is_synthetic boolean not null default false,
  add column if not exists persona_yaml text;

alter table public.reviews
  add column if not exists is_synthetic boolean not null default false;

alter table public.venues
  add column if not exists is_fictional boolean not null default false;

create index if not exists reviewers_is_synthetic_idx
  on public.reviewers (is_synthetic)
  where is_synthetic;

create index if not exists reviews_is_synthetic_idx
  on public.reviews (is_synthetic)
  where is_synthetic;

create index if not exists venues_is_fictional_idx
  on public.venues (is_fictional)
  where is_fictional;

create table if not exists public.simulation_venue_profiles (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  city_slug text not null default 'bramford',
  neighbourhood text not null,
  category text not null,
  prompt_description text not null,
  attribute_vector jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint simulation_venue_profiles_attribute_object
    check (jsonb_typeof(attribute_vector) = 'object')
);

create index if not exists simulation_venue_profiles_city_idx
  on public.simulation_venue_profiles (city_slug, neighbourhood);

create table if not exists public.agent_state (
  reviewer_id uuid primary key references public.reviewers(id) on delete cascade,
  last_tick_at timestamptz,
  reviews_written int not null default 0,
  current_obsession text,
  recent_venue_ids uuid[] not null default '{}',
  cumulative_prompt_tokens int not null default 0,
  cumulative_completion_tokens int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.simulation_ticks (
  id uuid primary key default gen_random_uuid(),
  tick_at timestamptz not null default now(),
  agents_active int not null default 0,
  reviews_generated int not null default 0,
  total_cost_usd numeric(10, 4) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.simulation_review_metadata (
  review_id uuid primary key references public.reviews(id) on delete cascade,
  reviewer_id uuid not null references public.reviewers(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  preference_score numeric(8, 4) not null,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  model_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists simulation_review_metadata_reviewer_idx
  on public.simulation_review_metadata (reviewer_id, created_at desc);

alter table public.simulation_venue_profiles enable row level security;
alter table public.agent_state enable row level security;
alter table public.simulation_ticks enable row level security;
alter table public.simulation_review_metadata enable row level security;

-- No authenticated/anon policies on simulation internals: service-role only.

-- Public Bramford review reads. Real-city reviews remain allowlist-gated by the
-- existing authenticated policy.
drop policy if exists "reviews_anon_synthetic_fictional_select" on public.reviews;
create policy "reviews_anon_synthetic_fictional_select"
  on public.reviews for select
  to anon
  using (
    is_synthetic = true
    and exists (
      select 1 from public.venues v
      where v.id = reviews.venue_id
        and v.is_fictional = true
    )
  );

-- Limited public synthetic profile view. Do not open the full reviewers table
-- to anon because persona_yaml is intentionally private to the service layer.
drop view if exists public.synthetic_reviewer_profiles;
create view public.synthetic_reviewer_profiles as
  select
    id,
    display_name,
    username,
    avatar_url,
    bio,
    home_city,
    review_count,
    venues_reviewed_count
  from public.reviewers
  where is_synthetic = true;

grant select on public.synthetic_reviewer_profiles to anon, authenticated;

create or replace function public.validate_review_population()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer_synthetic boolean;
  v_venue_fictional boolean;
begin
  select is_synthetic into v_reviewer_synthetic
    from public.reviewers
   where id = new.reviewer_id;

  select is_fictional into v_venue_fictional
    from public.venues
   where id = new.venue_id;

  if v_reviewer_synthetic is null then
    raise exception 'reviewer % does not exist', new.reviewer_id;
  end if;

  if v_venue_fictional is null then
    raise exception 'venue % does not exist', new.venue_id;
  end if;

  if v_reviewer_synthetic and not v_venue_fictional then
    raise exception 'synthetic reviewers can only review fictional venues';
  end if;

  if not v_reviewer_synthetic and v_venue_fictional then
    raise exception 'real reviewers cannot review fictional venues';
  end if;

  new.is_synthetic = v_reviewer_synthetic;
  return new;
end;
$$;

drop trigger if exists reviews_validate_population_trigger on public.reviews;
create trigger reviews_validate_population_trigger
  before insert or update of reviewer_id, venue_id, is_synthetic on public.reviews
  for each row execute function public.validate_review_population();
