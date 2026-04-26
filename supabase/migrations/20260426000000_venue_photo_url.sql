-- Add optional editorial photo URL to venues.
-- photo_url: publicly accessible image URL used for hero banners and split
-- card layouts. Null means no photography is shown for that venue.

alter table public.venues
  add column if not exists photo_url text;
