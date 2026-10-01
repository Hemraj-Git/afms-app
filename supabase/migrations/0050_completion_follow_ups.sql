-- 0050: What follows a finished job or inspection is now made by the database.
--
-- The app used to create these from the browser of whoever finished the
-- work, after saving it:
--   - a completed preventive work order -> the next one in its schedule
--   - a completed inspection -> the next inspection in its schedule
--   - a FAILED inspection -> a corrective work order (waiting for a technician)
--   - the asset's status: Under Maintenance while worked on, Operational after
-- Only Admins may insert work orders and inspections (and only Admins and
-- Technicians may change an asset's status), so when a technician, a
-- housekeeper or a faculty member finished work on the phone these were
-- refused and lost: the schedule simply stopped, a failure raised nothing.
--
-- Now: triggers do it on the save itself, whoever saves, with the same rules
-- the app used (see AFMSContext updateWorkOrderStatus / completeInspection,
-- which no longer do it themselves). A guard drops the duplicate an older app
-- version still sends as an Admin, so nothing is made twice.

-- A date stored as text: YYYY-MM-DD (the norm) or DD-MM-YYYY; else null.
create or replace function public.parse_stored_date(v text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if v ~ '^\d{4}-\d{2}-\d{2}' then return left(v, 10)::date; end if;
  if v ~ '^\d{2}-\d{2}-\d{4}' then return to_date(left(v, 10), 'DD-MM-YYYY'); end if;
  return null;
exception when others then
  return null;
end;
$$;

-- The next date in a schedule. Same words as addIntervalToDate in
-- src/lib/idGenerator.ts; anything unrecognised is quarterly.
create or replace function public.next_schedule_date(base date, every text)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(coalesce(every, '')) like '%week%' then base + 7
    when lower(coalesce(every, '')) like '%half%' then (base + interval '6 months')::date
    when lower(coalesce(every, '')) like '%month%' then (base + interval '1 month')::date
    when lower(coalesce(every, '')) like '%quat%' or lower(coalesce(every, '')) like '%quarter%' then (base + interval '3 months')::date
    when lower(coalesce(every, '')) like '%annual%' or lower(coalesce(every, '')) like '%year%' then (base + interval '1 year')::date
    else (base + interval '3 months')::date
  end
$$;

-- ---------------------------------------------------------------- work orders

create or replace function public.work_order_follow_ups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_every text;
  v_done date;
  v_id text;
begin
  -- The asset's status follows the work on it (never a retired or stored one).
  if new.asset_id is not null then
    if new.status = 'Completed' and old.status is distinct from 'Completed' then
      update public.assets set status = 'Operational'
        where id = new.asset_id and coalesce(status, '') not in ('Retired', 'In Storage');
    elsif new.status = 'In Progress' and old.status is distinct from 'In Progress' then
      update public.assets set status = 'Under Maintenance'
        where id = new.asset_id and coalesce(status, '') not in ('Retired', 'In Storage');
    elsif new.type = 'Corrective' and new.status not in ('Completed', 'Cancelled')
      and old.wo_number like 'PENDING-%' and new.wo_number not like 'PENDING-%' then
      -- A breakdown's first assignment takes the asset out of service.
      update public.assets set status = 'Under Maintenance'
        where id = new.asset_id and coalesce(status, '') not in ('Retired', 'In Storage');
    end if;
  end if;

  -- A finished preventive job schedules the next one, counted from the day it
  -- was actually done (a late one must not push every later cycle back).
  if new.type = 'Preventive' and new.status = 'Completed' and old.status is distinct from 'Completed' then
    v_every := coalesce(
      nullif(new.frequency, ''),
      (select t.interval from public.checklist_templates t where t.id = new.checklist_template_id),
      'Quarterly'
    );
    v_done := coalesce(public.parse_stored_date(new.completed_at), v_today);
    v_id := gen_random_uuid()::text;
    insert into public.work_orders (
      id, wo_number, title, type, asset_id, room_id, priority, source, frequency, due_date, status,
      checklist_template_id, checklist_snapshot, created_at
    ) values (
      v_id, 'PENDING-' || v_id, coalesce(nullif(new.title, ''), 'Preventive Maintenance (' || v_every || ')'), 'Preventive',
      new.asset_id, new.room_id, 'Medium', 'Scheduled', v_every,
      to_char(public.next_schedule_date(v_done, v_every), 'YYYY-MM-DD'), 'Scheduled',
      new.checklist_template_id, new.checklist_snapshot, to_char(v_done, 'YYYY-MM-DD')
    );
  end if;

  return null;
end;
$$;

drop trigger if exists trg_work_order_follow_ups on public.work_orders;
create trigger trg_work_order_follow_ups
  after update on public.work_orders
  for each row execute function public.work_order_follow_ups();

-- ---------------------------------------------------------------- inspections

create or replace function public.inspection_follow_ups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_every text;
  v_items jsonb;
  v_id text;
begin
  if new.status = 'Completed' and old.status is distinct from 'Completed' then
    select t.interval, t.items into v_every, v_items from public.checklist_templates t where t.id = new.template_id;

    -- The next inspection, counted from this one's due date.
    insert into public.inspections (
      id, inspection_number, asset_id, template_id, template_version, due_date, status, checklist_snapshot, created_at
    ) values (
      gen_random_uuid()::text, 'PENDING', new.asset_id, new.template_id, coalesce(new.template_version, 1),
      to_char(public.next_schedule_date(coalesce(public.parse_stored_date(new.due_date), public.parse_stored_date(new.conducted_at), v_today), coalesce(v_every, 'Quarterly')), 'YYYY-MM-DD'),
      'Scheduled',
      case when jsonb_array_length(coalesce(new.checklist_snapshot, '[]'::jsonb)) > 0 then new.checklist_snapshot else coalesce(v_items, '[]'::jsonb) end,
      to_char(v_today, 'YYYY-MM-DD')
    );

    if new.result = 'Fail' then
      -- A failure raises a corrective job for the maintenance team. It waits,
      -- unnumbered, for an Admin to assign a technician (which is also when
      -- the asset goes Under Maintenance).
      v_id := gen_random_uuid()::text;
      insert into public.work_orders (
        id, wo_number, title, type, asset_id, priority, source, source_ref_id, due_date, status, issue_logged, created_at
      ) values (
        v_id, 'PENDING-' || v_id, 'Corrective: Defect from ' || new.inspection_number, 'Corrective', new.asset_id, 'Medium',
        'Failed Inspection', new.inspection_number, to_char(v_today + 2, 'YYYY-MM-DD'), 'Scheduled',
        'Failed inspection item during inspection: ' || coalesce(new.remarks, ''), to_char(v_today, 'YYYY-MM-DD')
      );
    elsif new.result = 'Pass' and new.asset_id is not null then
      update public.assets set status = 'Operational'
        where id = new.asset_id and coalesce(status, '') not in ('Retired', 'In Storage');
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_inspection_follow_ups on public.inspections;
create trigger trg_inspection_follow_ups
  after update on public.inspections
  for each row execute function public.inspection_follow_ups();

-- ------------------------------------------------- never the same follow-up twice

-- Drops an unassigned follow-up that already exists: the next preventive job
-- or inspection for the same asset, checklist and date, or a second corrective
-- job for the same failed inspection. (Until every open app has updated, an
-- Admin's browser still sends its own copy after the trigger has made one.)
-- Named to run before the numbering trigger, so a dropped row uses no number.
create or replace function public.skip_duplicate_follow_up()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'work_orders' then
    if new.source = 'Failed Inspection' and new.source_ref_id is not null and exists (
      select 1 from public.work_orders w where w.source = 'Failed Inspection' and w.source_ref_id = new.source_ref_id
    ) then
      return null;
    end if;
    if new.type = 'Preventive' and coalesce(new.status, 'Scheduled') = 'Scheduled' and new.assigned_technician_id is null
      and new.asset_id is not null and exists (
        select 1 from public.work_orders w
        where w.type = 'Preventive' and w.asset_id = new.asset_id
          and coalesce(w.checklist_template_id, '') = coalesce(new.checklist_template_id, '')
          and w.due_date = new.due_date and coalesce(w.status, '') not in ('Completed', 'Cancelled')
      ) then
      return null;
    end if;
  elsif tg_table_name = 'inspections' then
    if coalesce(new.status, 'Scheduled') = 'Scheduled' and new.conducted_by_user_id is null and new.asset_id is not null and exists (
      select 1 from public.inspections i
      where i.asset_id = new.asset_id and coalesce(i.template_id, '') = coalesce(new.template_id, '')
        and i.due_date = new.due_date and coalesce(i.status, '') <> 'Completed'
    ) then
      return null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_0_skip_duplicate_follow_up on public.work_orders;
create trigger trg_0_skip_duplicate_follow_up
  before insert on public.work_orders
  for each row execute function public.skip_duplicate_follow_up();

drop trigger if exists trg_0_skip_duplicate_follow_up on public.inspections;
create trigger trg_0_skip_duplicate_follow_up
  before insert on public.inspections
  for each row execute function public.skip_duplicate_follow_up();

revoke execute on function public.work_order_follow_ups() from public, anon, authenticated;
revoke execute on function public.inspection_follow_ups() from public, anon, authenticated;
revoke execute on function public.skip_duplicate_follow_up() from public, anon, authenticated;
