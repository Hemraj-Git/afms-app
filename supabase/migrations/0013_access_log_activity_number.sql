-- Adds a real human-readable activity number (e.g. AL-A0001) to
-- room_access_logs, mirroring every other entity in this app
-- (assets.asset_id, rooms.room_number, vendors.code, etc). Previously the
-- Access Log tab showed the raw UUID `id` to users.
--
-- Run this in the Supabase SQL Editor.

alter table public.room_access_logs add column if not exists activity_number text;

-- Backfill existing rows in check-in order so numbers stay sequential.
update public.room_access_logs set activity_number = 'AL-A0001' where id = '7eae7a81-8f02-4cd0-b3ae-d459aa72ada1';
update public.room_access_logs set activity_number = 'AL-A0002' where id = '0f681020-265b-4612-9758-6bf5b458502f';
update public.room_access_logs set activity_number = 'AL-A0003' where id = '25661381-2a3d-4a83-afc7-28d0b6c4a24b';

alter table public.room_access_logs add constraint room_access_logs_activity_number_key unique (activity_number);
