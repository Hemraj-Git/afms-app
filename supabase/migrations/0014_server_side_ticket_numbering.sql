-- Fixes silent data loss when a Guest/Technician creates a Service Request
-- (and the identical latent bug in work_orders/inspections): ticket/WO/
-- inspection numbers were computed client-side from getNextSequence() over
-- whatever rows the client's own RLS-scoped SELECT could see. A Guest or
-- Technician only sees their OWN rows ("Requester/Assignee read own X"
-- policies), so their client-side "next number" guess routinely collided
-- with an existing row's number, the insert/update was rejected by the
-- table's UNIQUE constraint, and the caller silently swallowed the error
-- while the UI had already shown a false "success" and pushed a phantom row
-- into local-only React state (which then vanished on refresh once a fresh,
-- correctly RLS-filtered fetch ran).
--
-- Fix: mint these numbers from real Postgres sequences, server-side, which
-- are not subject to RLS and are therefore correct and race-free regardless
-- of which role is inserting. Triggers OVERRIDE any client-supplied number
-- when their minting condition applies, so a stale/guessed client value can
-- never reach storage even if the client code regresses later.

create sequence if not exists public.service_requests_ticket_seq;
select setval('public.service_requests_ticket_seq', 6, true);

create sequence if not exists public.work_orders_pm_seq;
select setval('public.work_orders_pm_seq', 10, true);

create sequence if not exists public.work_orders_cr_seq;
select setval('public.work_orders_cr_seq', 3, true);

create sequence if not exists public.inspections_seq;
select setval('public.inspections_seq', 9, true);

grant usage on sequence public.service_requests_ticket_seq to authenticated;
grant usage on sequence public.work_orders_pm_seq to authenticated;
grant usage on sequence public.work_orders_cr_seq to authenticated;
grant usage on sequence public.inspections_seq to authenticated;

-- ── service_requests: mint ticket_id on every insert ──

create or replace function public.set_service_request_ticket_id()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  new.ticket_id := 'SR-' || extract(year from now())::text || '-' ||
    lpad(nextval('public.service_requests_ticket_seq')::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists trg_set_service_request_ticket_id on public.service_requests;
create trigger trg_set_service_request_ticket_id
  before insert on public.service_requests
  for each row execute function public.set_service_request_ticket_id();

-- ── inspections: mint inspection_number on every insert ──
-- Covers both initial PM-schedule creation and auto-scheduled recurrence on
-- completion -- both are plain inserts.

create or replace function public.set_inspection_number()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  new.inspection_number := 'INSP-' || extract(year from now())::text || '-' ||
    lpad(nextval('public.inspections_seq')::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists trg_set_inspection_number on public.inspections;
create trigger trg_set_inspection_number
  before insert on public.inspections
  for each row execute function public.set_inspection_number();

-- ── work_orders: mint wo_number only on first-assignment transition ──
-- Work orders are created up front as a 'PENDING-<uuid>' placeholder (see
-- makePendingWoNumber in src/lib/idGenerator.ts) and only become a real,
-- numbered work order once a technician is assigned for the first time.
-- Only override when that specific transition is happening -- never touch
-- wo_number on any other update.

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
      extract(year from now())::text || '-' ||
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

drop trigger if exists trg_mint_work_order_number on public.work_orders;
create trigger trg_mint_work_order_number
  before update on public.work_orders
  for each row execute function public.mint_work_order_number();
