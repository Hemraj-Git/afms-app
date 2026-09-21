-- When a technician hands a corrective job over to an outside vendor, the Admins
-- are told: an in-app notification (which also chimes for anyone with the app open,
-- through the same Realtime path as "work order assigned"). Until now a handover was
-- silent: nothing changed for Admins except the work order's "Execution Mode" text.
--
-- It fires once, on the change into executed_by = 'Vendor' while the job is still
-- open. Later edits to the vendor's details, switching back to In House, or handing
-- over and closing the job in one go do not notify. The person who made the change
-- is not notified about their own action.
--
-- Additive: the notifications type check gains one value, and nothing already
-- deployed reads or writes the new one (an older app just shows it without an icon).

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('wo_assigned', 'inspection_assigned', 'auto_checkout', 'vendor_handover'));

create or replace function public.notify_vendor_handover()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_vendor_name text;
begin
  if new.executed_by = 'Vendor'
     and new.status not in ('Completed', 'Cancelled')
     and (tg_op = 'INSERT' or old.executed_by is distinct from 'Vendor') then

    select name into v_vendor_name from public.vendors where id = new.vendor_id;

    insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
    select p.id,
           'vendor_handover',
           'Handed to vendor: ' || new.wo_number,
           coalesce(v_vendor_name, 'Vendor not selected yet') || ' - ' || coalesce(new.title, new.type || ' work order'),
           'work_orders',
           new.id
    from public.profiles p
    where p.role = 'Admin'
      and p.id is distinct from auth.uid();
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_notify_vendor_handover on public.work_orders;
create trigger trg_notify_vendor_handover
  after insert or update on public.work_orders
  for each row execute function public.notify_vendor_handover();

-- Only the trigger calls it: nobody can run it directly through the API.
revoke execute on function public.notify_vendor_handover() from public, anon, authenticated;
