-- Invite scarcity MVP.
-- Adds weekly invite tracking so allowlist access can be granted via reviewer invites.

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.reviewers(id) on delete cascade,
  invitee_email text not null,
  invitee_user_id uuid references public.reviewers(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invites_inviter_created_idx
  on public.invites (inviter_id, created_at desc);
create index if not exists invites_email_status_idx
  on public.invites (lower(invitee_email), status);
create unique index if not exists invites_pending_email_unique
  on public.invites (inviter_id, lower(invitee_email))
  where status = 'pending';

alter table public.invites enable row level security;

drop policy if exists "invites_select" on public.invites;
create policy "invites_select"
  on public.invites for select
  to authenticated
  using (public.is_allowed_email());

drop policy if exists "invites_insert_self" on public.invites;
create policy "invites_insert_self"
  on public.invites for insert
  to authenticated
  with check (
    public.is_allowed_email()
    and inviter_id = auth.uid()
  );

drop policy if exists "invites_update_self" on public.invites;
create policy "invites_update_self"
  on public.invites for update
  to authenticated
  using (public.is_allowed_email() and inviter_id = auth.uid())
  with check (public.is_allowed_email() and inviter_id = auth.uid());

drop trigger if exists invites_touch_updated_at on public.invites;
create trigger invites_touch_updated_at
  before update on public.invites
  for each row execute function public.touch_updated_at();
