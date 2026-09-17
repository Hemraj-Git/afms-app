-- asset_activity_logs.timestamp is a new Date().toLocaleString() display
-- string (e.g. "1/16/2026, 12:41:55 AM"), and the app was ordering by it
-- directly -- lexicographic sort on that format scrambles order across
-- months/years (worse than the already-fixed room_access_logs bug, which
-- was only a time-of-day string). Adds a real epoch column, same pattern as
-- check_in_timestamp/check_out_timestamp.
alter table public.asset_activity_logs add column if not exists timestamp_epoch bigint;
