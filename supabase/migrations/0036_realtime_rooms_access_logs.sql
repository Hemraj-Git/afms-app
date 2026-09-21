-- Live occupancy: let the app hear about room status changes and check-ins /
-- check-outs as they happen (including the nightly server-side auto-checkout),
-- instead of only on reload. Same approach as 0033: the publication only makes the
-- tables emit events, and Realtime still applies row-level security to each
-- subscriber -- staff receive every access-log event, a Guest only their own, and
-- every signed-in user can read rooms (as they already could).
--
-- Additive: nothing in the code currently in production subscribes to these.
alter publication supabase_realtime add table
  public.rooms,
  public.room_access_logs;

-- The two access-log policies the performance advisor still flags: wrap auth.uid()
-- as (select auth.uid()) so it is evaluated once per query rather than once per
-- row and per event. Same meaning as before.
alter policy "Authenticated insert own room_access_logs" on public.room_access_logs
  with check (user_id = ((select auth.uid()))::text);
alter policy "Authenticated update own room_access_logs" on public.room_access_logs
  using (user_id = ((select auth.uid()))::text)
  with check (user_id = ((select auth.uid()))::text);
