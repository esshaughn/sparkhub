-- Public member count for an invite code, for the pitch page's invite card
-- (demo.wereallneighbors.org). Same lookup and code check as group_preview:
-- anyone holding the code can see how many people are in the group, never who.
create or replace function public.group_member_count(p_code text)
returns int
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from memberships m where m.group_id = g.id)
    from groups g where g.code = upper(p_code) and char_length(p_code) = 6;
$$;
revoke execute on function public.group_member_count(text) from public;
grant execute on function public.group_member_count(text) to anon, authenticated;
