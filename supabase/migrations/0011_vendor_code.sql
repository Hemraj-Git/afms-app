-- Adds a real human-readable code (e.g. VND-0001) to vendors, mirroring
-- every other entity in this app (assets.asset_id, campuses.code, etc).
-- addVendor() already computed a VND-#### code but never stored or
-- returned it -- and that computation was itself broken (it scanned
-- vendor UUIDs against a VND-#### regex, which never matched, so it
-- would always have produced "VND-0001"). Fixed properly in AFMSContext.tsx.
--
-- Run this in the Supabase SQL Editor.

alter table public.vendors add column if not exists code text;

-- Backfill existing rows in creation order so codes stay sequential.
update public.vendors set code = 'VND-0001' where id = '3f48a33e-c580-4b94-9d57-91d39655bff3';
update public.vendors set code = 'VND-0002' where id = 'eb6dcb3d-e077-4b78-bec3-5dda9bbea85e';
update public.vendors set code = 'VND-0003' where id = '5d67b343-7e7e-4bf6-8212-4004c6c3af37';

alter table public.vendors add constraint vendors_code_key unique (code);
