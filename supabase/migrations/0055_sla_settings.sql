-- 0055: SLA hours live in the database, and only shape new requests.
--
-- Until now the "Configure SLA Rules" hours were kept in each Admin's own
-- browser (localStorage), with 4/12/24/48 hard-coded everywhere else. A
-- change reached only that one browser: phones -- where most requests are
-- raised -- kept the defaults. And each request's deadline was worked out on
-- the person's device, from its clock.
--
-- Now:
-- 1. sla_settings holds the hours per priority. Everyone reads it; only an
--    Admin changes it.
-- 2. A new service request gets its deadline from the database: now + the
--    hours for its priority, and keeps those hours on the row (sla_hours).
--    Changing the settings never touches requests already raised, nor the
--    work orders made from them (their due dates were copied at the time).
-- 3. Existing requests get sla_hours worked out from their own deadline, so
--    their "24h SLA" labels keep showing what they were given.

-- ------------------------------------------------------------ 1. settings

create table if not exists public.sla_settings (
  priority text primary key check (priority in ('Critical', 'High', 'Medium', 'Low')),
  hours integer not null check (hours between 1 and 720),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.sla_settings (priority, hours) values
  ('Critical', 4), ('High', 12), ('Medium', 24), ('Low', 48)
on conflict (priority) do nothing;

alter table public.sla_settings enable row level security;

drop policy if exists "Signed-in read sla_settings" on public.sla_settings;
create policy "Signed-in read sla_settings" on public.sla_settings
  for select to authenticated using (true);

drop policy if exists "Admin update sla_settings" on public.sla_settings;
create policy "Admin update sla_settings" on public.sla_settings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke insert, delete, truncate on public.sla_settings from anon, authenticated;
revoke all on public.sla_settings from anon;

-- Who changed it, and when.
create or replace function public.stamp_sla_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke execute on function public.stamp_sla_settings() from public, anon, authenticated;

drop trigger if exists trg_stamp_sla_settings on public.sla_settings;
create trigger trg_stamp_sla_settings
  before update on public.sla_settings
  for each row execute function public.stamp_sla_settings();

-- ------------------------------------------- 2. each request's own deadline

alter table public.service_requests add column if not exists sla_hours integer;

create or replace function public.set_service_request_sla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hours integer;
begin
  select s.hours into v_hours from public.sla_settings s where s.priority = coalesce(new.priority, 'Medium');
  v_hours := coalesce(v_hours, 24);
  new.sla_hours := v_hours;
  -- From the server's clock, in the same text format as created_at.
  new.sla_due_date := to_char((now() at time zone 'utc') + make_interval(hours => v_hours), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  return new;
end;
$$;
revoke execute on function public.set_service_request_sla() from public, anon, authenticated;

-- Runs after trg_limit_service_requests (triggers fire in name order).
drop trigger if exists trg_sla_due_date on public.service_requests;
create trigger trg_sla_due_date
  before insert on public.service_requests
  for each row execute function public.set_service_request_sla();

-- ------------------------------------- 3. existing requests: their own hours

-- A stored text timestamp, or null if it isn't one.
create or replace function public.try_timestamptz(v text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
begin
  return v::timestamptz;
exception when others then
  return null;
end;
$$;

update public.service_requests
set sla_hours = round(extract(epoch from (public.try_timestamptz(sla_due_date) - public.try_timestamptz(created_at))) / 3600)
where sla_hours is null
  and public.try_timestamptz(sla_due_date) is not null
  and public.try_timestamptz(created_at) is not null
  and public.try_timestamptz(sla_due_date) > public.try_timestamptz(created_at);
