-- Any signed-in session -- including an anonymous Guest -- could read every
-- profile (staff names, emails, phone numbers) and every room access log,
-- because both SELECT policies were `using (true)`. Guests only ever need
-- their own rows; staff (every non-Guest role) keep full read.
--
-- SECURITY DEFINER so the role lookup bypasses RLS: a policy that queried
-- `profiles` under RLS from inside a `profiles` policy would risk recursion.
-- It only ever returns the caller's own role. `authenticated` must keep
-- EXECUTE because policy expressions run with the querying role's privileges.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke execute on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

drop policy "Allow authenticated users to read profiles" on public.profiles;
create policy "Staff read all profiles, guests read own" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.current_user_role()) <> 'Guest'
  );

drop policy "Authenticated read room_access_logs" on public.room_access_logs;
create policy "Staff read all access logs, guests read own" on public.room_access_logs
  for select to authenticated
  using (
    user_id = ((select auth.uid()))::text
    or (select public.current_user_role()) <> 'Guest'
  );
