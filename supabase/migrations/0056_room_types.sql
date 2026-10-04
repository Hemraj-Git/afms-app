-- 0056: The room types list lives in the database.
--
-- "Manage Room Types" used to save the list in each Admin's own browser, so a
-- type added on one computer (e.g. "Simulator") was missing on every other.
-- Now one list for everyone: Admins add types, and remove ones no room uses.
-- Seeded from the built-in types plus every type a room already has.

create table if not exists public.room_types (
  name text primary key check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  created_by uuid
);

-- "Classroom" and "classroom" are the same type.
create unique index if not exists room_types_name_lower_key on public.room_types (lower(name));

insert into public.room_types (name)
select t from unnest(array[
  'Classroom', 'Simulator Block', 'Engine Room', 'Workshop', 'Office',
  'Common Area', 'Dining Area', 'Laboratory', 'Conference Hall'
]) as t
on conflict do nothing;

insert into public.room_types (name)
select distinct on (lower(btrim(r.type))) btrim(r.type)
from public.rooms r
where coalesce(btrim(r.type), '') <> ''
  and not exists (select 1 from public.room_types x where lower(x.name) = lower(btrim(r.type)))
order by lower(btrim(r.type)), btrim(r.type)
on conflict do nothing;

alter table public.room_types enable row level security;

drop policy if exists "Staff read room_types" on public.room_types;
create policy "Staff read room_types" on public.room_types
  for select to authenticated using ((select public.is_staff()));

drop policy if exists "Admin add room_types" on public.room_types;
create policy "Admin add room_types" on public.room_types
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists "Admin remove room_types" on public.room_types;
create policy "Admin remove room_types" on public.room_types
  for delete to authenticated using ((select public.is_admin()));

revoke update, truncate on public.room_types from anon, authenticated;
revoke all on public.room_types from anon;

-- Who added it; a type a room still uses can't be removed.
create or replace function public.guard_room_types()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.name := btrim(new.name);
    new.created_by := auth.uid();
    new.created_at := now();
    return new;
  end if;
  if exists (select 1 from public.rooms r where lower(btrim(r.type)) = lower(old.name)) then
    raise exception 'Rooms still use "%". Change those rooms'' type first.', old.name;
  end if;
  return old;
end;
$$;
revoke execute on function public.guard_room_types() from public, anon, authenticated;

drop trigger if exists trg_guard_room_types on public.room_types;
create trigger trg_guard_room_types
  before insert or delete on public.room_types
  for each row execute function public.guard_room_types();
