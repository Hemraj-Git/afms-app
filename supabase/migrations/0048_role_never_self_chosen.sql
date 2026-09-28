-- 0048: a new account can never choose its own role. Finishes what 0045 began.
--
-- 0045 stopped a self-requested 'Admin', but still honoured a self-requested
-- Faculty / Technician / Housekeeping, because the invite code deployed in
-- production passes the role in user metadata and there was no way to tell an
-- invite from a self-registration. With public sign-up enabled on the project,
-- anyone with the public key could still register themselves as a Technician
-- and read the whole staff directory and asset register.
--
-- TWO THINGS ARE NOT USABLE for telling them apart, both verified on this
-- project rather than assumed -- do not "simplify" this migration by reaching
-- for either of them:
--
--   * raw_app_meta_data.role is NOT visible to an insert trigger for accounts
--     made through the Auth admin API. inviteUserByEmail() has no app_metadata
--     option at all, and createUser() applies it AFTER the auth.users insert.
--     (The branch below therefore only ever fires for direct service-role SQL
--     inserts, which is a legitimate admin path and why it is kept.)
--   * invited_at is NOT set in the insert either. Measured on the three real
--     invites in this project, GoTrue stamps it 17-47 ms LATER, in a separate
--     update.
--
-- That separate update is the opening. GoTrue stamps invited_at only for a
-- genuine invite, which requires the service key, so the stamp is a signal no
-- untrusted caller can produce. Hence two triggers:
--
--   1. on insert  -> grant nothing from user-supplied metadata. Anonymous
--                    sign-ins are Guests; everyone else starts as Faculty.
--   2. on the invited_at stamp -> apply the role the inviting Admin chose.
--
-- The result: a self-registration can only ever become a plain Faculty account,
-- while invites keep working from BOTH the currently deployed production code
-- and the newer code that also sets the role explicitly. Nothing has to be
-- deployed first, and this also repairs the 0045 side effect where inviting a
-- new Admin produced a Faculty.
--
-- The fallback stays 'Faculty', never 'Guest': updateUserProfile() refuses to
-- give a staff role to a Guest, so a defaulted-to-Guest invitee would be stuck.

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
    -- Guest visitors sign in anonymously. Always a Guest, whatever they ask for.
    v_role := 'Guest';
  elsif v_app_role in ('Admin', 'Faculty', 'Technician', 'Housekeeping', 'Guest') then
    -- Only a direct service-role insert can put a role here (see the note above).
    v_role := v_app_role;
  else
    -- Includes every self-registration: no role of their choosing.
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

-- Fires the moment GoTrue marks the account as invited, ~20 ms after it was
-- created. `old.invited_at is null` restricts this to that first stamp, so a
-- later re-invite can never undo a role an Admin has since changed by hand.
create or replace function public.apply_invited_role()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_asked text := new.raw_user_meta_data->>'role';
begin
  if old.invited_at is null
     and new.invited_at is not null
     and v_asked in ('Admin', 'Faculty', 'Technician', 'Housekeeping') then
    update public.profiles set role = v_asked where id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_auth_user_invited on auth.users;
create trigger on_auth_user_invited
  after update of invited_at on auth.users
  for each row execute function public.apply_invited_role();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.apply_invited_role() from public, anon, authenticated;
