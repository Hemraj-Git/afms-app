-- 0051: Two kinds of notification the field app was missing.
--
-- 1. The person who raised a request hears what happened to it: resolved,
--    escalated to a supervisor, or closed without a job (and why). Until now
--    a requester had to keep opening the app to find out.
-- 2. Every morning (08:00 IST) each technician and inspector gets one
--    reminder listing their preventive jobs and inspections due that day.
--
-- Both are plain rows in `notifications`, so the bell shows them and the
-- existing trigger (0044) sends them to the phone as push alerts.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('wo_assigned', 'inspection_assigned', 'auto_checkout', 'vendor_handover',
                  'outside_repair_sent', 'outside_repair_overdue',
                  'request_resolved', 'request_escalated', 'request_closed', 'due_today'));

-- ------------------------------------------------------------ request updates

create or replace function public.notify_requester()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_title text;
  v_body text;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  if new.status = 'Resolved' then
    v_type := 'request_resolved';
    v_title := 'Resolved: ' || new.ticket_id;
    v_body := new.title || ' — ' || coalesce(nullif(new.resolution_notes, ''), 'The facilities team has marked it fixed.');
  elsif new.status = 'Escalated' then
    v_type := 'request_escalated';
    v_title := 'Escalated: ' || new.ticket_id;
    v_body := new.title || ' — raised to a supervisor for urgent attention.';
  elsif new.status = 'Closed' and old.status is distinct from 'Resolved' then
    -- Closed straight away (not after being resolved): usually dismissed.
    v_type := 'request_closed';
    v_title := 'Closed: ' || new.ticket_id;
    v_body := new.title || coalesce(' — ' || nullif(coalesce(new.dismissal_reason, new.resolution_notes), ''), '');
  else
    return null;
  end if;

  -- The person who raised it -- and, for a guest, their later visits too (a
  -- returning guest signs in as a new account each time, matched by email).
  -- Not whoever made this change: nobody is told what they just did.
  insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
  select p.id, v_type, v_title, v_body, 'service_requests', new.id
  from public.profiles p
  where (p.id = new.requested_by_user_id
         or (p.role = 'Guest' and new.requested_by_email is not null and lower(p.email) = lower(new.requested_by_email)))
    and p.id is distinct from auth.uid();

  return null;
end;
$$;

drop trigger if exists trg_notify_requester on public.service_requests;
create trigger trg_notify_requester
  after update of status on public.service_requests
  for each row execute function public.notify_requester();

-- ------------------------------------------------------------ due today

-- One reminder per person per day: their open preventive jobs and
-- inspections due today. A single item links straight to it.
create or replace function public.notify_due_today()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today text := to_char((now() at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD');
  v_since timestamptz := ((now() at time zone 'Asia/Kolkata')::date)::timestamp at time zone 'Asia/Kolkata';
  r record;
begin
  for r in
    with due as (
      select w.assigned_technician_id as uid, 'work_orders' as tbl, w.id, w.wo_number as num,
             coalesce(a.name, w.title) as what, 1 as is_pm, 0 as is_insp
      from public.work_orders w
      left join public.assets a on a.id = w.asset_id
      where w.type = 'Preventive' and w.due_date = v_today
        and coalesce(w.status, '') not in ('Completed', 'Cancelled')
        and w.assigned_technician_id is not null
      union all
      select i.conducted_by_user_id, 'inspections', i.id, i.inspection_number,
             coalesce(a.name, 'Inspection'), 0, 1
      from public.inspections i
      left join public.assets a on a.id = i.asset_id
      where i.due_date = v_today and coalesce(i.status, '') <> 'Completed'
        and i.conducted_by_user_id is not null
    )
    select d.uid,
           sum(d.is_pm) as pms,
           sum(d.is_insp) as insps,
           count(*) as total,
           string_agg(d.num || ' ' || d.what, '; ' order by d.num) as items,
           min(d.tbl) as one_tbl,
           min(d.id) as one_id
    from due d
    join public.profiles p on p.id::text = d.uid
    where not exists (
      select 1 from public.notifications n
      where n.user_id = p.id and n.type = 'due_today' and n.created_at >= v_since
    )
    group by d.uid
  loop
    insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
    values (
      r.uid::uuid,
      'due_today',
      'Due today: ' || concat_ws(', ',
        case when r.pms = 1 then '1 preventive job' when r.pms > 1 then r.pms || ' preventive jobs' end,
        case when r.insps = 1 then '1 inspection' when r.insps > 1 then r.insps || ' inspections' end),
      left(r.items, 300),
      case when r.total = 1 then r.one_tbl end,
      case when r.total = 1 then r.one_id end
    );
  end loop;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'afms-due-today';
select cron.schedule('afms-due-today', '30 2 * * *', $$select public.notify_due_today();$$);

-- Only the trigger and the scheduled job call these.
revoke execute on function public.notify_requester() from public, anon, authenticated;
revoke execute on function public.notify_due_today() from public, anon, authenticated;
