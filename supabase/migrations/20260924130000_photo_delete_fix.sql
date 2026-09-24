-- Storage's remove() looks files up before deleting them, so it needs a SELECT
-- policy as well as DELETE. Without this, deleting an idea left its photos behind.
-- Scoped to your own folder, the same as upload/delete. The bucket is public, so
-- anyone can still view photos by URL; this only governs the storage API.

create policy "see photos in your own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'spark-photos' and (storage.foldername(name))[1] = auth.uid()::text);
