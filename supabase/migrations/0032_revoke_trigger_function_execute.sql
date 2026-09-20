-- Three SECURITY DEFINER functions exist only to be run by triggers (they read
-- NEW/OLD and mint numbers), but each was also callable by anyone through
-- /rest/v1/rpc/<name> -- including the unauthenticated `anon` role. Called
-- directly they have no NEW/OLD to work with, so they do nothing useful, but
-- they should not be reachable at all.
--
-- Postgres checks EXECUTE on a trigger function when the trigger is created,
-- not each time it fires, so revoking it does not stop the triggers working.
revoke execute on function public.mint_work_order_number() from public, anon, authenticated;
revoke execute on function public.set_inspection_number() from public, anon, authenticated;
revoke execute on function public.set_service_request_ticket_id() from public, anon, authenticated;
