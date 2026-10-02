-- Feedback carries where and how it was sent (owner, 2026-10-02): the device and browser, the installed app or a
-- browser tab, screen size, app version, the screen and event, the last few taps and recent errors (feedback.context),
-- and an optional screenshot the person picks (feedback.shot). No location, nothing typed elsewhere.
--
-- Screenshots go in their own PRIVATE bucket, not the public spark-photos one: a screenshot can show other people's
-- names and events. Only the person who sent it and the owner (demo_admins) can read one; the owner's inbox shows
-- them through short-lived signed links.

alter table public.feedback
  add column context jsonb check (context is null or (jsonb_typeof(context) = 'object' and octet_length(context::text) <= 8000)),
  add column shot text check (shot is null or shot ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$');
grant insert (context, shot) on table public.feedback to authenticated;

-- Before saving: as before (name from the profile, 10 an hour), and a screenshot must be in the sender's own folder
create or replace function public.feedback_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from feedback where user_id = new.user_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too much feedback in an hour' using errcode = 'P0001';
  end if;
  if new.shot is not null and split_part(new.shot, '/', 1) <> new.user_id::text then
    raise exception 'that screenshot isn''t yours' using errcode = '42501';
  end if;
  select left(coalesce(nullif(p.name, ''), nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(u.email, '@', 1)), 40)
    into new.name from auth.users u left join profiles p on p.id = u.id where u.id = new.user_id;
  new.body := btrim(new.body);
  return new;
end $$;

-- The bucket: private, JPEGs up to 2 MB (the app shrinks screenshots to 1600px)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-shots', 'feedback-shots', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 20 screenshots in any 24 hours per account
create or replace function public.feedback_shot_ok()
returns boolean language sql stable security definer set search_path = public, storage as $$
  select public.is_signed_in()
     and (select count(*) from storage.objects o
           where o.bucket_id = 'feedback-shots'
             and o.name like auth.uid()::text || '/%'
             and o.created_at > now() - interval '24 hours') < 20;
$$;
revoke all on function public.feedback_shot_ok() from public, anon;
grant execute on function public.feedback_shot_ok() to authenticated;

drop policy if exists "upload a feedback screenshot to your own folder" on storage.objects;
create policy "upload a feedback screenshot to your own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'feedback-shots' and (storage.foldername(name))[1] = auth.uid()::text and public.feedback_shot_ok());

drop policy if exists "see your own feedback screenshots, or all of them as the owner" on storage.objects;
create policy "see your own feedback screenshots, or all of them as the owner" on storage.objects
  for select to authenticated
  using (bucket_id = 'feedback-shots'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or exists (select 1 from public.demo_admins d where d.user_id = auth.uid())));

-- An upload whose feedback then failed to save is removed again by the app
drop policy if exists "remove your own feedback screenshots" on storage.objects;
create policy "remove your own feedback screenshots" on storage.objects
  for delete to authenticated
  using (bucket_id = 'feedback-shots' and (storage.foldername(name))[1] = auth.uid()::text);
