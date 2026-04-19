-- Rename reviewer status tier from 'seeded' to 'beaned'.
-- Keeps existing reviewer rows valid on upgraded databases.

update public.reviewers
set status = 'beaned'
where status = 'seeded';

alter table public.reviewers
  drop constraint if exists reviewers_status_check;

alter table public.reviewers
  add constraint reviewers_status_check
  check (status in ('beaned', 'invited', 'active'));
