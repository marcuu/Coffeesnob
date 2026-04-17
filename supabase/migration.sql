-- Coffeesnob base schema.
-- Access is restricted by an email allowlist; RLS enforces it at the DB layer
-- as defense-in-depth. Application code must still verify auth explicitly.

create table if not exists public.allowed_users (
  email text primary key,
  created_at timestamptz not null default now()
);

-- True when the caller's JWT email is in allowed_users.
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

-- Example domain table. Replace with your real schema.
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.allowed_users enable row level security;
alter table public.items enable row level security;

-- allowed_users: readable to any signed-in allowed email; writes via service role only.
drop policy if exists "allowed_users_read" on public.allowed_users;
create policy "allowed_users_read"
  on public.allowed_users
  for select
  to authenticated
  using (public.is_allowed_email());

-- items: all operations gated on allowlist AND row ownership.
drop policy if exists "items_select" on public.items;
create policy "items_select"
  on public.items
  for select
  to authenticated
  using (public.is_allowed_email() and user_id = auth.uid());

drop policy if exists "items_insert" on public.items;
create policy "items_insert"
  on public.items
  for insert
  to authenticated
  with check (public.is_allowed_email() and user_id = auth.uid());

drop policy if exists "items_update" on public.items;
create policy "items_update"
  on public.items
  for update
  to authenticated
  using (public.is_allowed_email() and user_id = auth.uid())
  with check (public.is_allowed_email() and user_id = auth.uid());

drop policy if exists "items_delete" on public.items;
create policy "items_delete"
  on public.items
  for delete
  to authenticated
  using (public.is_allowed_email() and user_id = auth.uid());
