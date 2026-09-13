-- Enables real Supabase anonymous auth for the Guest role (Phase 2 of the
-- AFMS remediation plan). Verified live via Supabase MCP on 2026-09-12.
--
-- `public.handle_new_user()` is a SECURITY DEFINER trigger on `auth.users`
-- insert that auto-creates the matching `public.profiles` row (this already
-- runs correctly for staff sign-ups). For an anonymous sign-in
-- (`supabase.auth.signInAnonymously()`), Supabase Auth always sets
-- `auth.users.email` to NULL — but `profiles.email` is currently NOT NULL,
-- so the trigger's INSERT would fail with a not-null violation and the
-- entire anonymous sign-in would be rejected. This migration only relaxes
-- that constraint (no data loss, no rename) so guest sessions can be
-- created; the app fills in the guest's self-reported email afterward via
-- a normal authenticated UPDATE of their own row.
--
-- Run this in the Supabase SQL Editor.

alter table public.profiles alter column email drop not null;
