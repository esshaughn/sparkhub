-- Leave a group (owner, 2026-09-30): anyone may leave a group they're in, except its last owner, who has to make
-- someone else an owner first (or delete the group). Their events, replies and sign-ups stay; they can rejoin with
-- the group's link.
create function public.leave_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select role into v_role from memberships where group_id = p_group and user_id = auth.uid() for update;
  if v_role is null then
    raise exception 'you''re not in this group' using errcode = '22023';
  end if;
  if v_role = 'owner' and not exists (
    select 1 from memberships where group_id = p_group and role = 'owner' and user_id <> auth.uid()
  ) then
    raise exception 'make someone else an owner first' using errcode = '23514';
  end if;
  delete from memberships where group_id = p_group and user_id = auth.uid();
end $$;
revoke execute on function public.leave_group(uuid) from public, anon;
grant  execute on function public.leave_group(uuid) to authenticated;
