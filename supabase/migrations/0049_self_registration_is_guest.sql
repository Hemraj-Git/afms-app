-- 0049: a self-registration becomes a Guest, not Faculty.
--
-- Why this exists: switching off "Allow new users to sign up" in the Supabase
-- dashboard (29 Sep) also blocked ANONYMOUS sign-ins -- every guest visit
-- creates a new anonymous account, and Supabase counts that as a sign-up -- so
-- guest access and QR check-in stopped working ("Signups not allowed for this
-- instance"). Sign-up therefore has to stay ON, which means anyone can still
-- create an email account for themselves through the public API.
--
-- After 0048 such an account became 'Faculty', and Faculty can read every staff
-- member's name, email and phone. As a 'Guest' it can see only what any visitor
-- who scans a room QR code already sees: guests read only their own profile row
-- ("Staff read all profiles, guests read own"). So self-registration is harmless.
--
-- Invites are unaffected: apply_invited_role() (0048) sets the invited role when
-- Supabase stamps invited_at, and inviteUser() also sets it explicitly.
--
-- Trade-off: an account created by hand in the Supabase dashboard ("Add user")
-- also starts as a Guest, and the app will not promote a Guest to staff
-- (updateUserProfile). Add staff through the app's invite instead.
--
-- Only the final fallback changes from 0048.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_app_role text := new.raw_app_meta_data->>'role';
  v_role     text;
begin
  if coalesce(new.is_anonymous, false) then
    v_role := 'Guest';
  elsif v_app_role in ('Admin', 'Faculty', 'Technician', 'Housekeeping', 'Guest') then
    -- Only a direct service-role insert can put a role here (see 0048).
    v_role := v_app_role;
  else
    -- Every self-registration, and every invite until Supabase stamps it (a
    -- moment later, when apply_invited_role() sets the real role).
    v_role := 'Guest';
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
