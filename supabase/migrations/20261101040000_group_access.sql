-- Group access: link rows say where they came from, leaving or being removed from a group clears the
-- ones for its events, and owners can change the invite code and block someone from rejoining.
-- * link_access.via says where a row came from: 'link' (opening an event's link, open_idea) or 'invite'
--   (a friend's invite, invite_friends). remove_member() and leave_group() delete that person's 'link'
--   rows for the group's events (home group or posted to it); invites from friends stay.
-- * The app calls open_idea only for events the person can't already see; link rows for events
--   visible to the person's whole group are cleared once here.
-- * rotate_group_code() (owners) gives the group a new code; the old link and code stop working.
-- * group_bans: remove_member(…, p_block => true) also blocks them; join_group() then treats them like a
--   wrong code. Admins list and lift blocks with group_blocked() / unblock_member(). No client access.

alter table public.link_access add column via text not null default 'link' check (via in ('link', 'invite'));
update public.link_access l set via = 'invite'
  from public.event_invites i where i.spark_id = l.spark_id and i.user_id = l.user_id;

-- One-time cleanup: link rows for events the person sees anyway as a member of one of its groups
delete from public.link_access l
 using public.sparks s
 where s.id = l.spark_id and l.via = 'link' and s.visibility = 'group'
   and exists (select 1 from public.memberships m
                where m.user_id = l.user_id
                  and (m.group_id = s.group_id
                       or m.group_id in (select g.group_id from public.spark_groups g where g.spark_id = s.id)));

create table public.group_bans (
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  banned_by  uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.group_bans enable row level security;   -- no policies: only through the functions below
revoke all on table public.group_bans from anon, authenticated;

-- A person's link rows for a group's events (home group, or posted to it)
create or replace function private.drop_group_links(p_group uuid, p_user uuid)
returns void language sql security definer set search_path = public as $$
  delete from link_access l
   where l.user_id = p_user and l.via = 'link'
     and l.spark_id in (select s.id from sparks s where s.group_id = p_group
                        union select g.spark_id from spark_groups g where g.group_id = p_group);
$$;
revoke all on function private.drop_group_links(uuid, uuid) from public, anon, authenticated;

create or replace function public.open_idea(p_spark uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from sparks where id = p_spark) then return false; end if;
  insert into link_access (user_id, spark_id, via) values (auth.uid(), p_spark, 'link') on conflict do nothing;
  return true;
end $$;

-- invite_friends: the same as before, but its rows are marked 'invite' (an existing link row becomes one)
create or replace function public.invite_friends(p_spark uuid, p_people uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid(); s record; v_ok boolean; p uuid;
  v_invited uuid[] := '{}'; v_going uuid[] := '{}'; v_already uuid[] := '{}';
  v_name text;
begin
  if not public.is_signed_in() then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_people is null or cardinality(p_people) = 0 then return jsonb_build_object('invited', '[]'::jsonb, 'going', '[]'::jsonb, 'already', '[]'::jsonb); end if;
  if cardinality(p_people) > 30 then raise exception 'too many at once' using errcode = '22023'; end if;
  select id, text, lead_id, group_id, planned, guest_invites, cancelled_at, day_date, day_time, spot into s from sparks where id = p_spark;
  if s.id is null or not public.can_see_spark(p_spark) then raise exception 'no such event' using errcode = '22023'; end if;
  if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '22023'; end if;
  v_ok := s.lead_id = v_me
       or public.is_admin(s.group_id)
       or (s.guest_invites and exists (select 1 from rsvps r where r.spark_id = p_spark and r.user_id = v_me and r.status = 'going'));
  if not v_ok then raise exception 'the lead hasn''t turned on guest invites' using errcode = '42501'; end if;
  foreach p in array coalesce((select array_agg(distinct x) from unnest(p_people) x where x is not null), '{}') loop
    if p = v_me or not public.is_friend(p) then continue; end if;
    if p = s.lead_id or exists (select 1 from rsvps r where r.spark_id = p_spark and r.user_id = p and r.status = 'going') then
      v_going := v_going || p;
    elsif exists (select 1 from event_invites i where i.spark_id = p_spark and i.user_id = p) then
      v_already := v_already || p;
    else
      insert into event_invites (spark_id, user_id, invited_by) values (p_spark, p, v_me);
      insert into link_access (user_id, spark_id, via) values (p, p_spark, 'invite')
        on conflict (user_id, spark_id) do update set via = 'invite';
      v_invited := v_invited || p;
    end if;
  end loop;
  if cardinality(v_invited) > 0 then
    v_name := private.person_name(v_me, p_spark);
    perform private.push_send(v_invited, 'friends', v_name || ' invited you to ' || s.text,
      private.when_text(s.day_date, s.day_time, s.spot) || '. RSVP in Spark Hub.', '/#/idea/' || s.id, 'fi:' || s.id);
  end if;
  return jsonb_build_object('invited', to_jsonb(v_invited), 'going', to_jsonb(v_going), 'already', to_jsonb(v_already));
end $$;

-- remove_member gains p_block (remove and block from rejoining)
drop function public.remove_member(uuid, uuid);
create function public.remove_member(p_group uuid, p_user uuid, p_block boolean default false)
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
  perform private.drop_group_links(p_group, p_user);
  if p_block then
    insert into group_bans (group_id, user_id, banned_by) values (p_group, p_user, auth.uid()) on conflict do nothing;
  end if;
end $$;
revoke all on function public.remove_member(uuid, uuid, boolean) from public, anon;
grant execute on function public.remove_member(uuid, uuid, boolean) to authenticated;

create or replace function public.leave_group(p_group uuid)
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
  perform private.drop_group_links(p_group, auth.uid());
end $$;

-- Blocked people can't join (a block looks the same as a wrong code), and aren't added by join_also
create or replace function public.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_signed_in() then raise exception 'sign in to join a group'; end if;
  select g.id into v_id from groups g where g.code = upper(trim(p_code));
  if v_id is null then return null; end if;
  if exists (select 1 from group_bans b where b.group_id = v_id and b.user_id = auth.uid()) then return null; end if;
  insert into memberships (group_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
  insert into memberships (group_id, user_id)
    select j.also_group_id, auth.uid() from join_also j
     where j.group_id = v_id
       and not exists (select 1 from group_bans b where b.group_id = j.also_group_id and b.user_id = auth.uid())
    on conflict do nothing;
  return v_id;
end $$;

-- Owners: a new invite code (the old link and code stop working)
create or replace function public.rotate_group_code(p_group uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_owner(p_group) then
    raise exception 'only the group''s owners can change its code' using errcode = '42501';
  end if;
  v_code := public.new_group_code();
  update groups set code = v_code where id = p_group;
  return v_code;
end $$;
revoke all on function public.rotate_group_code(uuid) from public, anon;
grant execute on function public.rotate_group_code(uuid) to authenticated;

-- Admins: who's blocked, and lifting a block
create or replace function public.group_blocked(p_group uuid)
returns table (user_id uuid, name text, avatar_path text, blocked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.user_id, coalesce(nullif(p.name, ''), 'No name yet'), p.avatar_path, b.created_at
    from group_bans b left join profiles p on p.id = b.user_id
   where b.group_id = p_group and public.is_admin(p_group)
   order by b.created_at desc;
$$;
revoke all on function public.group_blocked(uuid) from public, anon;
grant execute on function public.group_blocked(uuid) to authenticated;

create or replace function public.unblock_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_group) then
    raise exception 'only the group''s admins can do that' using errcode = '42501';
  end if;
  delete from group_bans where group_id = p_group and user_id = p_user;
end $$;
revoke all on function public.unblock_member(uuid, uuid) from public, anon;
grant execute on function public.unblock_member(uuid, uuid) to authenticated;
