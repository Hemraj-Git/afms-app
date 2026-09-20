-- The four storage buckets each had a `FOR ALL TO public` policy, so anyone
-- holding the public anon key -- no login -- could list every file, upload
-- anything, and overwrite or delete existing evidence photos and documents.
--
-- The app only ever uploads (always from a signed-in session, guests included,
-- since anonymous sign-in is the `authenticated` role) and reads files through
-- their public URLs. Public buckets serve public URLs without any policy, so
-- reading keeps working. Only the upload permission is kept, and only for
-- signed-in users. Nothing in the app lists, updates or deletes objects.
drop policy "Public access to asset-images" on storage.objects;
drop policy "Public access to documents" on storage.objects;
drop policy "Public access to facility-documents" on storage.objects;
drop policy "Public access to work-order-evidence" on storage.objects;

create policy "Signed-in users can upload to app buckets" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('asset-images', 'documents', 'facility-documents', 'work-order-evidence'));

-- Server-side size and type limits (the browser checks are only a convenience).
update storage.buckets
   set file_size_limit = 5242880,  -- 5 MB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'asset-images';

update storage.buckets
   set file_size_limit = 26214400, -- 25 MB
       allowed_mime_types = array[
         'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
       ]
 where id = 'documents';

update storage.buckets
   set file_size_limit = 26214400, -- 25 MB
       allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
 where id = 'facility-documents';

update storage.buckets
   set file_size_limit = 15728640, -- 15 MB, so high-resolution phone photos still upload
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
 where id = 'work-order-evidence';
