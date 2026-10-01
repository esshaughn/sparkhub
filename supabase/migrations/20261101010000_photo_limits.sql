-- Photo uploads: a rolling daily allowance per person, and a smaller size limit.
-- Guests (anonymous sessions) still upload: an album photo after leaving their name and number, and a
-- profile photo. So uploads stay open to them, with a smaller allowance than signed-in accounts:
--   signed in: 50 photos in any 24 hours; anonymous: 10.
-- The app shrinks every photo to a ≤1200px JPEG (about 150–400 KB) before upload, so 2 MB is plenty.

update storage.buckets set file_size_limit = 2097152 where id = 'spark-photos';

-- How many photos the caller has put in their folder in the last 24 hours, against their allowance.
-- security definer: the storage policy's own subquery would otherwise run under the caller's RLS.
create or replace function public.photo_upload_ok()
returns boolean language sql stable security definer set search_path = public, storage as $$
  select auth.uid() is not null
     and (select count(*) from storage.objects o
           where o.bucket_id = 'spark-photos'
             and o.name like auth.uid()::text || '/%'
             and o.created_at > now() - interval '24 hours')
         < case when public.is_signed_in() then 50 else 10 end;
$$;
revoke all on function public.photo_upload_ok() from public, anon;
grant execute on function public.photo_upload_ok() to authenticated;

drop policy if exists "upload photos to your own folder" on storage.objects;
create policy "upload photos to your own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'spark-photos'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.photo_upload_ok());
