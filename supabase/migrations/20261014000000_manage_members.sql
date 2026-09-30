-- Members sheet (owner, 2026-09-30). A group can now have up to five owners (was two).
-- each row opens a short profile with the person's email and when they
-- joined, and the actions the viewer may take. Only the group's admins and owners see the list (as before).
-- Removing: admins remove members; owners also remove admins and the other owner. Nobody removes themselves
-- here. Their events, replies and sign-ups stay; they can rejoin with the group's link.
drop function public.group_members(uuid);
create function public.group_members(p_group uuid)
returns table (user_id uuid, name text, avatar_path text, role text, email text, joined_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, coalesce(nullif(p.name, ''), 'No name yet'), p.avatar_path, m.role, u.email::text, m.joined_at
    from memberships m left join profiles p on p.id = m.user_id left join auth.users u on u.id = m.user_id
   where m.group_id = p_group and public.is_admin(p_group)
   order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, lower(coalesce(p.name, ''));
$$;
revoke execute on function public.group_members(uuid) from public, anon;
grant  execute on function public.group_members(uuid) to authenticated;

create function public.remove_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if not public.is_admin(p_group) then
    raise exception 'only the group''s admins can remove people' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'you can''t remove yourself' using errcode = '22023';
  end if;
  select role into v_role from memberships where group_id = p_group and user_id = p_user for update;
  if v_role is null then
    raise exception 'they''re not in this group' using errcode = '22023';
  end if;
  if v_role <> 'member' and not public.is_owner(p_group) then
    raise exception 'only owners can remove admins' using errcode = '42501';
  end if;
  delete from memberships where group_id = p_group and user_id = p_user;
end $$;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
grant  execute on function public.remove_member(uuid, uuid) to authenticated;

-- Up to five owners per group
create or replace function public.check_owner_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.role = 'owner' and (
    select count(*) from memberships m
     where m.group_id = new.group_id and m.role = 'owner' and m.user_id <> new.user_id
  ) >= 5 then
    raise exception 'a group can have at most five owners' using errcode = '23514';
  end if;
  return new;
end $$;
