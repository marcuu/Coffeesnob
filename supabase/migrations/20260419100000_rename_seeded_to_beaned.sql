-- Rename reviewer status tier from 'seeded' to 'beaned'.
-- For existing databases that already applied the older status check, this
-- migration rewrites rows and replaces any legacy seeded-status CHECK
-- constraints. Fresh installs still run this migration in order, so final
-- schema state remains 'beaned' either way.

update public.reviewers
set status = 'beaned'
where status = 'seeded';

alter table public.reviewers
  drop constraint if exists reviewers_status_check;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.reviewers'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
      and pg_get_constraintdef(c.oid) ilike '%seeded%'
  loop
    execute format(
      'alter table public.reviewers drop constraint if exists %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.reviewers
  add constraint reviewers_status_check
  check (status in ('beaned', 'invited', 'active'));
