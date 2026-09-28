-- v6 Update 2: people who react to an event (❤️ 🙌 🎉, 🙏 thanks, "do it again") are taking part in it,
-- so their names show to everyone who can see that event, like the lead, RSVPs and helpers do.
-- Same policy as 20261003010000_profiles_private.sql, plus the reactions line.
drop policy if exists "profiles of people around you" on public.profiles;
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
    or exists (select 1 from public.reactions x where x.user_id = profiles.id and public.can_see_spark(x.spark_id))
  );
