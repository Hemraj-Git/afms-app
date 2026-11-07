-- 0057: An account gets the department it was given, or none.
--
-- handle_new_user() filled in "Facility Operations" for any account created
-- without a department (e.g. one invited from the Supabase dashboard), so the
-- Users page showed a department nobody chose. It now leaves the department
-- empty; the app shows "—". Invites from the app and guest sign-ins pass their
-- own department, unchanged.
--
-- Our support logins (@assetnxg.app) were created from the dashboard and got
-- that made-up value; it is cleared. Nobody else's department is touched.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_app_role text := new.raw_app_meta_data->>'role';
  v_role     text;
begin
  if coalesce(new.is_anonymous, false) then
    v_role := 'Guest';
  elsif v_app_role in ('Admin', 'Faculty', 'Technician', 'Housekeeping', 'Guest') then
    v_role := v_app_role;
  else
    v_role := 'Guest';
  end if;

  insert into public.profiles (id, email, full_name, role, department, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Staff Member'),
    v_role,
    nullif(btrim(coalesce(new.raw_user_meta_data->>'department', '')), ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$function$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

update public.profiles
set department = null
where department = 'Facility Operations'
  and email ilike '%@assetnxg.app';
