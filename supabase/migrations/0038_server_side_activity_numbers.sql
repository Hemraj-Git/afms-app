-- Check-in numbers (AL-A0001, AL-A0002, ...) are unique, but were worked out by the
-- browser: it counted the access logs it could see and added one. Since a Guest can
-- read only their own logs (0029), a guest's browser saw few or none, picked a number
-- another person already held, and the check-in failed with:
--   duplicate key value violates unique constraint "room_access_logs_activity_number_key"
--
-- Same cure as for ticket numbers (0014): the database hands out the number. It comes
-- from a sequence, so two people checking in at the same moment can never collide,
-- and it no longer matters what any browser can see.
--
-- room_check_in keeps its signature (the p_activity_number argument is now ignored), so
-- the code currently deployed, and any page a user still has open, keeps working
-- unchanged. Grants are unchanged (CREATE OR REPLACE keeps them).

create sequence if not exists public.room_activity_seq;

-- Continue after the highest number already used, so nothing is reissued.
select setval(
  'public.room_activity_seq',
  coalesce((select max((regexp_replace(activity_number, '^AL-A', ''))::int)
            from public.room_access_logs
            where activity_number ~ '^AL-A[0-9]+$'), 0) + 1,
  false
);

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
as $function$
begin
  insert into public.room_access_logs (
    id, activity_number, room_id, user_id, user_name, user_role,
    check_in_time, check_in_date, check_in_timestamp, purpose, is_force_checkout
  ) values (
    p_id,
    'AL-A' || lpad(nextval('public.room_activity_seq')::text, 4, '0'),
    p_room_id, (auth.uid())::text, p_user_name, p_user_role,
    p_check_in_time, p_check_in_date, p_check_in_timestamp, p_purpose, false
  );

  update public.rooms
  set status = 'Occupied', current_occupant = p_user_name
  where id = p_room_id;
end;
$function$;
