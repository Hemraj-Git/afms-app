-- Lets a returning guest (new anonymous session, same self-reported email)
-- read service_requests raised under a PREVIOUS visit's anonymous identity.
-- Scoped to only ever match when the caller's own profile is role='Guest',
-- so this can never broaden access for staff/admin sessions.
create policy "Guest read same-email service_requests" on public.service_requests
for select
using (
  requested_by_email is not null
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'Guest'
      and lower(p.email) = lower(service_requests.requested_by_email)
  )
);
