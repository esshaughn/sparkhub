-- V5 phase 2: the Groups page shows "N members" on each of your groups.
-- member_count() is admins-only; this returns just the sizes of the groups you're in.

create function public.my_group_sizes()
returns table (group_id uuid, members int) language sql stable security definer set search_path = public as $$
  select m.group_id, (select count(*)::int from memberships x where x.group_id = m.group_id)
    from memberships m where m.user_id = auth.uid();
$$;

revoke execute on function public.my_group_sizes() from public, anon;
grant  execute on function public.my_group_sizes() to authenticated;
