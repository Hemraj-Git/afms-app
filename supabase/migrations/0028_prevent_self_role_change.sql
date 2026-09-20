-- Closes a privilege-escalation hole: the "Allow user to update own profile"
-- policy only checks auth.uid() = id, so any signed-in session -- including an
-- anonymous Guest -- could run `update profiles set role = 'Admin'` on its own
-- row. RLS can't restrict a single column on UPDATE, so guard it with a trigger.
--
-- auth.uid() is null for the service role and for direct SQL / migrations, so
-- those (trusted) callers are not blocked; an unauthenticated `anon` caller
-- can't reach any row through RLS in the first place.
create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an Admin can change a user''s role.';
  end if;
  return new;
end;
$$;

-- Only the trigger mechanism should ever run this; don't expose it as an RPC.
revoke execute on function public.prevent_self_role_change() from public, anon, authenticated;

create trigger trg_prevent_self_role_change
before update of role on public.profiles
for each row execute function public.prevent_self_role_change();
