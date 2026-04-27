-- Pairwise ranking with Pilgrimage / Detour / Convenience buckets.
-- See docs/ranking.md for the full design. This migration only lays the
-- data foundation: enum, columns, function, trigger and backfill. The UI
-- and server-action work lands in subsequent PRs and is feature-flagged
-- until shipped.
--
-- Source-of-truth note: rating_overall stays smallint and stays in the
-- reviews table. Within-bucket ordering lives in rank_position; the
-- derived rating_overall is recomputed by trigger any time bucket
-- composition changes.

-- ---------------------------------------------------------------------------
-- Bucket enum
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'review_bucket') then
    create type public.review_bucket as enum (
      'pilgrimage', 'detour', 'convenience'
    );
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- Reviews columns
-- ---------------------------------------------------------------------------

alter table public.reviews
  add column if not exists bucket public.review_bucket,
  add column if not exists rank_position integer;

create index if not exists reviews_reviewer_bucket_rank_idx
  on public.reviews (reviewer_id, bucket, rank_position);

-- Deferrable so a single transaction can swap two rows' rank_positions or
-- compact a bucket without bouncing off the constraint mid-statement.
alter table public.reviews
  drop constraint if exists reviews_reviewer_bucket_rank_unique;
alter table public.reviews
  add constraint reviews_reviewer_bucket_rank_unique
    unique (reviewer_id, bucket, rank_position)
    deferrable initially immediate;

-- ---------------------------------------------------------------------------
-- compute_rating_overall
-- ---------------------------------------------------------------------------
-- Maps (bucket, rank, bucket_size) → integer 1-10. Lower rank = better.
-- For bucket_size = 1, returns the top of the band (10 / 7 / 4). Ties are
-- impossible because rank_position is unique within the bucket.

create or replace function public.compute_rating_overall(
  p_bucket public.review_bucket,
  p_rank int,
  p_bucket_size int
) returns smallint
language sql
immutable
as $$
  select round(case p_bucket
    when 'pilgrimage'
      then 7.0 + 3.0 * (p_bucket_size - p_rank + 1)::numeric / p_bucket_size
    when 'detour'
      then 4.0 + 3.0 * (p_bucket_size - p_rank + 1)::numeric / p_bucket_size
    when 'convenience'
      then 1.0 + 3.0 * (p_bucket_size - p_rank + 1)::numeric / p_bucket_size
  end)::smallint;
$$;

-- ---------------------------------------------------------------------------
-- refresh_overall_for_bucket
-- ---------------------------------------------------------------------------
-- Recomputes rating_overall for every review in a single (reviewer, bucket)
-- pair. Returns the row count for tests and observability.

create or replace function public.refresh_overall_for_bucket(
  p_reviewer_id uuid,
  p_bucket public.review_bucket
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_size int;
  v_updated int;
begin
  select count(*) into v_size
    from public.reviews
   where reviewer_id = p_reviewer_id
     and bucket = p_bucket;

  if v_size = 0 then
    return 0;
  end if;

  with ordered as (
    select id,
           row_number() over (order by rank_position asc)::int as rank
      from public.reviews
     where reviewer_id = p_reviewer_id
       and bucket = p_bucket
  )
  update public.reviews r
     set rating_overall =
           public.compute_rating_overall(p_bucket, ordered.rank, v_size)
    from ordered
   where r.id = ordered.id
     and r.rating_overall is distinct from
           public.compute_rating_overall(p_bucket, ordered.rank, v_size);

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill bucket and rank_position from current rating_overall
-- ---------------------------------------------------------------------------
-- Run before creating the recompute trigger so the existing rating_overall
-- column is preserved byte-for-byte (the scoring pipeline must produce
-- identical venue_axis_scores after this migration).

update public.reviews
   set bucket =
         case
           when rating_overall >= 7 then 'pilgrimage'::public.review_bucket
           when rating_overall >= 4 then 'detour'::public.review_bucket
           else 'convenience'::public.review_bucket
         end
 where bucket is null;

with ranked as (
  select id,
         (row_number() over (
            partition by reviewer_id, bucket
            order by rating_overall desc, created_at asc
          ))::int * 1000 as new_rank
    from public.reviews
)
update public.reviews r
   set rank_position = ranked.new_rank
  from ranked
 where r.id = ranked.id
   and r.rank_position is distinct from ranked.new_rank;

alter table public.reviews
  alter column bucket set not null,
  alter column rank_position set not null;

-- ---------------------------------------------------------------------------
-- Recompute trigger
-- ---------------------------------------------------------------------------
-- AFTER INSERT/UPDATE/DELETE on reviews. Calls refresh_overall_for_bucket
-- for the affected (reviewer, bucket) pair(s).
--
-- The pg_trigger_depth() = 1 guard ensures the trigger only acts on the
-- top-level write — when refresh_overall_for_bucket issues its own UPDATE,
-- this trigger re-fires at depth 2 and is a no-op. Without the guard the
-- recompute would cascade and the trigger would re-enter itself once per
-- updated row.
--
-- An UPDATE that changes bucket recomputes both the OLD and NEW buckets so
-- a cross-bucket move leaves both ends of the move correctly numbered.

create or replace function public.handle_review_overall_recompute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() <> 1 then
    -- Re-entry from refresh_overall_for_bucket's own UPDATE; skip.
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
  end if;

  if tg_op = 'DELETE' then
    perform public.refresh_overall_for_bucket(old.reviewer_id, old.bucket);
    return old;
  elsif tg_op = 'INSERT' then
    perform public.refresh_overall_for_bucket(new.reviewer_id, new.bucket);
    return new;
  else
    -- UPDATE: refresh OLD bucket if anything ranking-relevant changed there;
    -- always refresh NEW bucket.
    if old.reviewer_id is distinct from new.reviewer_id
       or old.bucket is distinct from new.bucket then
      perform public.refresh_overall_for_bucket(old.reviewer_id, old.bucket);
    end if;
    perform public.refresh_overall_for_bucket(new.reviewer_id, new.bucket);
    return new;
  end if;
end;
$$;

drop trigger if exists reviews_overall_recompute_trigger on public.reviews;
create trigger reviews_overall_recompute_trigger
  after insert or update or delete on public.reviews
  for each row execute function public.handle_review_overall_recompute();

-- ---------------------------------------------------------------------------
-- review_comparisons — append-only pairwise judgment record
-- ---------------------------------------------------------------------------
-- Captures every comparison the tournament UI produces. Append-only:
-- drag-reorders and bucket changes do NOT modify or delete these rows. Kept
-- for future Bradley-Terry / preference-model work; not consumed yet.
-- The winning_review_id / losing_review_id FKs use ON DELETE SET NULL so
-- the historical signal survives a review deletion.

create table if not exists public.review_comparisons (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.reviewers(id) on delete cascade,
  winning_review_id uuid references public.reviews(id) on delete set null,
  losing_review_id uuid references public.reviews(id) on delete set null,
  result text not null check (result in ('better', 'worse', 'same')),
  created_at timestamptz not null default now()
);

create index if not exists review_comparisons_reviewer_idx
  on public.review_comparisons (reviewer_id, created_at desc);

alter table public.review_comparisons enable row level security;

-- INSERT: allowlisted user, only as themselves.
drop policy if exists "review_comparisons_insert_self" on public.review_comparisons;
create policy "review_comparisons_insert_self"
  on public.review_comparisons for insert
  to authenticated
  with check (public.is_allowed_email() and reviewer_id = auth.uid());

-- SELECT: own rows only. Comparison history is private to the reviewer.
drop policy if exists "review_comparisons_select_self" on public.review_comparisons;
create policy "review_comparisons_select_self"
  on public.review_comparisons for select
  to authenticated
  using (reviewer_id = auth.uid());

-- UPDATE / DELETE: deliberately no policy => RLS default-denies for all
-- non-service roles. Comparisons are append-only.
