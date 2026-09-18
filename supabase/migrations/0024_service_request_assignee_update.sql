-- service_requests' only read/write policies are "Admin all" and
-- "Requester [read/update] own" (requested_by_user_id = auth.uid()) -- so
-- the technician who actually executes the work order raised from a
-- ticket has no visibility into or write access to that ticket at all
-- unless they also happen to be its original requester. This silently
-- blocks updateWorkOrderStatus's auto-resolve-the-ticket cascade (and the
-- earlier "In Progress" / work order number handshake) for the normal
-- case: someone else raised the ticket, a Technician resolves it.
--
-- Fix: extend trust the same way work_orders/inspections already do
-- ("Assignee [read/update] own X") -- once you're the assigned technician
-- on a work order linked to this ticket, you can read and update it. A
-- broad per-row grant (not narrowed to specific columns) matches that
-- existing pattern rather than a single-purpose RPC, since
-- updateServiceRequestStatus/updateServiceRequest already legitimately
-- touch a wide field set (status, work order number/id/type, priority,
-- etc.) across several call sites.
--
-- Both a SELECT and an UPDATE policy are required here -- confirmed live
-- that an UPDATE policy alone is not sufficient: Postgres RLS requires the
-- row to also be visible under a SELECT policy for an UPDATE to actually
-- affect it (verified: the same UPDATE affected 0 rows with only the
-- UPDATE policy in place, then 1 row once the matching SELECT policy was
-- added). This also happens to be independently correct/needed anyway --
-- the technician needs to be able to read the ticket's details while
-- working on it, not just silently patch its status.

create policy "Linked work order assignee can read service_requests"
  on public.service_requests for select to authenticated
  using (exists (
    select 1 from public.work_orders w
    where w.source_ref_id = service_requests.ticket_id
      and w.assigned_technician_id = (auth.uid())::text
  ));

create policy "Linked work order assignee can update service_requests"
  on public.service_requests for update to authenticated
  using (exists (
    select 1 from public.work_orders w
    where w.source_ref_id = service_requests.ticket_id
      and w.assigned_technician_id = (auth.uid())::text
  ))
  with check (exists (
    select 1 from public.work_orders w
    where w.source_ref_id = service_requests.ticket_id
      and w.assigned_technician_id = (auth.uid())::text
  ));
