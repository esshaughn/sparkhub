-- Owners: a group's super-admins. An owner can do everything an admin can,
-- and decides who is an admin. At most two owners per group; a group always
-- keeps at least one once it has one. Whoever starts a group is its owner.

alter table public.memberships drop constraint memberships_role_check;
alter table public.memberships add constraint memberships_role_check check (role in ('owner', 'admin', 'member'));

-- Admin powers include owners
create or replace function public.is_admin(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where group_id = p_group and user_id = auth.uid() and role in ('admin', 'owner'));
$$;

create function public.is_owner(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where group_id = p_group and user_id = auth.uid() and role = 'owner');
$$;

-- Never more than two owners, however the row gets written
create function public.check_owner_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.role = 'owner' and (
    select count(*) from memberships m
     where m.group_id = new.group_id and m.role = 'owner' and m.user_id <> new.user_id
  ) >= 2 then
    raise exception 'a group can have at most two owners' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger memberships_owner_limit
  before insert or update of role on public.memberships
  for each row execute function public.check_owner_limit();

-- Starting a group makes you its owner
create or replace function public.create_group(p_name text)
returns table (id uuid, code text) language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text; v_name text := left(trim(regexp_replace(p_name, '\s+', ' ', 'g')), 40);
begin
  if not public.is_signed_in() then raise exception 'sign in to start a group'; end if;
  if char_length(v_name) < 2 then raise exception 'a group needs a name'; end if;
  if (select count(*) from groups g where g.created_by = auth.uid() and g.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'that''s a lot of new groups at once. Try again in a bit';
  end if;
  v_code := public.new_group_code();
  insert into groups (name, code, created_by) values (v_name, v_code, auth.uid()) returning groups.id into v_id;
  insert into memberships (group_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return query select v_id, v_code;
end $$;

-- Existing groups: whoever started it (and is still an admin there) becomes its owner
update public.memberships m set role = 'owner'
  from public.groups g
 where g.id = m.group_id and m.user_id = g.created_by and m.role = 'admin';

-- Admins and owners see who's in the group
create function public.group_members(p_group uuid)
returns table (user_id uuid, name text, avatar_path text, role text)
language sql stable security definer set search_path = public as $$
  select m.user_id, coalesce(nullif(p.name, ''), 'No name yet'), p.avatar_path, m.role
    from memberships m left join profiles p on p.id = m.user_id
   where m.group_id = p_group and public.is_admin(p_group)
   order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, lower(coalesce(p.name, ''));
$$;

-- Owners set anyone's role: owner (up to two), admin or member
create function public.set_member_role(p_group uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not public.is_owner(p_group) then
    raise exception 'only the group''s owners can change roles' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'member') then
    raise exception 'unknown role' using errcode = '22023';
  end if;
  select role into v_old from memberships where group_id = p_group and user_id = p_user for update;
  if v_old is null then
    raise exception 'they''re not in this group' using errcode = '22023';
  end if;
  if v_old = 'owner' and p_role <> 'owner' and (
    select count(*) from memberships where group_id = p_group and role = 'owner' and user_id <> p_user
  ) = 0 then
    raise exception 'a group needs at least one owner' using errcode = '23514';
  end if;
  update memberships set role = p_role where group_id = p_group and user_id = p_user;
end $$;

revoke execute on function public.is_owner(uuid)                    from public, anon;
revoke execute on function public.group_members(uuid)               from public, anon;
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;
grant  execute on function public.is_owner(uuid)                    to authenticated;
grant  execute on function public.group_members(uuid)               to authenticated;
grant  execute on function public.set_member_role(uuid, uuid, text) to authenticated;
