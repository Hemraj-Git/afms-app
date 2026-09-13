-- Adds a nullable FK so a document can be linked to an inventory (spare
-- part) item, mirroring the existing documents.asset_id column (which is
-- ON DELETE CASCADE, confirmed live -- matched here for consistency).
-- Needed so documents attached to a spare part actually persist, and so
-- convertInventoryToAsset() can re-point a document to the newly
-- deployed asset instead of leaving it orphaned on the source item.
--
-- Run this in the Supabase SQL Editor.

-- inventory_items.id (like assets.id and rooms.id in this schema) is
-- text, not a native uuid column, even though the app populates it with
-- a client-generated UUID string -- matched here, confirmed live.
alter table public.documents add column if not exists inventory_item_id text
  references public.inventory_items(id) on delete cascade;
