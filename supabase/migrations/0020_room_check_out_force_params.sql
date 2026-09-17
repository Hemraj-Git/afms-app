-- Extends room_check_out so the client-side auto-checkout path
-- (evaluateAutoCheckouts in AFMSContext.tsx) can go through this same RPC
-- instead of raw table .update() calls. That function was writing directly
-- to room_access_logs/rooms, which silently no-ops the rooms status write
-- for any non-admin under RLS -- the exact bug already fixed for manual
-- checkout, reintroduced because this path was never switched over.

drop function if exists public.room_check_out(text, text, bigint);

create or replace function public.room_check_out(
  p_room_id text,
  p_check_out_time text,
  p_check_out_timestamp bigint,
  p_is_force_checkout boolean default false,
  p_auto_checkout_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  update public.room_access_logs
  set check_out_time = p_check_out_time,
      check_out_timestamp = p_check_out_timestamp,
      is_force_checkout = p_is_force_checkout,
      auto_checkout_note = p_auto_checkout_note
  where room_id = p_room_id and user_id = (auth.uid())::text and check_out_time is null;

  update public.rooms
  set status = 'Available', current_occupant = null
  where id = p_room_id;
end;
$$;

grant execute on function public.room_check_out(text, text, bigint, boolean, text) to authenticated;
revoke execute on function public.room_check_out(text, text, bigint, boolean, text) from public, anon;
