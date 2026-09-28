-- 0046: End-to-end test runs (e2e/) raise service requests titled "[E2E] ...".
-- They must not reach real Admins' phones as push alerts.

create or replace function public.push_new_service_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.title like '[E2E]%' then
    return null;
  end if;
  if exists (
    select 1
    from public.push_subscriptions s
    join public.profiles p on p.id = s.user_id
    where p.role = 'Admin'
      and s.user_id is distinct from new.requested_by_user_id
  ) then
    perform public.queue_push('service_request', new.id);
  end if;
  return null;
end;
$$;

revoke execute on function public.push_new_service_request() from public, anon, authenticated;
