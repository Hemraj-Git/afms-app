-- Bug found live (2026-09-12): adding 2 new campuses produced codes CAM-0001
-- and CAM-0002 — colliding with 2 campuses that already existed. Root cause:
-- `addCampus()` (and the equivalent for buildings/categories/sub_categories/
-- departments) in AFMSContext.tsx derives the "next" sequential code from
-- whatever is in the client's already-loaded React state at the moment of
-- submission, not from the database. If that state is stale or incomplete
-- for any reason (slow/failed initial fetch, a session that's been open a
-- while, etc.), the count restarts and silently produces a duplicate code
-- instead of erroring. The same bug had already produced a duplicate
-- BLD-0001 in `buildings`. Both were manually corrected (renumbered to the
-- next real free code) before this migration.
--
-- This migration does not fix the client-side root cause (that would mean
-- moving code generation server-side, e.g. a real Postgres sequence or a
-- max()-query RPC — a larger change) — it adds a UNIQUE constraint on each
-- affected table's `code` column so a future collision fails loudly as a
-- rejected insert (visible, catchable) instead of silently duplicating data
-- again. `rooms`/`vendors`/business-document tables (assets, work_orders,
-- inspections, service_requests, inventory_items, reservations) already have
-- their own unique columns and were not affected.
--
-- Verified live: no existing duplicate `code` values remain in any of these
-- tables before this runs (campuses/buildings were just corrected above;
-- categories/sub_categories/departments had none).
--
-- Run this in the Supabase SQL Editor.

alter table public.campuses add constraint campuses_code_key unique (code);
alter table public.buildings add constraint buildings_code_key unique (code);
alter table public.categories add constraint categories_code_key unique (code);
alter table public.sub_categories add constraint sub_categories_code_key unique (code);
alter table public.departments add constraint departments_code_key unique (code);
