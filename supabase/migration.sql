-- Coffeesnob base schema.
-- Domain: UK third-wave coffee venues reviewed by allowlisted users on a
-- multi-axis (coffee / ambience / service / value / overall) scale.
--
-- Access is gated by an email allowlist; RLS enforces it at the DB layer as
-- defense-in-depth. Application code must still verify auth explicitly.

-- ---------------------------------------------------------------------------
-- Allowlist
-- ---------------------------------------------------------------------------

create table if not exists public.allowed_users (
  email text primary key,
  created_at timestamptz not null default now()
);

create or replace function public.is_allowed_email()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_users
    where email = (auth.jwt() ->> 'email')
  );
$$;

-- ---------------------------------------------------------------------------
-- Reviewers (profile extension of auth.users)
-- ---------------------------------------------------------------------------
-- Denormalised stats columns are maintained by the trigger defined below on
-- public.reviews. Recompute them from scratch if drift is ever suspected:
--
--   update public.reviewers r set
--     review_count          = coalesce(s.n,           0),
--     venues_reviewed_count = coalesce(s.distinct_v,  0),
--     first_review_at       = s.first_at,
--     last_review_at        = s.last_at
--   from (
--     select reviewer_id,
--            count(*) as n,
--            count(distinct venue_id) as distinct_v,
--            min(created_at) as first_at,
--            max(created_at) as last_at
--     from public.reviews group by reviewer_id
--   ) s where s.reviewer_id = r.id;

create table if not exists public.reviewers (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  bio text,
  home_city text,
  review_count integer not null default 0,
  venues_reviewed_count integer not null default 0,
  first_review_at timestamptz,
  last_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a reviewer row on user signup so FKs from reviews are always
-- satisfied. Display name defaults to the email local-part; user edits later.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reviewers (id, display_name)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'reviewer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Venues
-- ---------------------------------------------------------------------------

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  postcode text not null,
  country text not null default 'GB',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  website text,
  instagram text,
  roasters text[] not null default '{}',
  brew_methods text[] not null default '{}',
  has_decaf boolean,
  has_plant_milk boolean,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists venues_city_idx on public.venues (city);
create index if not exists venues_postcode_idx on public.venues (postcode);
create index if not exists venues_created_at_idx on public.venues (created_at desc);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
-- One reviewer may review the same venue across multiple visits; uniqueness
-- is on (venue, reviewer, visited_on).

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  reviewer_id uuid not null references public.reviewers(id) on delete cascade,
  rating_overall smallint not null check (rating_overall between 1 and 10),
  rating_coffee smallint not null check (rating_coffee between 1 and 10),
  rating_ambience smallint not null check (rating_ambience between 1 and 10),
  rating_service smallint not null check (rating_service between 1 and 10),
  rating_value smallint not null check (rating_value between 1 and 10),
  body text not null,
  visited_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, reviewer_id, visited_on)
);

create index if not exists reviews_venue_idx on public.reviews (venue_id, created_at desc);
create index if not exists reviews_reviewer_idx on public.reviews (reviewer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Reviewer stats maintenance
-- ---------------------------------------------------------------------------
-- Recomputes the affected reviewer(s)' denormalised counters after any write
-- to reviews. Handles insert/update/delete and reviewer_id changes.

create or replace function public.refresh_reviewer_stats(p_reviewer_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.reviewers r set
    review_count          = coalesce(s.n, 0),
    venues_reviewed_count = coalesce(s.distinct_v, 0),
    first_review_at       = s.first_at,
    last_review_at        = s.last_at,
    updated_at            = now()
  from (
    select
      count(*)                     as n,
      count(distinct venue_id)     as distinct_v,
      min(created_at)              as first_at,
      max(created_at)              as last_at
    from public.reviews
    where reviewer_id = p_reviewer_id
  ) s
  where r.id = p_reviewer_id;
$$;

create or replace function public.handle_review_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_reviewer_stats(old.reviewer_id);
    return old;
  elsif tg_op = 'UPDATE' and old.reviewer_id is distinct from new.reviewer_id then
    perform public.refresh_reviewer_stats(old.reviewer_id);
    perform public.refresh_reviewer_stats(new.reviewer_id);
  else
    perform public.refresh_reviewer_stats(new.reviewer_id);
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_stats_trigger on public.reviews;
create trigger reviews_stats_trigger
  after insert or update or delete on public.reviews
  for each row execute function public.handle_review_change();

-- ---------------------------------------------------------------------------
-- updated_at touch
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists venues_touch_updated_at on public.venues;
create trigger venues_touch_updated_at
  before update on public.venues
  for each row execute function public.touch_updated_at();

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.touch_updated_at();

drop trigger if exists reviewers_touch_updated_at on public.reviewers;
create trigger reviewers_touch_updated_at
  before update on public.reviewers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.allowed_users enable row level security;
alter table public.reviewers     enable row level security;
alter table public.venues        enable row level security;
alter table public.reviews       enable row level security;

-- allowed_users: readable to any signed-in allowed email; writes via service role only.
drop policy if exists "allowed_users_read" on public.allowed_users;
create policy "allowed_users_read"
  on public.allowed_users for select
  to authenticated
  using (public.is_allowed_email());

-- reviewers: all allowlisted users can read every reviewer profile (needed to
-- render review authorship). Users can only insert/update their own row.
drop policy if exists "reviewers_select" on public.reviewers;
create policy "reviewers_select"
  on public.reviewers for select
  to authenticated
  using (public.is_allowed_email());

drop policy if exists "reviewers_insert_self" on public.reviewers;
create policy "reviewers_insert_self"
  on public.reviewers for insert
  to authenticated
  with check (public.is_allowed_email() and id = auth.uid());

drop policy if exists "reviewers_update_self" on public.reviewers;
create policy "reviewers_update_self"
  on public.reviewers for update
  to authenticated
  using (public.is_allowed_email() and id = auth.uid())
  with check (public.is_allowed_email() and id = auth.uid());

-- venues: readable by anyone allowlisted; any allowlisted user can insert;
-- only the creator can edit or delete (until we add an admin role).
drop policy if exists "venues_select" on public.venues;
create policy "venues_select"
  on public.venues for select
  to authenticated
  using (public.is_allowed_email());

drop policy if exists "venues_insert" on public.venues;
create policy "venues_insert"
  on public.venues for insert
  to authenticated
  with check (public.is_allowed_email() and created_by = auth.uid());

drop policy if exists "venues_update_own" on public.venues;
create policy "venues_update_own"
  on public.venues for update
  to authenticated
  using (public.is_allowed_email() and created_by = auth.uid())
  with check (public.is_allowed_email() and created_by = auth.uid());

drop policy if exists "venues_delete_own" on public.venues;
create policy "venues_delete_own"
  on public.venues for delete
  to authenticated
  using (public.is_allowed_email() and created_by = auth.uid());

-- reviews: readable by anyone allowlisted; reviewers can only write their own.
drop policy if exists "reviews_select" on public.reviews;
create policy "reviews_select"
  on public.reviews for select
  to authenticated
  using (public.is_allowed_email());

drop policy if exists "reviews_insert_self" on public.reviews;
create policy "reviews_insert_self"
  on public.reviews for insert
  to authenticated
  with check (public.is_allowed_email() and reviewer_id = auth.uid());

drop policy if exists "reviews_update_self" on public.reviews;
create policy "reviews_update_self"
  on public.reviews for update
  to authenticated
  using (public.is_allowed_email() and reviewer_id = auth.uid())
  with check (public.is_allowed_email() and reviewer_id = auth.uid());

drop policy if exists "reviews_delete_self" on public.reviews;
create policy "reviews_delete_self"
  on public.reviews for delete
  to authenticated
  using (public.is_allowed_email() and reviewer_id = auth.uid());
