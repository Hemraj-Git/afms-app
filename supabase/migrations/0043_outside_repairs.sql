-- Outside (off-site) repairs for Corrective maintenance.
--
-- During a corrective job the technician, or a vendor working on site, may find
-- that a part (e.g. a motherboard) or the whole asset (e.g. a printer) has to go
-- to an outside workshop. Until now nothing recorded what left the site, to whom,
-- when it was due back, or when it came back. Each send-out is now one row here,
-- tied to the work order, with its own return.
--
--  * Numbered OSR-YYYY-#### by the database (same approach as tickets, 0014).
--  * Only Admins and the technician assigned to that work order can see or record
--    them (vendors have no login; the technician records on their behalf).
--  * A work order cannot be completed while anything is still out.
--  * Admins are alerted when something is sent out, and once when its expected
--    return date passes without a return (daily job, 09:00 IST).
--
-- Additive: a new table, two notification types and triggers that only act when
-- rows exist here. The code currently in production never creates any, so it is
-- unaffected.

create sequence if not exists public.outside_repairs_seq;

create table if not exists public.outside_repairs (
  id text primary key default (gen_random_uuid())::text,
  repair_number text not null unique,
  work_order_id text not null references public.work_orders(id) on delete cascade,
  asset_id text references public.assets(id) on delete set null,
  scope text not null check (scope in ('Component', 'Complete Asset')),
  component_name text,
  fault_description text,
  sent_by text not null default 'Technician' check (sent_by in ('Technician', 'Vendor')),
  vendor_id text references public.vendors(id) on delete set null,
  sent_date date not null,
  expected_return_date date not null,
  dispatch_ref text,
  vendor_ref text,
  estimated_cost numeric check (estimated_cost is null or estimated_cost >= 0),
  dispatch_photo_url text,
  status text not null default 'Out for Repair' check (status in ('Out for Repair', 'Returned')),
  returned_date date,
  outcome text check (outcome is null or outcome in ('Repaired', 'Replaced by vendor', 'Not repairable')),
  actual_cost numeric check (actual_cost is null or actual_cost >= 0),
  return_remarks text,
  return_photo_url text,
  recorded_by text,
  returned_by text,
  overdue_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outside_repairs_component_named
    check (scope <> 'Component' or coalesce(btrim(component_name), '') <> ''),
  constraint outside_repairs_etd_not_before_sent
    check (expected_return_date >= sent_date),
  constraint outside_repairs_return_complete
    check (status <> 'Returned' or (returned_date is not null and outcome is not null)),
  constraint outside_repairs_return_not_before_sent
    check (returned_date is null or returned_date >= sent_date)
);

comment on table public.outside_repairs is
  'A part or a whole asset sent off site for repair during a corrective work order, and its return.';

create index if not exists outside_repairs_work_order_idx on public.outside_repairs (work_order_id);
create index if not exists outside_repairs_asset_idx on public.outside_repairs (asset_id);
create index if not exists outside_repairs_vendor_idx on public.outside_repairs (vendor_id);
create index if not exists outside_repairs_open_idx on public.outside_repairs (expected_return_date)
  where status = 'Out for Repair';

-- ── Row-level security: Admins everything; the assigned technician their own job's ──

alter table public.outside_repairs enable row level security;

create policy "Admin all on outside_repairs" on public.outside_repairs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Assignee read outside_repairs" on public.outside_repairs
  for select to authenticated
  using (exists (
    select 1 from public.work_orders w
    where w.id = outside_repairs.work_order_id
      and w.assigned_technician_id = ((select auth.uid()))::text
  ));

create policy "Assignee insert outside_repairs" on public.outside_repairs
  for insert to authenticated
  with check (exists (
    select 1 from public.work_orders w
    where w.id = outside_repairs.work_order_id
      and w.assigned_technician_id = ((select auth.uid()))::text
  ));

create policy "Assignee update outside_repairs" on public.outside_repairs
  for update to authenticated
  using (exists (
    select 1 from public.work_orders w
    where w.id = outside_repairs.work_order_id
      and w.assigned_technician_id = ((select auth.uid()))::text
  ))
  with check (exists (
    select 1 from public.work_orders w
    where w.id = outside_repairs.work_order_id
      and w.assigned_technician_id = ((select auth.uid()))::text
  ));

-- ── Before insert: number it, check the work order, fill the asset ──

create or replace function public.outside_repairs_before_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_type text;
  v_status text;
  v_asset text;
begin
  select type, status, asset_id into v_type, v_status, v_asset
  from public.work_orders where id = new.work_order_id;

  if v_type is distinct from 'Corrective' then
    raise exception 'Only a corrective work order can send something outside for repair.';
  end if;
  if v_status in ('Completed', 'Cancelled') then
    raise exception 'This work order is already %; nothing more can be sent out on it.', lower(v_status);
  end if;

  new.repair_number := 'OSR-' || extract(year from (now() at time zone 'Asia/Kolkata'))::text || '-' ||
    lpad(nextval('public.outside_repairs_seq')::text, 4, '0');
  new.asset_id := coalesce(new.asset_id, v_asset);
  new.status := 'Out for Repair';
  new.overdue_notified_at := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists trg_outside_repairs_before_insert on public.outside_repairs;
create trigger trg_outside_repairs_before_insert
  before insert on public.outside_repairs
  for each row execute function public.outside_repairs_before_insert();

-- ── Before update: keep the number and job fixed; a new ETD may alert again ──

create or replace function public.outside_repairs_before_update()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  new.repair_number := old.repair_number;
  new.work_order_id := old.work_order_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  if new.expected_return_date is distinct from old.expected_return_date then
    new.overdue_notified_at := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_outside_repairs_before_update on public.outside_repairs;
create trigger trg_outside_repairs_before_update
  before update on public.outside_repairs
  for each row execute function public.outside_repairs_before_update();

-- ── Notifications: two new kinds ──

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('wo_assigned', 'inspection_assigned', 'auto_checkout', 'vendor_handover',
                  'outside_repair_sent', 'outside_repair_overdue'));

-- What was sent, of which asset, to whom, due back when.
create or replace function public.outside_repair_summary(r public.outside_repairs)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    (case when r.scope = 'Component' then r.component_name || ' of ' else '' end)
    || coalesce((select name from public.assets where id = r.asset_id), 'asset')
    || ' → ' || coalesce((select name from public.vendors where id = r.vendor_id), 'vendor not named')
    || ' · back by ' || to_char(r.expected_return_date, 'DD-MM-YYYY')
    || coalesce(' (' || (select wo_number from public.work_orders where id = r.work_order_id
                         and wo_number not like 'PENDING-%') || ')', '')
$function$;

create or replace function public.notify_outside_repair_sent()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
  select p.id, 'outside_repair_sent', 'Sent for outside repair: ' || new.repair_number,
         public.outside_repair_summary(new), 'outside_repairs', new.id
  from public.profiles p
  where p.role = 'Admin' and p.id is distinct from auth.uid();
  return new;
end;
$function$;

drop trigger if exists trg_notify_outside_repair_sent on public.outside_repairs;
create trigger trg_notify_outside_repair_sent
  after insert on public.outside_repairs
  for each row execute function public.notify_outside_repair_sent();

-- ── A work order cannot be completed while anything is still out ──

create or replace function public.block_completion_with_open_outside_repairs()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_open text;
begin
  if new.status = 'Completed' and old.status is distinct from 'Completed' then
    select string_agg(repair_number, ', ' order by repair_number) into v_open
    from public.outside_repairs
    where work_order_id = new.id and status = 'Out for Repair';
    if v_open is not null then
      raise exception 'This work order cannot be completed: % is still out for repair. Record its return first.', v_open;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_block_completion_with_open_outside_repairs on public.work_orders;
create trigger trg_block_completion_with_open_outside_repairs
  before update on public.work_orders
  for each row execute function public.block_completion_with_open_outside_repairs();

-- ── Daily: alert once for each item past its expected return date ──

create or replace function public.notify_overdue_outside_repairs()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r public.outside_repairs;
  v_tech text;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  for r in
    select * from public.outside_repairs
    where status = 'Out for Repair'
      and expected_return_date < v_today
      and overdue_notified_at is null
  loop
    select assigned_technician_id into v_tech from public.work_orders where id = r.work_order_id;

    insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
    select p.id, 'outside_repair_overdue', 'Overdue return: ' || r.repair_number,
           public.outside_repair_summary(r), 'outside_repairs', r.id
    from public.profiles p
    where p.role = 'Admin' or p.id::text = v_tech;

    update public.outside_repairs set overdue_notified_at = now() where id = r.id;
  end loop;
end;
$function$;

select cron.unschedule(jobid) from cron.job where jobname = 'afms-outside-repair-overdue';
select cron.schedule('afms-outside-repair-overdue', '30 3 * * *', $$select public.notify_overdue_outside_repairs();$$);

-- Only triggers and the scheduled job call these; nobody can run them through the API.
revoke execute on function public.outside_repairs_before_insert() from public, anon, authenticated;
revoke execute on function public.outside_repairs_before_update() from public, anon, authenticated;
revoke execute on function public.notify_outside_repair_sent() from public, anon, authenticated;
revoke execute on function public.block_completion_with_open_outside_repairs() from public, anon, authenticated;
revoke execute on function public.notify_overdue_outside_repairs() from public, anon, authenticated;
revoke execute on function public.outside_repair_summary(public.outside_repairs) from public, anon, authenticated;

-- ── Live updates ──
alter publication supabase_realtime add table public.outside_repairs;
