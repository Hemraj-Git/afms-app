-- The 0014 numbering triggers used extract(year from now()), which is
-- server UTC -- mislabels the year for anything created after local
-- midnight but before ~05:30 IST on Dec 31 / Jan 1. Switch to the same
-- Asia/Kolkata conversion already used correctly by run_auto_checkouts()
-- (0006). The underlying sequences are untouched -- this only affects the
-- year text baked into the label, not uniqueness.

create or replace function public.set_service_request_ticket_id()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  new.ticket_id := 'SR-' || extract(year from now() at time zone 'Asia/Kolkata')::text || '-' ||
    lpad(nextval('public.service_requests_ticket_seq')::text, 4, '0');
  return new;
end;
$$;

create or replace function public.set_inspection_number()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  new.inspection_number := 'INSP-' || extract(year from now() at time zone 'Asia/Kolkata')::text || '-' ||
    lpad(nextval('public.inspections_seq')::text, 4, '0');
  return new;
end;
$$;

create or replace function public.mint_work_order_number()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if old.wo_number like 'PENDING-%'
     and new.assigned_technician_id is not null
     and new.type in ('Preventive', 'Corrective') then
    new.wo_number := (case when new.type = 'Preventive' then 'WO-PM-' else 'WO-CR-' end) ||
      extract(year from now() at time zone 'Asia/Kolkata')::text || '-' ||
      lpad(nextval(
        (case when new.type = 'Preventive'
          then 'public.work_orders_pm_seq'
          else 'public.work_orders_cr_seq'
        end)::regclass
      )::text, 4, '0');
  end if;
  return new;
end;
$$;
