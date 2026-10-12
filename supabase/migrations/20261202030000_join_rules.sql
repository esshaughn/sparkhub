-- Who can join, and how you're connected (owner, 2026-10-12). Before joining, a group's link shows where the group
-- is, and you say how you're connected to the place: you live here, nearby, or you're just visiting (on your honor).
-- The group's owners pick who can join and can change it any time; a change affects new joins only.
--   join_rule: everyone (anyone with the link, the default) / nearby (live here or nearby) / neighbors (live here)
--   memberships.connection: here / nearby / visiting (null for people who joined before this, or by an invite)
-- An invite from the group (send_group_invites) skips the rule: an admin chose that person.

alter table public.groups add column join_rule text not null default 'everyone' check (join_rule in ('everyone', 'nearby', 'neighbors'));
grant select (join_rule) on public.groups to authenticated;
alter table public.memberships add column connection text check (connection in ('here', 'nearby', 'visiting'));

-- What a group's link shows before joining (anyone with the code, signed in or not, like group_preview)
create or replace function public.group_place(p_code text)
returns table (place_name text, place_kind text, place_lat double precision, place_lon double precision, place_radius_m integer,
               purpose text, join_rule text)
language sql stable security definer set search_path = public as $$
  select g.place_name, g.place_kind, g.place_lat, g.place_lon, g.place_radius_m, g.purpose, g.join_rule
    from groups g where g.code = upper(p_code) and char_length(p_code) = 6;
$$;
grant execute on function public.group_place(text) to anon, authenticated;

-- Joining says how you're connected; the group's rule decides whether that's enough
drop function public.join_group(text);
create function public.join_group(p_code text, p_connection text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_rule text; v_inv uuid;
begin
  if not public.is_signed_in() then raise exception 'sign in to join a group'; end if;
  if p_connection is not null and p_connection not in ('here', 'nearby', 'visiting') then
    raise exception 'pick how you''re connected' using errcode = '22023';
  end if;
  select g.id, g.join_rule into v_id, v_rule from groups g where g.code = upper(trim(p_code));
  if v_id is null then return null; end if;
  if exists (select 1 from group_bans b where b.group_id = v_id and b.user_id = auth.uid()) then return null; end if;
  if not exists (select 1 from memberships where group_id = v_id and user_id = auth.uid()) then
    if v_rule = 'neighbors' and p_connection is distinct from 'here' then
      raise exception 'join rule: this group is for people who live here' using errcode = '23514';
    end if;
    if v_rule = 'nearby' and (p_connection is null or p_connection = 'visiting') then
      raise exception 'join rule: this group is for people who live here or nearby' using errcode = '23514';
    end if;
  end if;
  insert into memberships (group_id, user_id, connection) values (v_id, auth.uid(), p_connection)
    on conflict (group_id, user_id) do update set connection = coalesce(excluded.connection, memberships.connection);
  insert into memberships (group_id, user_id)
    select j.also_group_id, auth.uid() from join_also j
     where j.group_id = v_id
       and not exists (select 1 from group_bans b where b.group_id = j.also_group_id and b.user_id = auth.uid())
    on conflict do nothing;
  select id into v_inv from group_invites where group_id = v_id and user_id = auth.uid() and status <> 'joined';
  if v_inv is not null then perform private.group_invite_joined(v_inv); end if;
  return v_id;
end $$;
revoke all on function public.join_group(text, text) from public, anon;
grant execute on function public.join_group(text, text) to authenticated;

-- Owners set who can join
create or replace function public.set_join_rule(p_group uuid, p_rule text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_group) then raise exception 'only the group''s owners can change who can join' using errcode = '42501'; end if;
  if p_rule is null or p_rule not in ('everyone', 'nearby', 'neighbors') then raise exception 'pick who can join' using errcode = '22023'; end if;
  update groups set join_rule = p_rule where id = p_group;
end $$;
revoke all on function public.set_join_rule(uuid, text) from public, anon;
grant execute on function public.set_join_rule(uuid, text) to authenticated;

-- Members change their own answer (moved, or answered wrong)
create or replace function public.set_my_connection(p_group uuid, p_connection text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_connection is null or p_connection not in ('here', 'nearby', 'visiting') then raise exception 'pick how you''re connected' using errcode = '22023'; end if;
  update memberships set connection = p_connection where group_id = p_group and user_id = auth.uid();
  if not found then raise exception 'you''re not in this group' using errcode = '42501'; end if;
end $$;
revoke all on function public.set_my_connection(uuid, text) from public, anon;
grant execute on function public.set_my_connection(uuid, text) to authenticated;

-- The admins' Members list shows each member's answer
drop function public.group_members(uuid);
create function public.group_members(p_group uuid)
returns table (user_id uuid, name text, avatar_path text, role text, email text, joined_at timestamptz, connection text)
language sql stable security definer set search_path = public, auth as $$
  select m.user_id, coalesce(nullif(p.name, ''), 'No name yet'), p.avatar_path, m.role, u.email::text, m.joined_at, m.connection
    from memberships m left join profiles p on p.id = m.user_id left join auth.users u on u.id = m.user_id
   where m.group_id = p_group and public.is_admin(p_group)
   order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, lower(coalesce(p.name, ''));
$$;
revoke all on function public.group_members(uuid) from public, anon;
grant execute on function public.group_members(uuid) to authenticated;

-- load_all carries the rule with each group and your own answer with each membership
do $$
declare d text;
begin
  d := pg_get_functiondef('public.load_all()'::regprocedure);
  d := replace(d, 'select group_id, role, last_seen_at, pinned from memberships', 'select group_id, role, last_seen_at, pinned, connection from memberships');
  d := replace(d, 'place_name, place_kind, place_lat, place_lon, place_radius_m, purpose, plan, sponsored from groups',
                  'place_name, place_kind, place_lat, place_lon, place_radius_m, purpose, plan, sponsored, join_rule from groups');
  if position('pinned, connection from memberships' in d) = 0 or position('sponsored, join_rule from groups' in d) = 0 then
    raise exception 'load_all() did not change as expected';
  end if;
  execute d;
end $$;
