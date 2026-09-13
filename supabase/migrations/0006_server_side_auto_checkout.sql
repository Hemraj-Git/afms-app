-- Final-audit finding (2026-09-12): the 11:59 PM auto-checkout requirement
-- ("if any user checks in and forgets to check out before day end they will
-- automatically get checked out and get a notification") was never actually
-- persisted to the database — `evaluateAutoCheckouts()` in AFMSContext.tsx
-- only ever updated local React state in whichever browser tab happened to
-- have the PWA open at that moment. That client-side function has now been
-- fixed to persist its findings, but it still only runs if *some* tab is
-- open at the right moment. This migration adds the real, always-on
-- server-side version via pg_cron, scheduled for 23:59 Asia/Kolkata (IST)
-- daily — confirmed with the user, since the existing seed data's +91 phone
-- numbers suggested but didn't guarantee that timezone. 23:59 IST = 18:29
-- UTC (IST is UTC+5:30), which is what the cron schedule below runs in
-- (Supabase's pg_cron runs in UTC).
--
-- This UPDATE is exactly what fires the Phase 4 `trg_notify_auto_checkout`
-- trigger, so once this is applied, the "auto-checkout notification"
-- requirement is met even if nobody has the app open at midnight.
--
-- Run this in the Supabase SQL Editor.

create extension if not exists pg_cron;

create or replace function public.run_auto_checkouts()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  freed_room_ids text[];
begin
  -- check_in_timestamp is a real UTC epoch (unlike check_in_date, which is
  -- stored as the client's UTC calendar date string and can be off by one
  -- day from the IST calendar date near midnight) — comparing on it avoids
  -- that ambiguity entirely.
  with closed as (
    update public.room_access_logs
    set
      check_out_time = to_char(now() at time zone 'Asia/Kolkata', 'HH12:MI AM'),
      is_force_checkout = true,
      auto_checkout_note = 'System Auto Check-Out at 11:59 PM (End of Day Cutoff)'
    where check_out_time is null
      and date(to_timestamp(check_in_timestamp / 1000.0) at time zone 'Asia/Kolkata')
          <= (now() at time zone 'Asia/Kolkata')::date
    returning room_id
  )
  select array_agg(distinct room_id) into freed_room_ids from closed;

  if freed_room_ids is not null then
    update public.rooms
    set status = 'Available', current_occupant = null
    where id = any(freed_room_ids);
  end if;
end;
$$;

revoke execute on function public.run_auto_checkouts() from public, anon, authenticated;

-- Idempotent: drop any previous schedule with this name before re-creating.
select cron.unschedule(jobid) from cron.job where jobname = 'afms-auto-checkout';
select cron.schedule('afms-auto-checkout', '29 18 * * *', $$select public.run_auto_checkouts();$$);
