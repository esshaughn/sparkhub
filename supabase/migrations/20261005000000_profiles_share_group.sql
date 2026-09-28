-- The "share a group" line of the profiles policy never matched anyone but yourself: it joined
-- memberships to itself, and memberships RLS only shows you your own rows, so the other
-- person's membership was invisible. Two members of the same group who hadn't both taken part
-- in a visible idea couldn't see each other's names or avatars.
-- shares_group() looks at both sides as the definer and returns only yes/no.
create function public.shares_group(p_other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships a join memberships b on b.group_id = a.group_id
                  where a.user_id = auth.uid() and b.user_id = p_other);
$$;
revoke execute on function public.shares_group(uuid) from public, anon;
grant execute on function public.shares_group(uuid) to authenticated;

-- Same policy as 20261004010000_reactions_profiles.sql, with the group line going through shares_group().
drop policy if exists "profiles of people around you" on public.profiles;
create policy "profiles of people around you" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.shares_group(profiles.id)
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
