-- A department's head is one of the registered users. The Departments form had a
-- "Head of Department" box, but the table had nowhere to keep it, so whatever was
-- typed there was lost on reload. Store the person, not a typed name: if their
-- account is ever deleted the department simply has no head again.
--
-- Additive and nullable, so the code currently in production (which never reads
-- or writes it) keeps working unchanged.
alter table public.departments
  add column if not exists head_user_id uuid references public.profiles(id) on delete set null;

comment on column public.departments.head_user_id is
  'The registered user who heads this department (profiles.id); null if none or their account was removed.';
