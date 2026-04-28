-- Invite hardening: privacy, race-safety, canonical email storage, and transactional acceptance.

-- Canonicalise any existing rows before adding stronger constraints.
update public.invites
set invitee_email = lower(trim(invitee_email));

-- Remove self-service update policy; invite status changes now go through
-- security-definer functions.
drop policy if exists "invites_update_self" on public.invites;

-- Ensure invite emails are always canonical lowercase.
alter table public.invites
  drop constraint if exists invites_invitee_email_lowercase;
alter table public.invites
  add constraint invites_invitee_email_lowercase
  check (invitee_email = lower(trim(invitee_email)));

create or replace function public.normalise_invitee_email()
returns trigger
language plpgsql
as $$
begin
  new.invitee_email := lower(trim(new.invitee_email));
  return new;
end;
$$;

drop trigger if exists invites_normalise_email_trigger on public.invites;
create trigger invites_normalise_email_trigger
  before insert or update on public.invites
  for each row execute function public.normalise_invitee_email();

-- Keep at most one pending invite per email globally.
update public.invites i
set status = 'expired'
from (
  select id
  from (
    select
      id,
      row_number() over (
        partition by lower(invitee_email)
        order by created_at desc, id desc
      ) as rn
    from public.invites
    where status = 'pending'
  ) ranked
  where rn > 1
) dupes
where i.id = dupes.id;

drop index if exists invites_pending_email_unique;
create unique index if not exists invites_pending_email_unique
  on public.invites (lower(invitee_email))
  where status = 'pending';

-- Atomic invite issuance (serialised per inviter).
create or replace function public.issue_invite(
  p_inviter_id uuid,
  p_invitee_email text,
  p_week_start timestamptz,
  p_weekly_limit int
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_invitee_email));
  v_used int;
begin
  if auth.uid() is null or auth.uid() <> p_inviter_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not public.is_allowed_email() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_inviter_id::text, 0));

  if exists (
    select 1
    from public.allowed_users
    where email = v_email
  ) then
    return 'already_member';
  end if;

  select count(*)
  into v_used
  from public.invites
  where inviter_id = p_inviter_id
    and created_at >= p_week_start
    and status in ('pending', 'accepted');

  if v_used >= p_weekly_limit then
    return 'quota_exceeded';
  end if;

  begin
    insert into public.invites (inviter_id, invitee_email)
    values (p_inviter_id, v_email);
  exception
    when unique_violation then
      return 'already_pending';
  end;

  return 'created';
end;
$$;

-- Atomic invite acceptance during auth callback.
create or replace function public.accept_invite_for_email(
  p_email text,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_invite_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_email, 0));

  select id
  into v_invite_id
  from public.invites
  where lower(invitee_email) = v_email
    and status = 'pending'
    and expires_at > now()
  order by created_at desc, id desc
  limit 1;

  if v_invite_id is null then
    return null;
  end if;

  insert into public.allowed_users (email)
  values (v_email)
  on conflict (email) do nothing;

  update public.invites
  set
    status = 'accepted',
    invitee_user_id = p_user_id,
    accepted_at = now()
  where id = v_invite_id;

  return v_invite_id;
end;
$$;
