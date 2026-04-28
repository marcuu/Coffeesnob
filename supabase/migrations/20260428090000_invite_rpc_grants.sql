-- Ensure invite RPC functions are executable by app roles.

revoke all on function public.issue_invite(uuid, text, timestamptz, int) from public;
grant execute on function public.issue_invite(uuid, text, timestamptz, int)
  to authenticated, service_role;

revoke all on function public.accept_invite_for_email(text, uuid) from public;
grant execute on function public.accept_invite_for_email(text, uuid)
  to authenticated, service_role;
