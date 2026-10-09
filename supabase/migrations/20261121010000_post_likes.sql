-- Likes on Discussion posts (Design v8-15, Q42 1a): a heart on a comment, a reply or a lead's update. Anyone who can write in
-- the Discussion can like; you remove your own. No push for a like and no sorting by likes.
create table public.post_likes (
  target_id  uuid not null,                       -- an event_comments or plan_updates id
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (target_id, user_id)
);
create index post_likes_spark on public.post_likes (spark_id);

alter table public.post_likes enable row level security;
create policy "likes follow the event" on public.post_likes
  for select to authenticated using (public.can_see_spark(spark_id));
create policy "people in the discussion like" on public.post_likes
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_comment(spark_id)
              and (exists (select 1 from event_comments c where c.id = target_id and c.spark_id = post_likes.spark_id)
                   or exists (select 1 from plan_updates u where u.id = target_id and u.spark_id = post_likes.spark_id)));
create policy "unlike your own" on public.post_likes
  for delete to authenticated using (user_id = auth.uid());
revoke all on table public.post_likes from anon, authenticated;
grant select, insert, delete on table public.post_likes to authenticated;
