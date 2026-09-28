-- 0047: remove the three anonymous WRITE policies (PENDING-WORK 3.1).
--
-- These let anyone holding the public anon key insert fake room-access logs or
-- spam service requests straight into the database, without signing in at all.
--
-- Nothing in the app uses them:
--   * Check-in / check-out never touch room_access_logs directly. The only
--     writes are supabase.rpc('room_check_in' | 'room_check_out')
--     (src/context/AFMSContext.tsx); there is no .from('room_access_logs')
--     .insert/.update anywhere in src/. Those two functions are granted to
--     `authenticated` and revoked from `anon` (0015), so `anon` could never
--     have called them.
--   * Guest tickets are inserted through the authenticated client with
--     requested_by_user_id set (src/lib/queries/serviceRequests.ts), which
--     matches "Requester insert own service_requests" (0004).
--   * A guest signs in with Supabase ANONYMOUS AUTH, which is the
--     `authenticated` Postgres role -- not `anon`. So guests keep working.
--
-- Reviewed 21 Sep: 24 h of API traffic showed zero anonymous writes.
-- Verified again before applying with a rolled-back test: as `anon` both
-- inserts are refused, while a signed-in Guest can still check in, raise a
-- ticket and check out.
--
-- To restore (the prior definitions, for the record):
--   create policy "Public insert room log for guest checkin"
--     on public.room_access_logs for insert to anon with check (true);
--   create policy "Public update room log for guest checkout"
--     on public.room_access_logs for update to anon
--     using (check_out_time is null) with check (true);
--   create policy "Public insert service request from QR"
--     on public.service_requests for insert to anon with check (true);

drop policy if exists "Public insert room log for guest checkin"  on public.room_access_logs;
drop policy if exists "Public update room log for guest checkout" on public.room_access_logs;
drop policy if exists "Public insert service request from QR"     on public.service_requests;

-- Deliberately KEPT: the two anonymous READ policies, which a printed QR code
-- depends on before the scanner has signed in.
--   "Public read rooms for QR scan"  on public.rooms
--   "Public read assets for QR scan" on public.assets
