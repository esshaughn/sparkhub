-- The demo roster (named testers' roles) is keyed by group id instead of group name.
-- Existing rows are matched once, preferring the real group: a demo group, then one an owner account
-- (demo_admins) started, then Torrez Fitness by its code, then the oldest. Rows with no group go.
-- Starting or renaming a group to a demo group's name (or a roster group's) is refused.

alter table public.demo_roster add column group_id uuid references public.groups (id) on delete cascade;
update public.demo_roster d set group_id = (
  select g.id from public.groups g
   where lower(g.name) = lower(d.group_name)
   order by g.demo desc,
            (g.created_by in (select user_id from public.demo_admins)) desc,
            (g.code = 'TORREZ') desc,
            g.created_at
   limit 1);
delete from public.demo_roster where group_id is null;
alter table public.demo_roster drop constraint demo_roster_pkey;
alter table public.demo_roster drop column group_name;
alter table public.demo_roster alter column group_id set not null;
alter table public.demo_roster add primary key (email, group_id);

create or replace function public.apply_demo_world(p_user uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare r record; cur text; rank_of constant jsonb := '{"member":1,"admin":2,"owner":3}';
begin
  if p_email is null or p_email ilike '%@example.com' then return; end if;   -- test and demo accounts
  for r in select d.group_id, d.role from demo_roster d where lower(d.email) = lower(p_email) loop
    select role into cur from memberships where group_id = r.group_id and user_id = p_user;
    if r.role = 'owner' and (select count(*) from memberships where group_id = r.group_id and role = 'owner' and user_id <> p_user) >= 2 then
      r.role := 'admin';
    end if;
    if cur is null then
      insert into memberships (group_id, user_id, role) values (r.group_id, p_user, r.role);
    elsif (rank_of ->> r.role)::int > (rank_of ->> cur)::int then
      update memberships set role = r.role where group_id = r.group_id and user_id = p_user;
    end if;
  end loop;
  if exists (select 1 from demo_roster where lower(email) = lower(p_email)) then
    perform public.demo_participate(p_user);
  end if;
end $$;
revoke execute on function public.apply_demo_world(uuid, text) from public, anon, authenticated;

-- A name another group can't take: a demo group's, or a roster group's (other than this group itself)
create or replace function private.reserved_group_name(p_name text, p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups g
                  where lower(g.name) = lower(trim(p_name)) and g.id is distinct from p_group
                    and (g.demo or g.id in (select group_id from demo_roster)));
$$;
revoke all on function private.reserved_group_name(text, uuid) from public, anon, authenticated;

create or replace function public.create_group(p_name text)
returns table (id uuid, code text) language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text; v_name text := left(trim(regexp_replace(p_name, '\s+', ' ', 'g')), 40);
begin
  if not public.is_signed_in() then raise exception 'sign in to start a group'; end if;
  if char_length(v_name) < 2 then raise exception 'a group needs a name'; end if;
  if private.reserved_group_name(v_name, null) then
    raise exception 'that name is taken, try another' using errcode = '23505';
  end if;
  if (select count(*) from groups g where g.created_by = auth.uid() and g.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'that''s a lot of new groups at once. Try again in a bit';
  end if;
  v_code := public.new_group_code();
  insert into groups (name, code, created_by) values (v_name, v_code, auth.uid()) returning groups.id into v_id;
  insert into memberships (group_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return query select v_id, v_code;
end $$;

create or replace function public.rename_group(p_group uuid, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text := left(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 40);
begin
  if not public.is_owner(p_group) then
    raise exception 'only the group''s owners can rename it' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 then raise exception 'a group needs a name' using errcode = '22023'; end if;
  if private.reserved_group_name(v_name, p_group) then
    raise exception 'that name is taken, try another' using errcode = '23505';
  end if;
  update groups set name = v_name where id = p_group;
  return v_name;
end $$;
