-- Adds a real epoch checkout timestamp alongside the existing check_in_timestamp.
-- check_out_time is only a formatted display string ("11:59:00 PM" from the
-- client, "11:59 PM" from the auto-checkout cron -- no date, inconsistent
-- formats), which can't be trusted for chronological comparison -- the same
-- class of problem check_in_timestamp was already added to fix for check-in
-- ordering. This lets a Check Out event be ranked correctly against other
-- events (including its own Check In, and other sessions' events) instead
-- of only ever being treated as "immediately after its own check-in".

alter table public.room_access_logs add column if not exists check_out_timestamp bigint;
