-- Fixes a large silently-dropped field set on work_orders and inspections.
-- The WorkOrder TypeScript type already declares startPhotoUrl,
-- partsReplaced, and the full vendor-execution field set (vendorId,
-- vendorTicketNo, vendorTechName, vendorTechPhone, vendorServiceDate,
-- vendorJobSheetUrl, vendorRemarks, vendorCost), and the mobile app's
-- execution form already collects all of them -- but none of these
-- columns exist on work_orders, so nothing typed into them has ever
-- survived a page reload. Likewise inspections has no column at all for
-- the inspection proof photo or the per-checkpoint required photos the
-- mobile app already captures and validates as required.

alter table public.work_orders
  add column if not exists start_photo_url text,
  add column if not exists parts_replaced jsonb,
  add column if not exists vendor_id text,
  add column if not exists vendor_ticket_no text,
  add column if not exists vendor_tech_name text,
  add column if not exists vendor_tech_phone text,
  add column if not exists vendor_service_date text,
  add column if not exists vendor_job_sheet_url text,
  add column if not exists vendor_remarks text,
  add column if not exists vendor_cost numeric;

-- item_photos: per-checklist-item required photos, keyed by checklist item
-- id -> URL. Kept separate from checklist_responses (rather than folding
-- photos into that JSON) because the responses actually stored there at
-- runtime are plain Record<string, 'Pass'|'Fail'> strings, not the
-- {value, remarks, photoUrl} object shape the Inspection type
-- aspirationally declares -- changing that shape now would risk breaking
-- every existing place that reads a response as a bare string.
alter table public.inspections
  add column if not exists photo_url text,
  add column if not exists item_photos jsonb;

-- Two storage buckets (work-order-evidence, facility-documents) already
-- exist in this project but have never had any access policy, so uploads
-- to them are denied by default RLS even once the client code targets
-- them. Mirrors the existing open "Public access to X" policies already
-- working on asset-images/documents.
create policy "Public access to work-order-evidence"
  on storage.objects for all to public
  using (bucket_id = 'work-order-evidence')
  with check (bucket_id = 'work-order-evidence');

create policy "Public access to facility-documents"
  on storage.objects for all to public
  using (bucket_id = 'facility-documents')
  with check (bucket_id = 'facility-documents');
