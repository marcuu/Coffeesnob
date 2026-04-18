-- Scoring dirty queue (PR 3 of the weighted-scoring rollout).
-- See docs/scoring.md Section 3. The nightly pipeline drains this queue to
-- avoid full-table recomputes. Populated by a trigger on public.reviews so
-- review-write latency stays unaffected by scoring work.
--
-- The trigger only enqueues — it never recomputes scores. That distinction
-- matters: the "no triggers" rule in Section 1 forbids score recomputation
-- triggers, not enqueue markers.

create table if not exists public.scoring_dirty_queue (
  id bigserial primary key,
  -- review_id intentionally has no FK: on DELETE we still want to recompute
  -- the venue, and cascading here would drop the marker before the pipeline
  -- runs. reviewer_id and venue_id cascade because their rows disappearing
  -- invalidates any pending work anyway.
  review_id uuid,
  reviewer_id uuid not null references public.reviewers(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  enqueued_at timestamptz not null default now()
);

create index if not exists scoring_dirty_queue_reviewer_idx
  on public.scoring_dirty_queue (reviewer_id);
create index if not exists scoring_dirty_queue_venue_idx
  on public.scoring_dirty_queue (venue_id);
create index if not exists scoring_dirty_queue_enqueued_idx
  on public.scoring_dirty_queue (enqueued_at);

create or replace function public.enqueue_scoring_dirty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.scoring_dirty_queue (review_id, reviewer_id, venue_id)
    values (old.id, old.reviewer_id, old.venue_id);
    return old;
  else
    insert into public.scoring_dirty_queue (review_id, reviewer_id, venue_id)
    values (new.id, new.reviewer_id, new.venue_id);
    -- On reviewer_id change, also mark the previous reviewer dirty.
    if tg_op = 'UPDATE' and old.reviewer_id is distinct from new.reviewer_id then
      insert into public.scoring_dirty_queue (review_id, reviewer_id, venue_id)
      values (old.id, old.reviewer_id, old.venue_id);
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists reviews_enqueue_scoring_trigger on public.reviews;
create trigger reviews_enqueue_scoring_trigger
  after insert or update or delete on public.reviews
  for each row execute function public.enqueue_scoring_dirty();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Readable by allowlisted users (surfaces "pending recalculation" states in
-- internal tooling). Writes are service-role only — the trigger above runs
-- with `security definer` so user INSERTs on reviews still enqueue without
-- the user needing direct INSERT permission on this table.

alter table public.scoring_dirty_queue enable row level security;

drop policy if exists "scoring_dirty_queue_select" on public.scoring_dirty_queue;
create policy "scoring_dirty_queue_select"
  on public.scoring_dirty_queue for select
  to authenticated
  using (public.is_allowed_email());
