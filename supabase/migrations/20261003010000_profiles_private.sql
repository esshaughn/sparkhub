-- Profiles (name, avatar, place, bio) were readable by every session, including anonymous
-- visitors. Now you see your own, the people you share a group with, and the people who take
-- part in an idea you can see (its lead, and anyone interested, replying, helping or organizing),
-- so a link visitor still sees the names on that one idea.
drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles of people around you" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (select 1 from public.memberships a join public.memberships b on b.group_id = a.group_id
                where a.user_id = auth.uid() and b.user_id = profiles.id)
    or exists (select 1 from public.sparks s where s.lead_id = profiles.id
                 and public.can_see_spark_row(s.id, s.group_id, s.lead_id, s.visibility))
    or exists (select 1 from public.interests i where i.user_id = profiles.id and public.can_see_spark(i.spark_id))
    or exists (select 1 from public.offers o where o.user_id = profiles.id and public.can_see_spark(o.spark_id))
    or exists (select 1 from public.rsvps r where r.user_id = profiles.id and public.can_see_spark(r.spark_id))
    or exists (select 1 from public.organizers g where g.user_id = profiles.id and public.can_see_spark(g.spark_id))
    or exists (select 1 from public.signup_claims c join public.signup_items t on t.id = c.item_id
                where c.user_id = profiles.id and public.can_see_spark(t.spark_id))
  );
