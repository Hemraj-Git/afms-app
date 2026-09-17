-- Corrects 0015_room_self_service_checkin: rooms.id / room_access_logs.id /
-- room_id / user_id are `text` columns in this schema, not native `uuid` --
-- the initial version's uuid-typed parameters failed with "operator does
-- not exist: text = uuid" the first time it was actually exercised.
-- (0015 itself has since been edited in place to the corrected, text-typed
-- version below -- this migration exists so a database that already
-- applied the original uuid-typed 0015 can drop those stale overloads.)

drop function if exists public.room_check_in(uuid, uuid, text, text, text, text, text, text, bigint);
drop function if exists public.room_check_out(uuid, text);
