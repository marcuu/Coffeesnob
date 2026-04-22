-- Automates the daily scoring pipeline via pg_cron + pg_net.
--
-- SETUP (one-time, before deploying this migration):
--   1. Supabase Dashboard → Settings → Vault → Add a new secret:
--        Name:  scoring_endpoint_url
--        Value: https://<your-app-domain>/api/scoring/run
--   2. Add a second secret:
--        Name:  scoring_cron_secret
--        Value: (same string as your SCORING_CRON_SECRET environment variable)
--
-- After that, scores refresh automatically every day at 02:00 UTC.
-- No other configuration needed.
--
-- To change the schedule:
--   select cron.unschedule('daily-score-refresh');
--   select cron.schedule('daily-score-refresh', '0 2 * * *', 'select public.trigger_score_refresh()');
--
-- To run immediately (e.g. after a batch of new reviews):
--   select public.trigger_score_refresh();

-- pg_cron: schedules SQL jobs inside the database.
-- pg_net:  makes outbound HTTP requests from SQL.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- Reads the endpoint URL + auth secret from Supabase Vault, then fires a
-- POST to the Next.js scoring endpoint. Uses security definer so the cron
-- worker (which runs as a limited role) can read from vault.decrypted_secrets.
create or replace function public.trigger_score_refresh()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets
   where name = 'scoring_endpoint_url'
   limit 1;

  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where name = 'scoring_cron_secret'
   limit 1;

  if v_url is null then
    raise exception 'Vault secret "scoring_endpoint_url" not found — add it in Supabase Dashboard → Settings → Vault';
  end if;

  if v_secret is null then
    raise exception 'Vault secret "scoring_cron_secret" not found — add it in Supabase Dashboard → Settings → Vault';
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body    := '{}'::jsonb
  );
end;
$$;

-- Run every day at 02:00 UTC.
select cron.schedule(
  'daily-score-refresh',
  '0 2 * * *',
  'select public.trigger_score_refresh()'
);
