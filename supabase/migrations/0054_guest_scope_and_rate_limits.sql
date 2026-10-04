-- 0054: Pre-launch security review.
--
-- Guests sign in anonymously, which anyone can do, and an anonymous session is
-- an ordinary "authenticated" one. So every "any signed-in user can read"
-- policy was open to the whole internet. This narrows what guests (and
-- signed-out visitors) can reach to what their screens use, and puts a ceiling
-- on what anyone can create.
--
-- 1. Staff-only reads: vendors, documents, spares, departments, checklist
--    templates, asset history and reservations. Guests never see these
--    (their screens: check in to a room, raise a request, see their own).
-- 2. Signed-out QR scans no longer read whole asset/room rows: the sign-in
--    page asks qr_target_label() for just the name and code.
-- 3. "Same email" request history covers requests raised by guests only, so
--    typing a staff member's email doesn't show that person's requests.
-- 4. Guests may upload photos (work-order-evidence) only, not documents.
-- 5. Service requests: the database sets created_at itself, and a person can
--    raise at most 5 an hour as a guest, 30 an hour as staff (Admins: no cap).

-- ------------------------------------------------------- 1. staff-only reads

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role(), 'Guest') <> 'Guest'
$$;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

drop policy if exists "Authenticated read vendors" on public.vendors;
create policy "Staff read vendors" on public.vendors for select to authenticated using ((select public.is_staff()));

drop policy if exists "Authenticated read documents" on public.documents;
create policy "Staff read documents" on public.documents for select to authenticated using ((select public.is_staff()));

drop policy if exists "Authenticated read inventory_items" on public.inventory_items;
create policy "Staff read inventory_items" on public.inventory_items for select to authenticated using ((select public.is_staff()));

drop policy if exists "Authenticated read departments" on public.departments;
create policy "Staff read departments" on public.departments for select to authenticated using ((select public.is_staff()));

drop policy if exists "Authenticated read checklist_templates" on public.checklist_templates;
create policy "Staff read checklist_templates" on public.checklist_templates for select to authenticated using ((select public.is_staff()));

drop policy if exists "Authenticated read asset_activity_logs" on public.asset_activity_logs;
create policy "Staff read asset_activity_logs" on public.asset_activity_logs for select to authenticated using ((select public.is_staff()));

drop policy if exists "Authenticated read reservations" on public.reservations;
create policy "Staff read reservations" on public.reservations for select to authenticated using ((select public.is_staff()));

-- --------------------------------------------- 2. signed-out QR scan: a label

drop policy if exists "Public read assets for QR scan" on public.assets;
drop policy if exists "Public read rooms for QR scan" on public.rooms;

-- "Bridge Simulator (ROM-0002)" for a scanned room or asset id, or null.
create or replace function public.qr_target_label(p_type text, p_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case p_type
    when 'room' then (select r.name || coalesce(' (' || nullif(r.room_number, '') || ')', '') from public.rooms r where r.id = p_id)
    when 'asset' then (select a.name || coalesce(' (' || nullif(a.asset_id, '') || ')', '') from public.assets a where a.id = p_id)
  end
$$;
revoke execute on function public.qr_target_label(text, text) from public;
grant execute on function public.qr_target_label(text, text) to anon, authenticated;

-- ------------------------------------- 3. same-email history: guest requests

drop policy if exists "Guest read same-email service_requests" on public.service_requests;
create policy "Guest read same-email service_requests" on public.service_requests
  for select to authenticated
  using (
    requested_by_email is not null
    and requested_by_role = 'Guest'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'Guest' and lower(p.email) = lower(service_requests.requested_by_email)
    )
  );

-- ------------------------------------------------ 4. guests upload photos only

drop policy if exists "Signed-in users can upload to app buckets" on storage.objects;
create policy "Signed-in users can upload to app buckets" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'work-order-evidence'
    or (bucket_id = any (array['asset-images', 'documents', 'facility-documents']) and (select public.is_staff()))
  );

-- ------------------------------------------- 5. service requests: rate limit

create or replace function public.limit_service_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(public.current_user_role(), 'Guest');
  v_cap int := case when v_role = 'Guest' then 5 else 30 end;
  v_since text := to_char((now() at time zone 'utc') - interval '1 hour', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_count int;
begin
  -- The server's clock, not the browser's.
  new.created_at := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  if auth.uid() is null or v_role = 'Admin' then
    return new;
  end if;

  select count(*) into v_count
  from public.service_requests s
  where s.requested_by_user_id::text = auth.uid()::text and s.created_at >= v_since;

  if v_count >= v_cap then
    raise exception 'You have raised % requests in the last hour. Please wait a while before raising another.', v_count
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.limit_service_requests() from public, anon, authenticated;

drop trigger if exists trg_limit_service_requests on public.service_requests;
create trigger trg_limit_service_requests
  before insert on public.service_requests
  for each row execute function public.limit_service_requests();
