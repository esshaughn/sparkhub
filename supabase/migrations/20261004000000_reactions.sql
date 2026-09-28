-- v6 Update 2: reactions on past events (the group's Past scrapbook and the It happened page).
-- One row per person, event and kind: ❤️ 🙌 🎉, 🙏 thanks (public), and "Let's do it again!" votes.
create table public.reactions (
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind       text not null check (kind in ('heart', 'praise', 'party', 'thanks', 'again')),
  created_at timestamptz not null default now(),
  primary key (spark_id, user_id, kind)
);
alter table public.reactions enable row level security;
-- Everyone who can see the event sees its reactions (counts and who thanked)
create policy "reactions follow the idea" on public.reactions
  for select to authenticated using (public.can_see_spark(spark_id));
-- Signed-in people (not anonymous sessions) react as themselves, only on plans they can see
create policy "add your reaction" on public.reactions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_signed_in() and public.can_see_spark(spark_id)
              and exists (select 1 from public.sparks s where s.id = spark_id and s.planned));
create policy "take your reaction back" on public.reactions
  for delete to authenticated using (user_id = auth.uid());
revoke all on table public.reactions from anon;
grant select, insert, delete on table public.reactions to authenticated;
