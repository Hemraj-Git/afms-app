-- Phase 4 prerequisite. Verified live via Supabase MCP on 2026-09-12:
-- `work_orders`, `inspections`, and `service_requests` currently each carry a
-- single blanket policy ("Staff all on X" / "Staff read/write service
-- requests") granting ALL to every authenticated user regardless of role —
-- meaning "own work orders / inspections / requests only" is today enforced
-- purely by client-side filters in the mobile PWA, not by the database. Any
-- authenticated Technician/Housekeeping/Faculty/Guest can currently read and
-- write every other user's rows via a direct API call. This migration
-- replaces those blanket policies with per-row ownership checks so the
-- restriction is real. Purely additive/replacing — no data is dropped
-- (service_requests has 0 rows; work_orders/inspections keep their data,
-- only their policies change).
--
-- Run this in the Supabase SQL Editor.

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'Admin'
  );
$$;

-- ── work_orders: Admin sees/edits all; assignee sees/edits only their own ──
drop policy if exists "Staff all on work_orders" on public.work_orders;

create policy "Admin all on work_orders" on public.work_orders
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Assignee read own work_orders" on public.work_orders
  for select to authenticated
  using (assigned_technician_id = (auth.uid())::text);

create policy "Assignee update own work_orders" on public.work_orders
  for update to authenticated
  using (assigned_technician_id = (auth.uid())::text)
  with check (assigned_technician_id = (auth.uid())::text);

-- ── inspections: Admin sees/edits all; assignee sees/edits only their own ──
drop policy if exists "Staff all on inspections" on public.inspections;

create policy "Admin all on inspections" on public.inspections
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Assignee read own inspections" on public.inspections
  for select to authenticated
  using (conducted_by_user_id = (auth.uid())::text);

create policy "Assignee update own inspections" on public.inspections
  for update to authenticated
  using (conducted_by_user_id = (auth.uid())::text)
  with check (conducted_by_user_id = (auth.uid())::text);

-- ── service_requests: needs a real requester identity to scope by ──
-- `requested_by_name` (text) already exists but is spoofable/not unique;
-- adding a real auth uuid column is what makes "see my own raised requests"
-- (including for Guests) an enforceable guarantee instead of a name match.
alter table public.service_requests
  add column if not exists requested_by_user_id uuid references auth.users(id);

drop policy if exists "Staff read/write service requests" on public.service_requests;

create policy "Admin all on service_requests" on public.service_requests
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Requester read own service_requests" on public.service_requests
  for select to authenticated
  using (requested_by_user_id = auth.uid());

create policy "Requester insert own service_requests" on public.service_requests
  for insert to authenticated
  with check (requested_by_user_id = auth.uid());

create policy "Requester update own service_requests" on public.service_requests
  for update to authenticated
  using (requested_by_user_id = auth.uid())
  with check (requested_by_user_id = auth.uid());

-- ── notifications (Phase 4.3, in-app only) ──
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('wo_assigned', 'inspection_assigned', 'auto_checkout')),
  title text not null,
  body text,
  ref_table text,
  ref_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.notifications enable row level security;

-- No INSERT policy for any client role on purpose: rows are only ever
-- written by the SECURITY DEFINER trigger functions below, so a user can
-- never fabricate their own "assigned to you" notification.
create policy "Read own notifications" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy "Mark own notifications read" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Trigger-based notification delivery ──
-- Deliberately DB-level (not app-code) because assignment writes happen
-- directly from client Supabase calls all over the desktop admin UI — a
-- trigger fires regardless of which code path changed the row.

create or replace function public.notify_work_order_assignment()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Only real Supabase Auth users (real uuids) can receive a notification.
  -- assigned_technician_id can hold a non-uuid legacy/local-only id (e.g. an
  -- admin-created user never provisioned in Supabase Auth) — skip those
  -- rather than raising and blocking the work order write.
  if new.assigned_technician_id is not null
     and new.assigned_technician_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and (tg_op = 'INSERT' or new.assigned_technician_id is distinct from old.assigned_technician_id) then
    insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
    values (
      new.assigned_technician_id::uuid,
      'wo_assigned',
      'Work order assigned: ' || new.wo_number,
      coalesce(new.title, new.type || ' work order'),
      'work_orders',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_work_order_assignment on public.work_orders;
create trigger trg_notify_work_order_assignment
  after insert or update on public.work_orders
  for each row execute function public.notify_work_order_assignment();

create or replace function public.notify_inspection_assignment()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.conducted_by_user_id is not null
     and new.conducted_by_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and (tg_op = 'INSERT' or new.conducted_by_user_id is distinct from old.conducted_by_user_id)
     and new.status <> 'Completed' then
    insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
    values (
      new.conducted_by_user_id::uuid,
      'inspection_assigned',
      'Inspection assigned: ' || new.inspection_number,
      'Due ' || new.due_date,
      'inspections',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_inspection_assignment on public.inspections;
create trigger trg_notify_inspection_assignment
  after insert or update on public.inspections
  for each row execute function public.notify_inspection_assignment();

create or replace function public.notify_auto_checkout()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.is_force_checkout is true
     and new.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and (old.is_force_checkout is distinct from new.is_force_checkout) then
    insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
    values (
      new.user_id::uuid,
      'auto_checkout',
      'Automatically checked out',
      coalesce(new.auto_checkout_note, 'You were checked out of ' || new.room_id || ' at end of day.'),
      'room_access_logs',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_auto_checkout on public.room_access_logs;
create trigger trg_notify_auto_checkout
  after update on public.room_access_logs
  for each row execute function public.notify_auto_checkout();

-- Hardening: these are SECURITY DEFINER and only meant to run as triggers.
-- Revoke from PUBLIC *and* from anon/authenticated directly — verified live
-- that this Supabase project's default privileges grant EXECUTE to
-- anon/authenticated directly on every newly created function (independent
-- of PUBLIC), so revoking only one of the two leaves it still executable.
-- (This also corrects the earlier RLS-fix migration's handle_new_user/
-- rls_auto_enable REVOKEs, which only targeted PUBLIC and silently didn't
-- take effect for the same reason — reapplied below.)
revoke execute on function public.notify_work_order_assignment() from public, anon, authenticated;
revoke execute on function public.notify_inspection_assignment() from public, anon, authenticated;
revoke execute on function public.notify_auto_checkout() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
