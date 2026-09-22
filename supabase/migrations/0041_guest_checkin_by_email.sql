-- Every guest sign-in creates a brand-new anonymous account, even for the same
-- returning email (accepted tradeoff, see docs/PENDING-WORK.md 3.4). Room
-- check-in never accounted for that:
--
--  1. A guest's "Active in: <room>" banner is found among the logs THEY can
--     read, which was every log whose user_id is this exact account. Logging
--     in again (a new account) couldn't see the still-open check-in from an
--     earlier login, so the phone showed "not checked in" while the room and
--     the Admin's log both correctly still showed it occupied.
--  2. room_check_out closes the log for this account and unconditionally frees
--     the room -- with nobody else's open check-in checked. Checking in from a
--     later login and then out again left the ROOM looking free while the
--     earlier login's log entry was still open, the reverse mismatch.
--
-- Fix: give a guest's check-in a durable identity -- their self-reported email,
-- the same value service_requests already keys guest history on (0004's
-- requested_by_email) -- instead of the one-off account that happened to make
-- it. A room can now hold more than one open check-in (a classroom of several
-- people): it counts as free only once every open check-in in it is closed.
--
-- Additive: guest_email is nullable and blank on existing rows; older code
-- that never reads it keeps working, and staff check-ins (who have one real,
-- stable account) are unaffected.

alter table public.room_access_logs add column if not exists guest_email text;
comment on column public.room_access_logs.guest_email is
  'Self-reported email of the guest who checked in (lower-cased comparisons), so a later login under a different anonymous account still recognises this as their own open check-in. Null for staff.';

-- A guest can already read their own account's logs (user_id = auth.uid()); add
-- reading any log recorded under the same email, mirroring the service_requests
-- "Guest read same-email" policy (0004).
drop policy if exists "Staff read all access logs, guests read own" on public.room_access_logs;
create policy "Staff read all access logs, guests read own or same email"
  on public.room_access_logs for select
  to authenticated
  using (
    user_id = (select auth.uid())::text
    or (select current_user_role()) <> 'Guest'
    or (
      guest_email is not null
      and exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid())
          and p.role = 'Guest'
          and lower(p.email) = lower(room_access_logs.guest_email)
      )
    )
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
declare
  v_guest_email text;
begin
  if p_user_role = 'Guest' then
    select email into v_guest_email from public.profiles where id = auth.uid();
  end if;

  insert into public.room_access_logs (
    id, activity_number, room_id, user_id, user_name, user_role,
    check_in_time, check_in_date, check_in_timestamp, purpose, is_force_checkout,
    guest_email
  ) values (
    p_id,
    'AL-A' || lpad(nextval('public.room_activity_seq')::text, 4, '0'),
    p_room_id, (auth.uid())::text, p_user_name, p_user_role,
    p_check_in_time, p_check_in_date, p_check_in_timestamp, p_purpose, false,
    v_guest_email
  );

  -- A room can hold more than one open check-in; the most recent arrival is
  -- shown as the occupant.
  update public.rooms
  set status = 'Occupied', current_occupant = p_user_name
  where id = p_room_id;
end;
$function$;

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
as $function$
declare
  v_role text;
  v_email text;
  v_remaining_occupant text;
begin
  select role, email into v_role, v_email from public.profiles where id = auth.uid();

  -- Close every open check-in this caller could plausibly be the owner of: the
  -- exact account (always) and, for a Guest, any earlier login's log under the
  -- same self-reported email -- otherwise a returning guest's brand-new account
  -- could never close a check-in an older account of theirs left open.
  update public.room_access_logs
  set check_out_time = p_check_out_time,
      check_out_timestamp = p_check_out_timestamp,
      is_force_checkout = p_is_force_checkout,
      auto_checkout_note = p_auto_checkout_note
  where room_id = p_room_id
    and check_out_time is null
    and (
      user_id = (auth.uid())::text
      or (v_role = 'Guest' and v_email is not null and lower(guest_email) = lower(v_email))
    );

  -- Free the room only once nobody else is still checked in; otherwise it stays
  -- Occupied and shows whoever is left, most recently arrived first (this may
  -- still be the person who just checked out of a DIFFERENT still-open entry
  -- of their own, so recompute rather than assume).
  select user_name into v_remaining_occupant
  from public.room_access_logs
  where room_id = p_room_id and check_out_time is null
  order by check_in_timestamp desc
  limit 1;

  if v_remaining_occupant is null then
    update public.rooms set status = 'Available', current_occupant = null where id = p_room_id;
  else
    update public.rooms set status = 'Occupied', current_occupant = v_remaining_occupant where id = p_room_id;
  end if;
end;
$function$;
