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

  alice := public.seed_user('alice@caffiends.local', 'password123', 'Alice');
  bob   := public.seed_user('bob@caffiends.local',   'password123', 'Bob');
  carol := public.seed_user('carol@caffiends.local', 'password123', 'Carol');

  insert into public.venues
    (slug, name, address_line1, city, postcode, roasters, brew_methods,
     has_decaf, has_plant_milk, notes, created_by, is_priming_venue)
  values
    ('prufrock-coffee', 'Prufrock Coffee',
     '23-25 Leather Lane', 'London', 'EC1N 7TE',
     array['Square Mile'],
     array['espresso','filter','batch_brew'],
     true, true,
     'Long-running Leather Lane fixture; Square Mile brews and a decent filter bar.',
     alice, true)
  returning id into prufrock;

  insert into public.venues
    (slug, name, address_line1, city, postcode, roasters, brew_methods,
     has_decaf, has_plant_milk, notes, created_by, is_priming_venue)
  values
    ('kaffeine-fitzrovia', 'Kaffeine',
     '66 Great Titchfield Street', 'London', 'W1W 7QJ',
     array['Square Mile','Workshop'],
     array['espresso','filter'],
     true, true,
     'Tight Fitzrovia shop, reliable espresso. Morning queue is real.',
     alice, true)
  returning id into kaffeine;

  insert into public.venues
    (slug, name, address_line1, city, postcode, roasters, brew_methods,
     has_decaf, has_plant_milk, notes, created_by, is_priming_venue)
  values
    ('ozone-shoreditch', 'Ozone Coffee Roasters',
     '11 Leonard Street', 'London', 'EC2A 4AQ',
     array['Ozone'],
     array['espresso','filter','batch_brew'],
     true, true,
     'Roastery and kitchen in Shoreditch; own beans, sit-down food.',
     bob, true)
  returning id into ozone;

  insert into public.venues
    (slug, name, address_line1, city, postcode, roasters, brew_methods,
     has_decaf, has_plant_milk, notes, created_by, is_priming_venue)
  values
    ('north-star-leeds', 'North Star Coffee Shop',
     'Leeds Dock', 'Leeds', 'LS10 1PZ',
     array['North Star'],
     array['espresso','filter','pour_over','batch_brew'],
     true, true,
     'North Star''s dockside flagship. Full pour-over menu.',
     carol, true)
  returning id into northstar;

  -- Additional priming venues spanning the UK third-wave taste space.
  -- Mix of universally-loved classics, divisive pours, regional standouts,
  -- and chains as bottom-anchors per PRD §5.2.
  insert into public.venues
    (slug, name, address_line1, city, postcode, roasters, brew_methods,
     has_decaf, has_plant_milk, notes, created_by, is_priming_venue)
  values
    ('workshop-marylebone', 'Workshop Coffee', '75 Wigmore Street',
     'London', 'W1U 1QD', array['Workshop'],
     array['espresso','filter','batch_brew'], true, true,
     'Workshop''s Marylebone room. Their own roast, careful brews.', alice, true),
    ('monmouth-borough', 'Monmouth Coffee', '2 Park Street',
     'London', 'SE1 9AB', array['Monmouth'],
     array['espresso','filter','pour_over'], true, true,
     'Borough Market institution. Purist heaven or tourist trap, depending who you ask.',
     alice, true),
    ('origin-charlotte-street', 'Origin Coffee', '65 Charlotte Street',
     'London', 'W1T 4PF', array['Origin'],
     array['espresso','filter','batch_brew'], true, true,
     'Origin''s Fitzrovia shop. Cornish roast, clean brews.', bob, true),
    ('curators-fenchurch', 'Curators Coffee Studio',
     '9A Cullum Street', 'London', 'EC3M 7JJ',
     array['Nude','Workshop'], array['espresso','filter'], true, true,
     'Tucked-away City studio with rotating roasters.', bob, true),
    ('caravan-kings-cross', 'Caravan Coffee Roasters',
     '1 Granary Square', 'London', 'N1C 4AA', array['Caravan'],
     array['espresso','filter','batch_brew'], true, true,
     'Big Granary Square room; own roast, all-day kitchen.', carol, true),
    ('climpsons-broadway', 'Climpson & Sons',
     '67 Broadway Market', 'London', 'E8 4PH', array['Climpson & Sons'],
     array['espresso','filter','batch_brew'], true, true,
     'Broadway Market original. Climpson''s own beans on a tight bar.',
     alice, true),
    ('allpress-shoreditch', 'Allpress Espresso',
     '58 Redchurch Street', 'London', 'E2 7DP', array['Allpress'],
     array['espresso','filter'], true, true,
     'NZ-roasted espresso, Shoreditch backstreet.', bob, true),
    ('nude-spitalfields', 'Nude Espresso',
     '26 Hanbury Street', 'London', 'E1 6QR', array['Nude'],
     array['espresso','filter'], true, true,
     'Long-running Spitalfields espresso bar. Own roast.', carol, true),
    ('tap-rathbone', 'Tap Coffee',
     '193 Wardour Street', 'London', 'W1F 8ZF', array['Workshop'],
     array['espresso','filter'], true, true,
     'Soho tap-style espresso; small room, quick turnover.', alice, true),
    ('department-leather-lane', 'Department of Coffee and Social Affairs',
     '14-16 Leather Lane', 'London', 'EC1N 7SU', array['Department'],
     array['espresso','filter','batch_brew'], true, true,
     'Leather Lane flagship. Reliable, broad menu.', bob, true),
    ('assembly-brixton', 'Assembly Coffee',
     '17 Roupell Street', 'London', 'SE1 8TB', array['Assembly'],
     array['espresso','filter'], true, true,
     'Brixton roaster; clean filter, careful espresso.', carol, true),
    ('square-mile-bethnal-green', 'Square Mile Coffee Roasters',
     'Unit 5, Pratt Mews', 'London', 'NW1 0AD', array['Square Mile'],
     array['espresso','filter','batch_brew'], true, true,
     'Square Mile roastery cafe. Reference espresso for many UK shops.',
     alice, true),
    ('tamper-sellers-wheel', 'Tamper Sellers Wheel',
     '149 Arundel Street', 'Sheffield', 'S1 2NU', array['Workshop'],
     array['espresso','filter','pour_over'], true, true,
     'Kiwi-run Sheffield landmark. Brunch + pour-over.', bob, true),
    ('foundation-edinburgh', 'Foundation Coffee House',
     '2 Hunter Square', 'Edinburgh', 'EH1 1QW', array['Steampunk'],
     array['espresso','filter'], true, true,
     'Old Town Edinburgh shop with rotating Scottish roasters.',
     carol, true),
    ('brew-lab-edinburgh', 'Brew Lab',
     '6-8 South College Street', 'Edinburgh', 'EH8 9AA', array['Has Bean'],
     array['espresso','filter','aeropress','pour_over'], true, true,
     'Edinburgh science-bar. Heavy on filter methods.', alice, true),
    ('north-tea-power-mcr', 'North Tea Power',
     '36 Tib Street', 'Manchester', 'M4 1LA', array['Has Bean'],
     array['espresso','filter'], true, true,
     'Northern Quarter mainstay; coffee + loose-leaf tea.', bob, true),
    ('takk-northern-quarter', 'Takk',
     '6 Tariff Street', 'Manchester', 'M1 2FF', array['Coffee Collective','Workshop'],
     array['espresso','filter'], true, true,
     'Icelandic-inflected NQ shop; Coffee Collective on bar.',
     carol, true),
    ('atkinsons-lancaster', 'J. Atkinsons & Co',
     '12 China Street', 'Lancaster', 'LA1 1EX', array['Atkinsons'],
     array['espresso','filter','batch_brew'], true, true,
     'Victorian-era Lancaster roaster, still going.', alice, true),
    ('small-street-bristol', 'Small Street Espresso',
     '23 Small Street', 'Bristol', 'BS1 1DW', array['Round Hill','Workshop'],
     array['espresso','filter'], true, true,
     'Tiny Bristol bar. Espresso-focused.', bob, true),
    ('full-court-press-bristol', 'Full Court Press',
     '59 Broad Street', 'Bristol', 'BS1 2EJ', array['Round Hill','Workshop'],
     array['espresso','filter','pour_over'], true, true,
     'Bristol filter destination. Multiple guest roasters.', carol, true),
    ('clifton-coffee-bristol', 'Clifton Coffee Roasters',
     'Unit 5C The Brewery', 'Bristol', 'BS1 6XN', array['Clifton'],
     array['espresso','filter','batch_brew'], true, true,
     'Bristol roastery taproom; own beans, training-bar feel.',
     alice, true),
    ('extract-coffee-bristol', 'Extract Coffee Roasters',
     'Gatton Road', 'Bristol', 'BS2 9SH', array['Extract'],
     array['espresso','filter','batch_brew'], true, true,
     'Roastery cafe on the city''s edge. Own beans only.', bob, true),
    ('round-hill-bath', 'Round Hill Roastery',
     'Roseberry Road', 'Bath', 'BA2 3DU', array['Round Hill'],
     array['espresso','filter','pour_over'], true, true,
     'Bath roaster; weekday-only cafe.', carol, true),
    ('hatch-cardiff', 'Hard Lines',
     '57 Castle Arcade', 'Cardiff', 'CF10 1BU', array['Hard Lines'],
     array['espresso','filter'], true, true,
     'Cardiff''s flagship third-wave shop and roaster.', alice, true),
    ('machina-edinburgh', 'Machina Espresso',
     '6 Brougham Place', 'Edinburgh', 'EH3 9HW', array['Machina'],
     array['espresso','filter'], true, true,
     'Edinburgh roaster + bar. Tight espresso programme.', bob, true),
    -- Bottom-anchor chains (PRD risk 1 mitigation).
    ('pret-a-manger-victoria', 'Pret A Manger',
     'Victoria Station Concourse', 'London', 'SW1V 1JU', array[]::text[],
     array['espresso','filter'], true, true,
     'Pret. The chain. Anchor for the ''convenience'' end of the spectrum.',
     alice, true),
    ('costa-coffee-paddington', 'Costa Coffee',
     'Paddington Station', 'London', 'W2 1HQ', array[]::text[],
     array['espresso','filter'], true, true,
     'Costa. The other chain. Same anchor purpose.',
     bob, true),
    ('caffe-nero-bond-street', 'Caffè Nero',
     '99 New Bond Street', 'London', 'W1S 1RJ', array[]::text[],
     array['espresso','filter'], true, true,
     'Caffè Nero. Italian-coded, mainstream-priced.',
     carol, true);

  -- The bucket and rank_position columns are populated by the trigger and
  -- the pairwise-ranking backfill in migration 20260427000000. They get
  -- backfilled from the seeded rating_overall values below.
  --
  -- The two-axis collapse (migration 20260428000000) drops the six axis
  -- columns (taste/body/aroma/ambience/service/value) and replaces them
  -- with rating_coffee_5 / rating_vibe_5. We seed those directly, picking
  -- 1-5 values that correspond loosely to the bucket each review will land
  -- in once auto-bucketed by rating_overall.
  insert into public.reviews
    (venue_id, reviewer_id,
     rating_overall, rating_coffee, rating_coffee_5, rating_vibe_5,
     body, visited_on)
  values
    (prufrock, alice, 9, null, 5, 4,
     'Square Mile filter was spot on. Loud at lunchtime but the bar staff keep it moving.',
     current_date - 7),
    (prufrock, bob, 8, null, 4, 4,
     'Espresso is consistently good. Seats fill up fast past 9am.',
     current_date - 3),
    (kaffeine, alice, 7, null, 4, 3,
     'Reliable Fitzrovia stop. Tight room, quick turnover, no surprises either way.',
     current_date - 14),
    (ozone, alice, 8, null, 4, 4,
     'Room is the selling point. Beans are solid, food raised the bill.',
     current_date - 21),
    (ozone, carol, 9, null, 5, 4,
     'Own roast shines on filter. Busy at weekends, worth the wait.',
     current_date - 2),
    (northstar, bob, 9, null, 5, 4,
     'Best pour-over experience I''ve had outside Melbourne. Staff knew every lot.',
     current_date - 30),
    (northstar, carol, 10, null, 5, 5,
     'Local bias noted, but it''s the real deal. Try the single-origin flight.',
     current_date - 5);
end $$;
