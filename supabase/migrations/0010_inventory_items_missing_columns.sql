-- Found while implementing the inventory-deploy data-loss fix (2026-09-13):
-- inventory_items is missing most of the columns the app's InventoryItem
-- type actually needs. Verified live: the real table only has
-- id, inventory_number, name, sub_category_id, manufacturer, model_number,
-- part_number, quantity, min_stock_level, unit_cost, storage_location,
-- vendor_id, created_at. serial_number, warranty_till, purchase_date,
-- dynamic_specifications, image_url, notes, and room_id don't exist at
-- all — so those fields could never have been saved, independent of any
-- app-code bug. (unit_cost/min_stock_level already exist and map to the
-- app's unitPrice/minStockThreshold — no new column needed for those, the
-- app code just wasn't reading/writing them, fixed separately in
-- AFMSContext.tsx.)
--
-- Run this in the Supabase SQL Editor.

alter table public.inventory_items
  add column if not exists serial_number text,
  add column if not exists warranty_till text,
  add column if not exists purchase_date text,
  add column if not exists dynamic_specifications jsonb default '{}'::jsonb,
  add column if not exists image_url text,
  add column if not exists notes text,
  add column if not exists room_id text references public.rooms(id) on delete set null;
