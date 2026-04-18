-- Seed data for local development.
-- Runs automatically on `supabase db reset` (and on first `supabase start`
-- when the DB volume is empty). Safe to re-run.

-- ---------------------------------------------------------------------------
-- seed_user: create an email/password auth.users row plus the matching
-- auth.identities and public.allowed_users entries. The handle_new_auth_user
-- trigger auto-creates a reviewers row; we override its display_name after.
-- ---------------------------------------------------------------------------

create or replace function public.seed_user(
  p_email text,
  p_password text,
  p_display_name text default null
) returns uuid
language plpgsql
as $$
declare
  user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    user_id, 'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), user_id,
    jsonb_build_object('sub', user_id::text, 'email', p_email),
    'email', user_id::text,
    now(), now(), now()
  );

  insert into public.allowed_users (email)
    values (p_email)
    on conflict (email) do nothing;

  if p_display_name is not null then
    update public.reviewers
       set display_name = p_display_name
     where id = user_id;
  end if;

  return user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Test users, venues, reviews. All passwords: "password123".
-- ---------------------------------------------------------------------------

do $$
declare
  alice    uuid;
  bob      uuid;
  carol    uuid;
  prufrock uuid;
  kaffeine uuid;
  ozone    uuid;
  northstar uuid;
begin
  -- Only seed if we have no venues yet (idempotent on reset).
  if exists (select 1 from public.venues) then
    return;
  end if;

  alice := public.seed_user('alice@coffeesnob.local', 'password123', 'Alice');
  bob   := public.seed_user('bob@coffeesnob.local',   'password123', 'Bob');
  carol := public.seed_user('carol@coffeesnob.local', 'password123', 'Carol');

  insert into public.venues
    (slug, name, address_line1, city, postcode, roasters, brew_methods,
     has_decaf, has_plant_milk, notes, created_by)
  values
    ('prufrock-coffee', 'Prufrock Coffee',
     '23-25 Leather Lane', 'London', 'EC1N 7TE',
     array['Square Mile'],
     array['espresso','filter','batch_brew'],
     true, true,
     'Long-running Leather Lane fixture; Square Mile brews and a decent filter bar.',
     alice)
  returning id into prufrock;

  insert into public.venues
    (slug, name, address_line1, city, postcode, roasters, brew_methods,
     has_decaf, has_plant_milk, notes, created_by)
  values
    ('kaffeine-fitzrovia', 'Kaffeine',
     '66 Great Titchfield Street', 'London', 'W1W 7QJ',
     array['Square Mile','Workshop'],
     array['espresso','filter'],
     true, true,
     'Tight Fitzrovia shop, reliable espresso. Morning queue is real.',
     alice)
  returning id into kaffeine;

  insert into public.venues
    (slug, name, address_line1, city, postcode, roasters, brew_methods,
     has_decaf, has_plant_milk, notes, created_by)
  values
    ('ozone-shoreditch', 'Ozone Coffee Roasters',
     '11 Leonard Street', 'London', 'EC2A 4AQ',
     array['Ozone'],
     array['espresso','filter','batch_brew'],
     true, true,
     'Roastery and kitchen in Shoreditch; own beans, sit-down food.',
     bob)
  returning id into ozone;

  insert into public.venues
    (slug, name, address_line1, city, postcode, roasters, brew_methods,
     has_decaf, has_plant_milk, notes, created_by)
  values
    ('north-star-leeds', 'North Star Coffee Shop',
     'Leeds Dock', 'Leeds', 'LS10 1PZ',
     array['North Star'],
     array['espresso','filter','pour_over','batch_brew'],
     true, true,
     'North Star''s dockside flagship. Full pour-over menu.',
     carol)
  returning id into northstar;

  insert into public.reviews
    (venue_id, reviewer_id,
     rating_overall, rating_coffee, rating_ambience, rating_service, rating_value, rating_taste, rating_body, rating_aroma,
     body, visited_on)
  values
    (prufrock, alice, 9, null, 8, 9, 7, 10, 9, 10,
     'Square Mile filter was spot on. Loud at lunchtime but the bar staff keep it moving.',
     current_date - 7),
    (prufrock, bob, 8, null, 7, 8, 7, 9, 8, 9,
     'Espresso is consistently good. Seats fill up fast past 9am.',
     current_date - 3),
    (kaffeine, alice, 7, null, 6, 8, 7, 8, 7, 8,
     'Reliable Fitzrovia stop. Tight room, quick turnover, no surprises either way.',
     current_date - 14),
    (ozone, alice, 8, null, 9, 8, 6, 8, 8, 8,
     'Room is the selling point. Beans are solid, food raised the bill.',
     current_date - 21),
    (ozone, carol, 9, null, 9, 8, 7, 9, 9, 9,
     'Own roast shines on filter. Busy at weekends, worth the wait.',
     current_date - 2),
    (northstar, bob, 9, null, 9, 9, 8, 9, 9, 9,
     'Best pour-over experience I''ve had outside Melbourne. Staff knew every lot.',
     current_date - 30),
    (northstar, carol, 10, null, 9, 10, 9, 10, 10, 10,
     'Local bias noted, but it''s the real deal. Try the single-origin flight.',
     current_date - 5);
end $$;
