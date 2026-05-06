-- Per-user cold start: priming venues, onboarding flag, wishlist, email throttle.
-- See docs/cold-start.md (PRD) for design context.
--
-- Existing reviewers are backfilled as already-onboarded so they aren't
-- forced through priming on next login. Production deployment must
-- separately tag the curated priming venues; for local dev, supabase/seed.sql
-- now seeds ~30 venues and flags them.

-- ---------------------------------------------------------------------------
-- 1. Reviewer onboarding flag
-- ---------------------------------------------------------------------------

alter table public.reviewers
  add column if not exists seen_onboarding_at timestamptz;

-- Backfill existing reviewers as already onboarded.
update public.reviewers
   set seen_onboarding_at = coalesce(seen_onboarding_at, now());

-- ---------------------------------------------------------------------------
-- 2. Priming venue flag
-- ---------------------------------------------------------------------------

alter table public.venues
  add column if not exists is_priming_venue boolean not null default false;

create index if not exists venues_is_priming_idx
  on public.venues (is_priming_venue)
  where is_priming_venue;

-- ---------------------------------------------------------------------------
-- 3. Wishlist
-- ---------------------------------------------------------------------------
-- Public-by-default per PRD §11 Q3. SELECT mirrors reviews_select; writes
-- restricted to the row's own reviewer_id.

create table if not exists public.review_wishlist (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.reviewers(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique (reviewer_id, venue_id)
);

create index if not exists review_wishlist_reviewer_idx
  on public.review_wishlist (reviewer_id, added_at desc);

alter table public.review_wishlist enable row level security;

drop policy if exists "review_wishlist_select" on public.review_wishlist;
create policy "review_wishlist_select"
  on public.review_wishlist for select
  to authenticated
  using (public.is_allowed_email());

drop policy if exists "review_wishlist_insert_self" on public.review_wishlist;
create policy "review_wishlist_insert_self"
  on public.review_wishlist for insert
  to authenticated
  with check (public.is_allowed_email() and reviewer_id = auth.uid());

drop policy if exists "review_wishlist_delete_self" on public.review_wishlist;
create policy "review_wishlist_delete_self"
  on public.review_wishlist for delete
  to authenticated
  using (public.is_allowed_email() and reviewer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Onboarding email throttle
-- ---------------------------------------------------------------------------
-- One row per reviewer who has been sent the 24-48h follow-up. Service-role
-- only writes; no policies for authenticated => default-deny.

create table if not exists public.onboarding_emails_sent (
  reviewer_id uuid primary key references public.reviewers(id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.onboarding_emails_sent enable row level security;

-- Mark every backfilled reviewer as already-emailed so the cron doesn't
-- treat the synthetic seen_onboarding_at = now() above as a real
-- completion and email all existing users.
insert into public.onboarding_emails_sent (reviewer_id, sent_at)
select id, now() from public.reviewers
on conflict (reviewer_id) do nothing;
