-- Adds an optional "Last Serviced Date" anchor for legacy/backdated assets.
-- When set at creation time, this becomes the basis for the FIRST auto-
-- generated PM work order's and inspection's due date instead of
-- installation_date (see AFMSContext.tsx addAsset/addBulkAssets), so a
-- legacy asset entered today doesn't show its first PM/inspection as
-- already overdue. installation_date itself is unaffected and still used
-- for warranty/age tracking.
--
-- Run this in the Supabase SQL Editor.

alter table public.assets add column if not exists last_serviced_date date;
