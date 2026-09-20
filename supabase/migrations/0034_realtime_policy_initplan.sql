-- Realtime evaluates a table's row-level-security policies for every change and
-- every subscriber. A bare auth.uid() in a policy is re-evaluated per row;
-- wrapping it as (select auth.uid()) lets Postgres evaluate it once per query
-- (the "auth_rls_initplan" performance advisory). Same meaning, cheaper checks.
-- Also narrows the guest same-email policy from role `public` to `authenticated`
-- (it needs a signed-in user to match anything anyway).

-- inspections
alter policy "Assignee read own inspections" on public.inspections
  using (conducted_by_user_id = ((select auth.uid()))::text);
alter policy "Assignee update own inspections" on public.inspections
  using (conducted_by_user_id = ((select auth.uid()))::text)
  with check (conducted_by_user_id = ((select auth.uid()))::text);

-- notifications
alter policy "Read own notifications" on public.notifications
  using (user_id = (select auth.uid()));
alter policy "Mark own notifications read" on public.notifications
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- work_orders
alter policy "Assignee read own work_orders" on public.work_orders
  using (assigned_technician_id = ((select auth.uid()))::text);
alter policy "Assignee update own work_orders" on public.work_orders
  using (assigned_technician_id = ((select auth.uid()))::text)
  with check (assigned_technician_id = ((select auth.uid()))::text);

-- service_requests
alter policy "Requester read own service_requests" on public.service_requests
  using (requested_by_user_id = (select auth.uid()));
alter policy "Requester insert own service_requests" on public.service_requests
  with check (requested_by_user_id = (select auth.uid()));
alter policy "Requester update own service_requests" on public.service_requests
  using (requested_by_user_id = (select auth.uid()))
  with check (requested_by_user_id = (select auth.uid()));
alter policy "Linked work order assignee can read service_requests" on public.service_requests
  using (exists (
    select 1 from public.work_orders w
    where w.source_ref_id = service_requests.ticket_id
      and w.assigned_technician_id = ((select auth.uid()))::text
  ));
alter policy "Linked work order assignee can update service_requests" on public.service_requests
  using (exists (
    select 1 from public.work_orders w
    where w.source_ref_id = service_requests.ticket_id
      and w.assigned_technician_id = ((select auth.uid()))::text
  ))
  with check (exists (
    select 1 from public.work_orders w
    where w.source_ref_id = service_requests.ticket_id
      and w.assigned_technician_id = ((select auth.uid()))::text
  ));
alter policy "Guest read same-email service_requests" on public.service_requests
  to authenticated
  using (
    requested_by_email is not null
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'Guest'
        and lower(p.email) = lower(service_requests.requested_by_email)
    )
  );
