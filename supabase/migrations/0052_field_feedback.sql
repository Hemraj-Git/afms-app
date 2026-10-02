-- 0052: Fixes from walking through the field app as each role.
--
-- 1. work_orders.instructions -- what the office tells the technician when
--    assigning the job. It used to be written into technician_remarks, so the
--    phone showed it as the technician's own notes and their notes then
--    replaced it.
-- 2. work_orders.diagnosis -- the technician's "Problem found". It used to
--    overwrite issue_logged, the issue as reported / the scope the office
--    wrote, so that was lost. issue_logged now stays as it was raised.
-- 3. inspections.start_photo_url -- the photo that shows the inspector was at
--    the asset when the inspection started (photo_url is the one at the end);
--    inspections.instructions -- what the office tells the inspector when
--    assigning it (the desktop asked for it but never saved it).
-- 4. service_requests.requested_by_role -- the requester's role, taken from
--    their profile when the request is made. It had no column, so screens
--    looked it up and showed "Staff" whenever they could not.
-- 5. add_field_vendor() -- a technician sending a part out can add a repair
--    vendor that is not in the list yet (name, phone, contact, what they do).

alter table public.work_orders add column if not exists instructions text;
alter table public.work_orders add column if not exists diagnosis text;
alter table public.inspections add column if not exists start_photo_url text;
alter table public.inspections add column if not exists instructions text;
alter table public.service_requests add column if not exists requested_by_role text;

-- Jobs not started yet: whatever is in technician_remarks was typed by the
-- office at assignment (the technician's first save starts the job). Move it
-- to instructions; the automatic "Assigned to …" line is not an instruction.
update public.work_orders
set instructions = case when technician_remarks like 'Assigned to %' then null else technician_remarks end,
    technician_remarks = null
where status = 'Scheduled' and technician_remarks is not null and instructions is null;

-- The requester's role, from their profile -- never from what the browser sends.
create or replace function public.set_requester_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.requested_by_user_id is not null then
    new.requested_by_role := coalesce(
      (select p.role from public.profiles p where p.id = new.requested_by_user_id),
      new.requested_by_role
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_requester_role on public.service_requests;
create trigger trg_set_requester_role
  before insert on public.service_requests
  for each row execute function public.set_requester_role();

update public.service_requests s
set requested_by_role = p.role
from public.profiles p
where p.id = s.requested_by_user_id and s.requested_by_role is null;

-- A repair vendor added from the phone. Technicians and Admins only; the
-- office can fill in the rest (email, address, AMC) on the Vendors page.
create or replace function public.add_field_vendor(p_name text, p_phone text, p_contact_person text, p_category text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
begin
  if coalesce(public.current_user_role(), '') not in ('Technician', 'Admin') then
    raise exception 'Only technicians can add a vendor from the field app';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Enter the vendor''s name';
  end if;
  if coalesce(trim(p_phone), '') = '' then
    raise exception 'Enter the vendor''s phone number';
  end if;
  insert into public.vendors (name, phone, contact_person, category_supplied, has_amc)
  values (trim(p_name), trim(p_phone), nullif(trim(p_contact_person), ''), nullif(trim(p_category), ''), false)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.set_requester_role() from public, anon, authenticated;
revoke execute on function public.add_field_vendor(text, text, text, text) from public, anon;
grant execute on function public.add_field_vendor(text, text, text, text) to authenticated;
