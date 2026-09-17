-- Fixes room occupancy silently not persisting for Guest/Technician
-- check-ins. checkInRoom/checkOutRoom (src/context/AFMSContext.tsx) do two
-- separate writes: an insert/update on room_access_logs (the audit trail)
-- and a separate rooms.update({status, current_occupant}). The first
-- succeeds (its RLS policies correctly scope to user_id = auth.uid()), but
-- the second is silently a no-op for anyone but Admin -- "Admin all on
-- rooms" (0005_admin_scoped_reference_tables.sql) is the only write policy
-- on rooms. Postgrest/RLS treats an UPDATE matching zero writable rows as a
-- successful 0-row update, not an error, so nothing ever surfaced this.
--
-- Fix: two narrow, security-definer RPCs, following the exact pattern
-- already established by public.run_auto_checkouts()
-- (0006_server_side_auto_checkout.sql). Each wraps the log write and the
-- room-state write in one transaction, and each trusts auth.uid() directly
-- for row ownership rather than any client-supplied id. rooms itself is
-- untouched -- no new RLS policy, no broadened grant -- so a non-admin still
-- can't rename/delete/reassign a room via direct table access; only these
-- two functions can flip occupancy, and only for the calling user's own
-- session.
--
-- Note: rooms.id / room_access_logs.id / room_id / user_id are all `text`
-- columns in this schema (not native `uuid`), so parameters are typed text
-- to match -- uuid params would fail with "operator does not exist: text =
-- uuid" against these columns.

create or replace function public.room_check_in(
  p_id text,
  p_room_id text,
  p_activity_number text,
  p_purpose text,
  p_user_name text,
  p_user_role text,
  p_check_in_time text,
  p_check_in_date text,
  p_check_in_timestamp bigint
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  insert into public.room_access_logs (
    id, activity_number, room_id, user_id, user_name, user_role,
    check_in_time, check_in_date, check_in_timestamp, purpose, is_force_checkout
  ) values (
    p_id, p_activity_number, p_room_id, (auth.uid())::text, p_user_name, p_user_role,
    p_check_in_time, p_check_in_date, p_check_in_timestamp, p_purpose, false
  );

  update public.rooms
  set status = 'Occupied', current_occupant = p_user_name
  where id = p_room_id;
end;
$$;

grant execute on function public.room_check_in(text, text, text, text, text, text, text, text, bigint) to authenticated;
revoke execute on function public.room_check_in(text, text, text, text, text, text, text, text, bigint) from public, anon;

create or replace function public.room_check_out(p_room_id text, p_check_out_time text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  update public.room_access_logs
  set check_out_time = p_check_out_time
  where room_id = p_room_id and user_id = (auth.uid())::text and check_out_time is null;

  update public.rooms
  set status = 'Available', current_occupant = null
  where id = p_room_id;
end;
$$;

grant execute on function public.room_check_out(text, text) to authenticated;
revoke execute on function public.room_check_out(text, text) from public, anon;
