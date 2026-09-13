-- Corrective migration (replaces the earlier drop/recreate 0002 file, which was
-- written before live schema inspection and would have destroyed real data).
--
-- Verified live via Supabase MCP on 2026-09-12: `service_requests` has 0 rows,
-- so this table specifically carries no data risk, but the app's insert/update
-- code targets column names that do not exist on the real table at all
-- (`request_type`, `requested_by`, `assigned_to`, `work_order_*`, `dismissal_*`,
-- `photo_urls`), which means every service-request insert currently fails
-- outright and any successful update silently drops those fields. This
-- migration only ADDS columns/widens a CHECK constraint — it does not drop or
-- rename anything, so it is safe to run against the live project.
--
-- Run this in the Supabase SQL Editor.

alter table public.service_requests
  add column if not exists assigned_to text,
  add column if not exists assigned_to_name text,
  add column if not exists work_order_number text,
  add column if not exists work_order_id text,
  add column if not exists work_order_type text,
  add column if not exists dismissal_reason text,
  add column if not exists dismissed_at text,
  add column if not exists dismissed_by text,
  add column if not exists photo_urls text[] default '{}'::text[];

-- Widen the `type` check to also accept the values the desktop admin UI
-- (src/app/service-requests/page.tsx) currently produces, alongside the
-- original 'Corrective' | 'Housekeeping' | 'Inquiry' set already enforced.
-- Additive only — no existing row can violate this, since it can only be
-- more permissive than the constraint it replaces.
alter table public.service_requests drop constraint if exists service_requests_type_check;
alter table public.service_requests add constraint service_requests_type_check
  check (type = any (array[
    'Corrective', 'Housekeeping', 'Inquiry',
    'Maintenance', 'Cleaning', 'IT Support', 'General'
  ]));
