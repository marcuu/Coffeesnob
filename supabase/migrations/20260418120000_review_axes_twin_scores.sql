-- Add new coffee-specific review inputs and relax legacy coffee column.
alter table public.reviews
  add column if not exists rating_taste smallint check (rating_taste between 1 and 10),
  add column if not exists rating_body smallint check (rating_body between 1 and 10),
  add column if not exists rating_aroma smallint check (rating_aroma between 1 and 10);

alter table public.reviews
  alter column rating_coffee drop not null;

-- Update scoring axis enums from legacy per-axis outputs to composite outputs.
delete from public.reviewer_axis_weights where axis not in ('overall', 'coffee', 'experience');
delete from public.review_weights where axis not in ('overall', 'coffee', 'experience');
delete from public.venue_axis_scores where axis not in ('overall', 'coffee', 'experience');

alter table public.reviewer_axis_weights
  drop constraint if exists reviewer_axis_weights_axis_check,
  add constraint reviewer_axis_weights_axis_check
    check (axis in ('overall', 'coffee', 'experience'));

alter table public.review_weights
  drop constraint if exists review_weights_axis_check,
  add constraint review_weights_axis_check
    check (axis in ('overall', 'coffee', 'experience'));

alter table public.venue_axis_scores
  drop constraint if exists venue_axis_scores_axis_check,
  add constraint venue_axis_scores_axis_check
    check (axis in ('overall', 'coffee', 'experience'));
