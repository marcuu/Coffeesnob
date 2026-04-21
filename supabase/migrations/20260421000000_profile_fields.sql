-- Add username and avatar_url to reviewer profiles.
-- username: optional URL-safe handle used in public profile URLs.
-- avatar_url: optional profile image URL.
--
-- Streaks are computed dynamically at query time from review visited_on dates,
-- so no streak columns are needed in the DB.

alter table public.reviewers
  add column if not exists username text,
  add column if not exists avatar_url text;

-- Username must be lowercase, start with a letter or digit, and contain only
-- letters, digits, underscores, or hyphens. Length 2–30 chars.
alter table public.reviewers
  add constraint reviewers_username_format
  check (
    username is null
    or username ~ '^[a-z0-9][a-z0-9_-]{1,29}$'
  );

-- Enforce uniqueness on non-null usernames only.
create unique index if not exists reviewers_username_unique_idx
  on public.reviewers (username)
  where username is not null;

create index if not exists reviewers_username_idx
  on public.reviewers (username)
  where username is not null;
