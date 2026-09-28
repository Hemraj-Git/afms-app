-- 0045: A new account can no longer choose its own role.
--
-- handle_new_user() copied `role` from raw_user_meta_data, which the person
-- signing up controls. Anyone with the public anon key could call
--   supabase.auth.signInAnonymously({ options: { data: { role: 'Admin' } } })
-- (or signUp with the same metadata) and get an Admin profile. Confirmed in a
-- rolled-back test on 28 Sep 2026; no existing account was affected (every
-- anonymous account is a Guest).
--
-- Now:
--   - anonymous (guest) sign-ins are always 'Guest';
--   - a role in raw_app_meta_data is trusted: only the service role can set it
--     (server code, admin scripts);
--   - a self-requested staff role is still honoured for Faculty / Technician /
--     Housekeeping, because the production app's staff invites still pass the
--     role that way; a self-requested 'Admin' becomes 'Faculty' (an Admin can
--     promote it in Users). The invite action now also sets the role itself.
--   - anything else: 'Faculty', as before.
-- Once the new invite code is live and public sign-up is switched off in the
-- dashboard, the user-metadata branch can be removed entirely.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_app_role text := new.raw_app_meta_data->>'role';
  v_asked text := new.raw_user_meta_data->>'role';
  v_role text;
begin
  if coalesce(new.is_anonymous, false) then
    v_role := 'Guest';
  elsif v_app_role in ('Admin', 'Faculty', 'Technician', 'Housekeeping', 'Guest') then
    v_role := v_app_role;
  elsif v_asked in ('Faculty', 'Technician', 'Housekeeping', 'Guest') then
    v_role := v_asked;
  else
    v_role := 'Faculty';
  end if;

  insert into public.profiles (id, email, full_name, role, department, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Staff Member'),
    v_role,
    coalesce(new.raw_user_meta_data->>'department', 'Facility Operations'),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
