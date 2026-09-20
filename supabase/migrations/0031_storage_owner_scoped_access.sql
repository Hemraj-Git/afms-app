-- Follow-up to 0030. The app (and the version currently deployed) uploads with
-- `upsert: true`, which Storage runs as INSERT ... ON CONFLICT DO UPDATE ...
-- RETURNING, and that needs SELECT and UPDATE policies to pass for the row --
-- with insert-only access every upload was rejected and fell back to embedding
-- the file in the database. Grant those two, but only on objects the signed-in
-- user uploaded themselves (owner_id), so nobody can list, read through the API
-- or overwrite someone else's files. There is still no DELETE policy for
-- anyone. Reading a file by its public URL is unaffected.
create policy "Uploaders can read their own uploads" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('asset-images', 'documents', 'facility-documents', 'work-order-evidence')
    and owner_id = (select auth.uid())::text
  );

create policy "Uploaders can replace their own uploads" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('asset-images', 'documents', 'facility-documents', 'work-order-evidence')
    and owner_id = (select auth.uid())::text
  )
  with check (
    bucket_id in ('asset-images', 'documents', 'facility-documents', 'work-order-evidence')
    and owner_id = (select auth.uid())::text
  );
