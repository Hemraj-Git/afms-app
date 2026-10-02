-- 0053: PM and inspection schedules can be added to an asset at any time.
--
-- Until now the first PM job and the first inspection were made only at the
-- moment an asset was created, by the browser, from its sub-category's
-- templates. Assets loaded before their templates existed could never be
-- scheduled. Now:
--
-- 1. schedule_asset_maintenance() -- an Admin gives one or many assets a
--    schedule for one template, with the date of the first job. Every later
--    job follows the template interval after each completion (0050). An asset
--    can run several schedules (a Monthly and a Quarterly PM), but never the
--    same template twice. The first date can't be changed afterwards.
-- 2. A one-off preventive job (no frequency, no checklist template) no longer
--    starts a quarterly chain when it is completed.
-- 3. A retired asset makes no more jobs: its PM jobs not yet started are
--    cancelled, its inspections not yet started are removed, and finishing
--    one already under way schedules nothing after it.
-- 4. A checklist template can't be deleted while a job still uses it.

-- ------------------------------------------------------------ 1. scheduling

create or replace function public.schedule_asset_maintenance(
  p_asset_ids text[],
  p_template_id text,
  p_mode text,
  p_first_due date default null
)
returns table (asset_id text, due_date text, status text, reason text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_latest date := ((now() at time zone 'Asia/Kolkata')::date + interval '2 years')::date;
  v_t record;
  v_a record;
  v_aid text;
  v_install date;
  v_due date;
  v_id text;
  v_why text;
begin
  if coalesce(public.current_user_role(), '') <> 'Admin' then
    raise exception 'Only an Admin can schedule PM or inspections';
  end if;
  if coalesce(p_mode, '') not in ('installation', 'today', 'date') then
    raise exception 'Choose how the first date is set';
  end if;
  if p_mode = 'date' and p_first_due is null then
    raise exception 'Pick the date of the first job';
  end if;

  select t.id, t.title, t.type, t.interval, t.items into v_t
  from public.checklist_templates t where t.id = p_template_id;
  if not found then
    raise exception 'That template no longer exists';
  end if;
  if v_t.type not in ('Preventive Maintenance', 'Inspection') then
    raise exception 'Only PM and inspection templates can be scheduled';
  end if;
  if coalesce(v_t.interval, '') = '' then
    raise exception 'Set how often "%" repeats before scheduling it', v_t.title;
  end if;
  if jsonb_typeof(v_t.items) is distinct from 'array' or jsonb_array_length(v_t.items) = 0 then
    raise exception 'Add checklist items to "%" before scheduling it', v_t.title;
  end if;
  if coalesce(array_length(p_asset_ids, 1), 0) > 500 then
    raise exception 'Schedule at most 500 assets at a time';
  end if;

  for v_aid in select distinct x from unnest(coalesce(p_asset_ids, '{}')) x where x is not null loop
    asset_id := v_aid;
    due_date := null;
    status := 'skipped';
    reason := null;

    -- One schedule per asset and template, even with two Admins at once.
    perform pg_advisory_xact_lock(hashtext('asset-schedule:' || v_aid || ':' || p_template_id));

    select a.id, a.status, a.room_id, a.installation_date into v_a from public.assets a where a.id = v_aid;
    if not found then
      reason := 'The asset no longer exists';
      return next;
      continue;
    end if;
    if v_a.status = 'Retired' then
      reason := 'The asset is retired';
      return next;
      continue;
    end if;

    if (v_t.type = 'Preventive Maintenance' and exists (
          select 1 from public.work_orders w
          where w.asset_id = v_aid and w.type = 'Preventive' and w.checklist_template_id = p_template_id
            and coalesce(w.status, 'Scheduled') not in ('Completed', 'Cancelled')))
       or (v_t.type = 'Inspection' and exists (
          select 1 from public.inspections i
          where i.asset_id = v_aid and i.template_id = p_template_id
            and coalesce(i.status, 'Scheduled') <> 'Completed')) then
      reason := 'Already scheduled';
      return next;
      continue;
    end if;

    v_install := public.parse_stored_date(v_a.installation_date);
    v_due := case p_mode
      when 'installation' then public.next_schedule_date(v_install, v_t.interval)
      when 'today' then public.next_schedule_date(v_today, v_t.interval)
      else p_first_due
    end;

    v_why := case
      when v_due is null then 'The asset has no installation date — pick a date or count from today'
      when v_due < v_today and p_mode = 'installation' then 'Installed too long ago — pick a date or count from today'
      when v_due < v_today then 'The first date can''t be in the past'
      when v_due > v_latest then 'The first date can''t be more than 2 years ahead'
      when v_install is not null and v_due < v_install then
        'The first date can''t be before the installation date (' || to_char(v_install, 'DD-MM-YYYY') || ')'
    end;
    if v_why is not null then
      reason := v_why;
      return next;
      continue;
    end if;

    if v_t.type = 'Preventive Maintenance' then
      -- Unnumbered until a technician is assigned (0014), like every PM job.
      v_id := gen_random_uuid()::text;
      insert into public.work_orders (
        id, wo_number, title, type, asset_id, room_id, priority, source, frequency, due_date, status,
        checklist_template_id, checklist_snapshot, created_at
      ) values (
        v_id, 'PENDING-' || v_id, v_t.title || ' (' || v_t.interval || ')', 'Preventive', v_aid, v_a.room_id,
        'Medium', 'Scheduled', v_t.interval, to_char(v_due, 'YYYY-MM-DD'), 'Scheduled',
        v_t.id, v_t.items, to_char(v_today, 'YYYY-MM-DD')
      );
    else
      -- The number is minted by trg_set_inspection_number.
      insert into public.inspections (
        id, inspection_number, asset_id, template_id, template_version, due_date, status, checklist_snapshot, created_at
      ) values (
        gen_random_uuid()::text, 'PENDING', v_aid, v_t.id, 1, to_char(v_due, 'YYYY-MM-DD'), 'Scheduled',
        v_t.items, to_char(v_today, 'YYYY-MM-DD')
      );
    end if;

    due_date := to_char(v_due, 'YYYY-MM-DD');
    status := 'scheduled';
    return next;
  end loop;
end;
$$;

revoke execute on function public.schedule_asset_maintenance(text[], text, text, date) from public, anon;
grant execute on function public.schedule_asset_maintenance(text[], text, text, date) to authenticated;

-- ------------------------------------- 2 & 3. what follows a finished job (0050)

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
  -- Only a scheduled one (it has a frequency or a checklist template): a
  -- one-off preventive job is just that. Never for a retired asset.
  if new.type = 'Preventive' and new.status = 'Completed' and old.status is distinct from 'Completed'
    and (nullif(new.frequency, '') is not null or new.checklist_template_id is not null)
    and not exists (select 1 from public.assets a where a.id = new.asset_id and a.status = 'Retired') then
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

    -- The next inspection, counted from this one's due date (none for a
    -- retired asset).
    if not exists (select 1 from public.assets a where a.id = new.asset_id and a.status = 'Retired') then
      insert into public.inspections (
        id, inspection_number, asset_id, template_id, template_version, due_date, status, checklist_snapshot, created_at
      ) values (
        gen_random_uuid()::text, 'PENDING', new.asset_id, new.template_id, coalesce(new.template_version, 1),
        to_char(public.next_schedule_date(coalesce(public.parse_stored_date(new.due_date), public.parse_stored_date(new.conducted_at), v_today), coalesce(v_every, 'Quarterly')), 'YYYY-MM-DD'),
        'Scheduled',
        case when jsonb_array_length(coalesce(new.checklist_snapshot, '[]'::jsonb)) > 0 then new.checklist_snapshot else coalesce(v_items, '[]'::jsonb) end,
        to_char(v_today, 'YYYY-MM-DD')
      );
    end if;

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

-- Retiring an asset ends its schedules: PM jobs not started are cancelled,
-- inspections not started are removed (inspections have no Cancelled state),
-- along with their reminders. Work already under way is left to finish.
create or replace function public.end_schedules_of_retired_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gone text[];
begin
  if new.status = 'Retired' and old.status is distinct from 'Retired' then
    update public.work_orders set status = 'Cancelled'
      where asset_id = new.id and type = 'Preventive' and status = 'Scheduled';

    with gone as (
      delete from public.inspections
      where asset_id = new.id and coalesce(status, 'Scheduled') in ('Scheduled', 'Overdue')
      returning id
    )
    select array_agg(id) into v_gone from gone;
    if v_gone is not null then
      delete from public.notifications where ref_id = any (v_gone);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_end_schedules_of_retired_asset on public.assets;
create trigger trg_end_schedules_of_retired_asset
  after update of status on public.assets
  for each row execute function public.end_schedules_of_retired_asset();

-- ------------------------------------------------- 4. templates in use stay

create or replace function public.keep_templates_in_use()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.work_orders w
    where w.checklist_template_id = old.id and coalesce(w.status, 'Scheduled') not in ('Completed', 'Cancelled')
  ) or exists (
    select 1 from public.inspections i
    where i.template_id = old.id and coalesce(i.status, 'Scheduled') <> 'Completed'
  ) then
    raise exception '"%" is used by scheduled jobs and can''t be deleted', old.title;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_keep_templates_in_use on public.checklist_templates;
create trigger trg_keep_templates_in_use
  before delete on public.checklist_templates
  for each row execute function public.keep_templates_in_use();

revoke execute on function public.work_order_follow_ups() from public, anon, authenticated;
revoke execute on function public.inspection_follow_ups() from public, anon, authenticated;
revoke execute on function public.end_schedules_of_retired_asset() from public, anon, authenticated;
revoke execute on function public.keep_templates_in_use() from public, anon, authenticated;
