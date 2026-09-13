-- Final-audit finding (2026-09-12): the emergency RLS fix in
-- 0001/earlier removed the dangerous anon/public blanket policies, but left
-- a "Staff all on X" policy granting ALL to every authenticated user on 14
-- reference/taxonomy/log tables. proxy.ts blocks non-Admin roles from ever
-- reaching the desktop pages that write these tables, so this isn't
-- reachable through the app's own UI — but any authenticated session
-- (Technician/Housekeeping/Faculty/Guest included) could still write to
-- these directly via a raw API call, e.g. delete a vendor or edit a room's
-- data. This was always the intent of Phase 1 (Admin-only write, open read)
-- and is completed here. Purely a policy replacement — no data changes.
--
-- Run this in the Supabase SQL Editor.

-- ── Pure Admin-managed reference/taxonomy tables: Admin all, everyone read ──
drop policy if exists "Staff all on campuses" on public.campuses;
drop policy if exists "Staff all on buildings" on public.buildings;
drop policy if exists "Staff all on rooms" on public.rooms;
drop policy if exists "Staff all on categories" on public.categories;
drop policy if exists "Staff all on sub_categories" on public.sub_categories;
drop policy if exists "Staff all on vendors" on public.vendors;
drop policy if exists "Staff all on templates" on public.checklist_templates;
drop policy if exists "Staff all on departments" on public.departments;
drop policy if exists "Staff all on documents" on public.documents;
drop policy if exists "Staff all on inventory" on public.inventory_items;
drop policy if exists "Staff all on reservations" on public.reservations;
drop policy if exists "Staff all on assets" on public.assets;

create policy "Admin all on campuses" on public.campuses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read campuses" on public.campuses for select to authenticated using (true);

create policy "Admin all on buildings" on public.buildings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read buildings" on public.buildings for select to authenticated using (true);

create policy "Admin all on rooms" on public.rooms for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read rooms" on public.rooms for select to authenticated using (true);

create policy "Admin all on categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read categories" on public.categories for select to authenticated using (true);

create policy "Admin all on sub_categories" on public.sub_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read sub_categories" on public.sub_categories for select to authenticated using (true);

create policy "Admin all on vendors" on public.vendors for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read vendors" on public.vendors for select to authenticated using (true);

create policy "Admin all on checklist_templates" on public.checklist_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read checklist_templates" on public.checklist_templates for select to authenticated using (true);

create policy "Admin all on departments" on public.departments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read departments" on public.departments for select to authenticated using (true);

create policy "Admin all on documents" on public.documents for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read documents" on public.documents for select to authenticated using (true);

create policy "Admin all on inventory_items" on public.inventory_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read inventory_items" on public.inventory_items for select to authenticated using (true);

create policy "Admin all on reservations" on public.reservations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read reservations" on public.reservations for select to authenticated using (true);

-- assets keeps its existing "Public read assets for QR scan" (anon) policy
-- untouched — this only replaces the authenticated-role blanket policy.
create policy "Admin all on assets" on public.assets for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read assets" on public.assets for select to authenticated using (true);

-- ── asset_activity_logs: append-only audit trail. Anyone can log an action
-- (e.g. a technician completing a work order), nobody should edit/delete
-- history after the fact except Admin. ──
drop policy if exists "Staff all on asset_logs" on public.asset_activity_logs;
create policy "Admin all on asset_activity_logs" on public.asset_activity_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read asset_activity_logs" on public.asset_activity_logs for select to authenticated using (true);
create policy "Authenticated insert asset_activity_logs" on public.asset_activity_logs for insert to authenticated with check (true);

-- ── room_access_logs: everyone can check in (insert their own row) and
-- check out (update their own row); only Admin can edit/delete anyone
-- else's. Read stays open (occupancy/presence, not sensitive personal
-- data, and used by desktop reporting) — the existing anon guest-checkin/
-- checkout policies from the earlier RLS fix are untouched. ──
drop policy if exists "Staff all on room_logs" on public.room_access_logs;
create policy "Admin all on room_access_logs" on public.room_access_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Authenticated read room_access_logs" on public.room_access_logs for select to authenticated using (true);
create policy "Authenticated insert own room_access_logs" on public.room_access_logs for insert to authenticated with check (user_id = (auth.uid())::text);
create policy "Authenticated update own room_access_logs" on public.room_access_logs for update to authenticated using (user_id = (auth.uid())::text) with check (user_id = (auth.uid())::text);
