-- Realtime: emit change events for the four tables the app keeps live. Until
-- now the supabase_realtime publication was empty, so nothing could subscribe.
--
-- Subscriptions follow row-level security: a client only receives events for
-- rows it is allowed to read (a technician for their own work orders, a guest
-- for their own tickets, and so on). Additive -- nothing subscribes until the
-- app code that uses it ships.
alter publication supabase_realtime add table
  public.work_orders,
  public.service_requests,
  public.inspections,
  public.notifications;
