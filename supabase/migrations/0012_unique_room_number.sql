-- Rooms didn't have this constraint even though room_number (ROM-####)
-- is now used as a routing key for the Room detail page, not just a
-- display label -- a collision would make two rooms indistinguishable
-- by URL. Live data confirmed clean (4 rows, ROM-0001..0004, no dupes)
-- before adding this.
--
-- Run this in the Supabase SQL Editor.

alter table public.rooms add constraint rooms_room_number_key unique (room_number);
