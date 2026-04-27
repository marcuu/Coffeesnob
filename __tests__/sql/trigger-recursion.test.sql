-- SQL fixture for the rating_overall recompute trigger.
-- Run against a fresh local Supabase database:
--
--   npm run db:reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f __tests__/sql/trigger-recursion.test.sql
--
-- The script either succeeds silently or raises an exception with the
-- failed assertion. It cleans up after itself.
--
-- Asserts:
--   1. rating_overall is populated by the trigger for every inserted row.
--   2. The trigger does not recurse: refresh_overall_for_bucket is called
--      exactly once per inserted top-level row, regardless of how many
--      rows are already in the bucket. Without the pg_trigger_depth() guard
--      the recompute UPDATEs would re-fire the trigger and the call count
--      would explode super-linearly.

begin;

-- Test reviewer + venues, isolated from any existing data.
do $$
declare
  v_reviewer uuid := gen_random_uuid();
  v_email text := 't_' || replace(v_reviewer::text, '-', '') || '@coffeesnob.test';
  v_venue_ids uuid[] := array(select gen_random_uuid() from generate_series(1,5));
  v_calls_before bigint;
  v_calls_after bigint;
  v_funcid oid;
  v_count int;
  v_min int;
  v_max int;
  v_review_ids uuid[];
begin
  -- Pre-create the supporting rows. Use the auth schema directly because the
  -- handle_new_auth_user trigger on auth.users.insert backfills reviewers.
  insert into public.allowed_users(email) values (v_email);
  insert into auth.users(id, email, created_at, updated_at)
    values (v_reviewer, v_email, now(), now());

  for i in 1..5 loop
    insert into public.venues(
      id, slug, name, address_line1, city, postcode, created_by
    ) values (
      v_venue_ids[i],
      't-venue-' || i || '-' || substr(replace(v_reviewer::text, '-', ''), 1, 8),
      'T venue ' || i,
      '1 Test St', 'London', 'EC1A 1AA', v_reviewer
    );
  end loop;

  -- Capture the function oid + call count before the inserts.
  select p.oid into v_funcid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'refresh_overall_for_bucket';

  if v_funcid is null then
    raise exception 'refresh_overall_for_bucket function not found';
  end if;

  -- pg_stat_user_functions is the cleanest way to count calls; if it isn't
  -- enabled (track_functions = none) the calls counter stays at 0 and the
  -- recursion-bound assertion below is skipped with a notice.
  select coalesce(calls, 0) into v_calls_before
    from pg_stat_user_functions where funcid = v_funcid;

  -- Insert 5 reviews with rating_overall = null and explicit bucket/rank.
  -- The trigger should populate rating_overall via refresh_overall_for_bucket.
  insert into public.reviews(
    venue_id, reviewer_id, rating_overall, rating_taste, rating_body,
    rating_aroma, rating_ambience, rating_service, rating_value,
    body, visited_on, bucket, rank_position
  )
  select
    v_venue_ids[gs],
    v_reviewer,
    1, -- placeholder; trigger overwrites
    8, 8, 8, 7, 7, 7,
    'fixture body for trigger test',
    current_date,
    'pilgrimage'::review_bucket,
    gs * 1000
  from generate_series(1,5) gs
  returning id into v_review_ids;

  -- Assertion 1: every inserted row has rating_overall populated and in band.
  select count(*), min(rating_overall), max(rating_overall) into v_count, v_min, v_max
    from public.reviews
   where reviewer_id = v_reviewer and bucket = 'pilgrimage';

  if v_count <> 5 then
    raise exception 'expected 5 reviews, got %', v_count;
  end if;
  if v_min < 7 or v_max > 10 then
    raise exception 'pilgrimage rating_overall out of band: min=%, max=%', v_min, v_max;
  end if;

  -- Assertion 2: refresh_overall_for_bucket called once per inserted row,
  -- not once per (row × bucket_size). With 5 rows in the bucket and a
  -- recursive trigger, the call count would be at least 5 + 5*5 = 30.
  select coalesce(calls, 0) into v_calls_after
    from pg_stat_user_functions where funcid = v_funcid;

  if v_calls_after = v_calls_before then
    -- track_functions disabled; can't measure. Surface a notice and skip.
    raise notice 'pg_stat_user_functions not tracking; skipping recursion-count assertion';
  else
    if v_calls_after - v_calls_before > 5 then
      raise exception 'trigger recursion: refresh_overall_for_bucket called % times for 5 inserts (expected ≤ 5)',
        v_calls_after - v_calls_before;
    end if;
  end if;

  raise notice 'trigger-recursion fixture passed: 5 rows populated, % refresh calls',
    v_calls_after - v_calls_before;
end$$;

rollback;
