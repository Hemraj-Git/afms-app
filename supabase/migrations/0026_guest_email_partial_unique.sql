-- Guests are ephemeral, repeatable identities: every guest login creates a
-- fresh anonymous auth.users + profiles row (there is no way to "resume" an
-- old anonymous identity), so the same visitor typing the same email on a
-- later visit must be allowed to reuse that email. Staff/admin emails must
-- stay globally unique (they're real sign-in credentials). Scope the unique
-- constraint to non-Guest rows only.
alter table public.profiles drop constraint profiles_email_key;
create unique index profiles_email_key on public.profiles (email) where role <> 'Guest';
