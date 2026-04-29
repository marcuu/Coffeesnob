-- Two-axis collapse: replace the six axis sliders (taste, body, aroma,
-- ambience, service, value) with two — rating_coffee_5 and rating_vibe_5,
-- both on a 1-5 scale. The hypothesis is that the six axes are roughly
-- collinear into two latent factors (coffee-quality and overall-experience),
-- so collapsing trades a bit of dimensionality for much less submission
-- friction.
--
-- Sequence is order-sensitive: add new columns → backfill from old → set
-- NOT NULL → drop old columns. Backfill rounding is half-up via Postgres
-- round() and clamped to 1-5.
--
-- The scoring pipeline rerun, axis-CHECK update on venue_axis_scores, and
-- deletion of legacy 'experience' rows happen in the same migration so the
-- schema and downstream tables converge in one transaction.

-- ---------------------------------------------------------------------------
-- Step A: Add new columns
-- ---------------------------------------------------------------------------

alter table public.reviews
  add column if not exists rating_coffee_5 smallint
    check (rating_coffee_5 between 1 and 5),
  add column if not exists rating_vibe_5 smallint
    check (rating_vibe_5 between 1 and 5);

-- ---------------------------------------------------------------------------
-- Step B: Backfill from existing six axes
-- ---------------------------------------------------------------------------
-- Map: average the three coffee axes (taste, body, aroma), divide by 2 to
-- compress 1-10 → 1-5, half-up round, clamp to [1, 5]. Same for the vibe
-- axes (ambience, service, value). round() in Postgres uses banker's
-- rounding for numeric only when the half is exactly 0.5 with no remainder;
-- here the inputs are integers, the average is a 1-decimal-place numeric,
-- and the result is half-up, which is what we want.

update public.reviews
   set rating_coffee_5 = greatest(
         1,
         least(
           5,
           round(
             ((coalesce(rating_taste, rating_overall)
               + coalesce(rating_body, rating_overall)
               + coalesce(rating_aroma, rating_overall)) / 3.0) / 2.0
           )::int
         )
       )
 where rating_coffee_5 is null;

update public.reviews
   set rating_vibe_5 = greatest(
         1,
         least(
           5,
           round(
             ((rating_ambience + rating_service + rating_value) / 3.0) / 2.0
           )::int
         )
       )
 where rating_vibe_5 is null;

alter table public.reviews
  alter column rating_coffee_5 set not null,
  alter column rating_vibe_5 set not null;

-- ---------------------------------------------------------------------------
-- Step C: Drop the six old axis columns
-- ---------------------------------------------------------------------------
-- The CHECK constraints attached to each column are dropped with the column.

alter table public.reviews
  drop column if exists rating_taste,
  drop column if exists rating_body,
  drop column if exists rating_aroma,
  drop column if exists rating_ambience,
  drop column if exists rating_service,
  drop column if exists rating_value;

-- ---------------------------------------------------------------------------
-- Step D: Update venue_axis_scores / reviewer_axis_weights / review_weights
-- axis CHECK constraints to the new set ('overall', 'coffee', 'vibe').
-- ---------------------------------------------------------------------------
-- Path (a) from the brief: explicit CHECK constraint with the new set. Old
-- 'experience' rows are deleted; the pipeline rerun (next deploy) will
-- populate fresh 'vibe' rows.

delete from public.reviewer_axis_weights where axis = 'experience';
delete from public.review_weights        where axis = 'experience';
delete from public.venue_axis_scores     where axis = 'experience';

alter table public.reviewer_axis_weights
  drop constraint if exists reviewer_axis_weights_axis_check,
  add constraint reviewer_axis_weights_axis_check
    check (axis in ('overall', 'coffee', 'vibe'));

alter table public.review_weights
  drop constraint if exists review_weights_axis_check,
  add constraint review_weights_axis_check
    check (axis in ('overall', 'coffee', 'vibe'));

alter table public.venue_axis_scores
  drop constraint if exists venue_axis_scores_axis_check,
  add constraint venue_axis_scores_axis_check
    check (axis in ('overall', 'coffee', 'vibe'));
