-- Populates the new check_out_timestamp column (0017) on every path that
-- can close a room_access_logs session.

-- 1) Self-service checkout RPC (0015, corrected in 0016) -- parameter lists
-- can't change via create or replace, so drop the old signature first.
drop function if exists public.room_check_out(text, text);

create or replace function public.room_check_out(
  p_room_id text,
  p_check_out_time text,
  p_check_out_timestamp bigint
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  update public.room_access_logs
  set check_out_time = p_check_out_time,
      check_out_timestamp = p_check_out_timestamp
  where room_id = p_room_id and user_id = (auth.uid())::text and check_out_time is null;

  update public.rooms
  set status = 'Available', current_occupant = null
  where id = p_room_id;
end;
$$;

grant execute on function public.room_check_out(text, text, bigint) to authenticated;
revoke execute on function public.room_check_out(text, text, bigint) from public, anon;

-- 2) Server-side 23:59 IST auto-checkout (0006) -- same signature, plain
-- create or replace.
create or replace function public.run_auto_checkouts()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  freed_room_ids text[];
begin
  with closed as (
    update public.room_access_logs
    set
      check_out_time = to_char(now() at time zone 'Asia/Kolkata', 'HH12:MI AM'),
      check_out_timestamp = (extract(epoch from now()) * 1000)::bigint,
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
