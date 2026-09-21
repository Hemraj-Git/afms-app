-- Live asset status. When a work order is completed (usually by a technician on
-- their phone) the asset goes from "Under Maintenance" back to "Operational" and a
-- "Maintenance Completed" entry is added to its timeline -- but the app was never
-- told: assets and their activity log were not among the tables it listens to, so
-- an Admin's Assets page stayed stale until a manual refresh.
--
-- Same approach as 0033 and 0036: the publication only makes the tables emit
-- events; Realtime still applies row-level security to each subscriber, and every
-- signed-in user can already read both tables ("Authenticated read ..."). The app
-- only subscribes staff to them (a Guest listens to their own tickets only).
--
-- Additive: nothing in the code currently in production subscribes to these.
alter publication supabase_realtime add table
  public.assets,
  public.asset_activity_logs;
