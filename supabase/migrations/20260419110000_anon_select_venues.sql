-- Grant the anon role SELECT access on venues and venue_axis_scores so the
-- landing page can render a public leaderboard for unauthenticated visitors.
--
-- All other tables (reviews, reviewers, scoring internals, dirty queue) remain
-- allowlist-gated; only the two tables needed to render the score-desc feed are
-- opened to anon. Writes are still service-role only.

drop policy if exists "venues_anon_select" on public.venues;
create policy venues_anon_select
  on public.venues for select
  to anon
  using (true);

drop policy if exists "venue_axis_scores_anon_select" on public.venue_axis_scores;
create policy venue_axis_scores_anon_select
  on public.venue_axis_scores for select
  to anon
  using (true);
