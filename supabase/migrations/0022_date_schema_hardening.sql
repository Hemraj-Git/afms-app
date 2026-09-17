-- Tightens date/time column typing that was previously just `text`:
-- nothing currently writes a non-ISO value into these, but nothing in the
-- schema stopped it either. Verified live before writing this migration:
-- inventory_items.purchase_date/warranty_till hold only ISO YYYY-MM-DD
-- values, and service_requests.dismissed_at currently has zero rows -- both
-- casts below are safe against the live data.

alter table public.inventory_items
  alter column purchase_date type date using purchase_date::date,
  alter column warranty_till type date using warranty_till::date;

-- dismissed_at was text (date-only), inconsistent with its sibling
-- timestamp columns on the same table (sla_due_date, resolved_at,
-- created_at are all timestamptz) and dropped time-of-day.
alter table public.service_requests
  alter column dismissed_at type timestamptz using dismissed_at::timestamptz;

-- timezone('utc', now()) only produces the right instant because
-- Supabase's session timezone happens to already be UTC -- every other
-- created_at/updated_at default in this schema is plain now(), which is
-- timezone-independent by construction since timestamptz stores an
-- absolute instant. This was the one inconsistent outlier.
alter table public.notifications alter column created_at set default now();
