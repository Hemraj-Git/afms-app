-- Fixes asset status silently never changing for a Technician. updateAssetStatus
-- (src/context/AFMSContext.tsx) does a plain supabase.from('assets').update({status}),
-- but "Admin all on assets" (0005_admin_scoped_reference_tables.sql) is the
-- only write policy on assets -- there is no policy letting a Technician
-- write to assets at all, even though executing their own assigned work
-- order is exactly when this needs to happen (Corrective WO assignment ->
-- Under Maintenance, WO completion -> Operational, PM "start work" ->
-- Under Maintenance, inspection completion -> Operational). Same silent-
-- RLS-no-op bug already fixed for rooms/room_access_logs (0015/0016),
-- found here on a third table.
--
-- Fix: a narrow security-definer RPC, same pattern as room_check_in/
-- room_check_out, that only ever touches the status column and only for
-- roles that can legitimately reach this code path today (Admin, or a
-- Technician -- the work_orders/inspections "Assignee update own X"
-- policies already gate who gets this far client-side).

create or replace function public.set_asset_status(p_asset_id text, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if p_status not in ('Operational', 'Under Maintenance', 'In Storage', 'Retired') then
    raise exception 'Invalid asset status: %', p_status;
  end if;

  if not (
    public.is_admin()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'Technician')
  ) then
    raise exception 'Not authorized to change asset status';
  end if;

  update public.assets
  set status = p_status
  where id = p_asset_id;
end;
$$;

grant execute on function public.set_asset_status(text, text) to authenticated;
revoke execute on function public.set_asset_status(text, text) from public, anon;
