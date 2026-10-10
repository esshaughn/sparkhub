-- Person-to-person group invites (Design v8-22: 1a Invite to a group, 2a bell rows, 4a/4b after joining,
-- Members INVITED; owner calls Q22 + Q33). Only owners and admins invite. The invitee gets a push and a bell row
-- (from friend_state()), and joins or turns it down (Not now hides it for good, and nobody is told). The inviter
-- or any admin of the group can take an invite back (nobody is told) or send one reminder a day. No expiry.
-- Joining by link or code also answers a waiting invite to that group, so the inviter still hears.

create table public.group_invites (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,      -- the person invited
  invited_by  uuid references auth.users (id) on delete set null,
  status      text not null default 'pending' check (status in ('pending', 'joined', 'declined')),
  created_at  timestamptz not null default now(),
  reminded_at timestamptz,
  answered_at timestamptz,
  hi_at       timestamptz,                                                     -- Say hi to {inviter}, once
  unique (group_id, user_id)
);
create index group_invites_user on public.group_invites (user_id, status);
-- No client access: everything goes through the functions below
alter table public.group_invites enable row level security;
revoke all on table public.group_invites from public, anon, authenticated;

-- The groups the caller runs, with the person's place in each (Invite to a group, 1a): member · invited · null
create or replace function public.group_invite_options(p_user uuid)
returns table (group_id uuid, name text, photo text, role text, members int, state text)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.photo, m.role,
         (select count(*)::int from memberships x where x.group_id = g.id),
         case when exists (select 1 from memberships x where x.group_id = g.id and x.user_id = p_user) then 'member'
              when exists (select 1 from group_invites i where i.group_id = g.id and i.user_id = p_user and i.status <> 'joined') then 'invited'
         end
    from memberships m join groups g on g.id = m.group_id
   where m.user_id = auth.uid() and m.role in ('owner', 'admin') and public.is_signed_in()
   order by lower(g.name);
$$;
revoke all on function public.group_invite_options(uuid) from public, anon;
grant execute on function public.group_invite_options(uuid) to authenticated;

-- Send: every pair of (group the caller runs) × (account they're friends with or share a group with). Skips people
-- already in the group, already invited (a turned-down invite stays turned down, silently), blocked from the group,
-- or blocked either way. 50 invites an hour. Returns how many new invites went out.
create or replace function public.send_group_invites(p_groups uuid[], p_users uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_name text; g uuid; u uuid; v_id uuid; v_gname text; n int := 0;
begin
  if not public.is_signed_in() then raise exception 'sign in to invite people' using errcode = '42501'; end if;
  if coalesce(cardinality(p_groups), 0) = 0 or coalesce(cardinality(p_users), 0) = 0 then return 0; end if;
  if cardinality(p_groups) > 20 or cardinality(p_users) > 50 then raise exception 'too many at once' using errcode = '22023'; end if;
  foreach g in array p_groups loop
    if not public.is_admin(g) then raise exception 'only a group''s owners and admins invite people' using errcode = '42501'; end if;
  end loop;
  select coalesce(nullif(split_part(trim(name), ' ', 1), ''), 'Someone') into v_name from profiles where id = me;
  v_name := coalesce(v_name, 'Someone');
  foreach u in array p_users loop
    if u = me then continue; end if;
    if not exists (select 1 from auth.users a where a.id = u and not coalesce(a.is_anonymous, false)) then continue; end if;
    if not (public.is_friend(u) or public.shares_group(u)) then continue; end if;
    if exists (select 1 from user_blocks b where (b.blocker = me and b.blocked = u) or (b.blocker = u and b.blocked = me)) then continue; end if;
    foreach g in array p_groups loop
      if exists (select 1 from memberships m where m.group_id = g and m.user_id = u) then continue; end if;
      if exists (select 1 from group_bans b where b.group_id = g and b.user_id = u) then continue; end if;
      if not private.rate_ok(me, 'group_invite', 50, interval '1 hour') and not exists (select 1 from private.rate_exempt where user_id = me) then
        raise exception 'You''re going a bit fast. Try again in a little while.' using errcode = 'PT429';
      end if;
      -- An old joined row (they left the group since) makes way for a new invite
      delete from group_invites i where i.group_id = g and i.user_id = u and i.status = 'joined';
      insert into group_invites (group_id, user_id, invited_by) values (g, u, me)
        on conflict (group_id, user_id) do nothing returning id into v_id;
      if v_id is null then continue; end if;
      n := n + 1;
      select name into v_gname from groups where id = g;
      perform private.push_send(array[u], 'friends', v_name || ' invited you to ' || coalesce(v_gname, 'a group'),
        'Tap to see the group and join.', '/#/notifications', 'gi:' || v_id);
      v_id := null;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.send_group_invites(uuid[], uuid[]) from public, anon;
grant execute on function public.send_group_invites(uuid[], uuid[]) to authenticated;

-- Joined (by the invite, or by link or code with an invite waiting): the inviter gets a bell line and a push
create or replace function private.group_invite_joined(p_invite uuid) returns void
language plpgsql security definer set search_path = public as $$
declare i group_invites; v_name text; v_g text; v_note uuid;
begin
  update group_invites set status = 'joined', answered_at = now() where id = p_invite and status <> 'joined' returning * into i;
  if i.id is null or i.invited_by is null then return; end if;
  select coalesce(nullif(trim(name), ''), 'Someone') into v_name from profiles where id = i.user_id;
  select name into v_g from groups where id = i.group_id;
  insert into notes (user_id, body, created_by, quiet)
    values (i.invited_by, left(coalesce(v_name, 'Someone') || ' joined ' || coalesce(v_g, 'your group') || '. You invited them.', 320), i.user_id, true)
    returning id into v_note;
  perform private.push_send(array[i.invited_by], 'friends', coalesce(v_name, 'Someone') || ' joined ' || coalesce(v_g, 'your group'),
    'You invited them.', '/#/notifications', 'gj:' || i.id);
end $$;
revoke all on function private.group_invite_joined(uuid) from public, anon, authenticated;

-- The invitee: Join (true) or Not now (false). Join returns the group's id (null if it can't happen: blocked from
-- the group, or the invite was taken back). Not now hides it for good and tells no one.
create or replace function public.answer_group_invite(p_invite uuid, p_join boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare i group_invites;
begin
  if not public.is_signed_in() then raise exception 'sign in to join a group' using errcode = '42501'; end if;
  select * into i from group_invites where id = p_invite and user_id = auth.uid();
  if i.id is null then return null; end if;
  if not p_join then
    update group_invites set status = 'declined', answered_at = now() where id = i.id and status = 'pending';
    return null;
  end if;
  if exists (select 1 from group_bans b where b.group_id = i.group_id and b.user_id = auth.uid()) then return null; end if;
  insert into memberships (group_id, user_id) values (i.group_id, auth.uid()) on conflict do nothing;
  perform private.group_invite_joined(i.id);
  return i.group_id;
end $$;
revoke all on function public.answer_group_invite(uuid, boolean) from public, anon;
grant execute on function public.answer_group_invite(uuid, boolean) to authenticated;

-- 4b's Say hi to {inviter}: one push and bell line to whoever invited you, once per invite
create or replace function public.group_invite_hi(p_invite uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare i group_invites; v_name text; v_g text;
begin
  update group_invites set hi_at = now()
   where id = p_invite and user_id = auth.uid() and status = 'joined' and hi_at is null and invited_by is not null
  returning * into i;
  if i.id is null then return false; end if;
  select coalesce(nullif(split_part(trim(name), ' ', 1), ''), 'Someone') into v_name from profiles where id = i.user_id;
  select name into v_g from groups where id = i.group_id;
  insert into notes (user_id, body, created_by, quiet)
    values (i.invited_by, left(coalesce(v_name, 'Someone') || ' says hi from ' || coalesce(v_g, 'your group') || ' 👋', 320), i.user_id, true);
  perform private.push_send(array[i.invited_by], 'friends', coalesce(v_name, 'Someone') || ' says hi 👋',
    'From ' || coalesce(v_g, 'your group') || '. You invited them.', '/#/notifications', 'gh:' || i.id);
  return true;
end $$;
revoke all on function public.group_invite_hi(uuid) from public, anon;
grant execute on function public.group_invite_hi(uuid) to authenticated;

-- Members → INVITED (owners and admins): invites still waiting. One that was turned down still shows as waiting
-- (Not now is silent).
create or replace function public.group_invites_waiting(p_group uuid)
returns table (id uuid, user_id uuid, name text, avatar_path text, invited_by uuid, by_name text, created_at timestamptz, reminded_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.user_id, coalesce(nullif(p.name, ''), 'No name yet'), p.avatar_path, i.invited_by, coalesce(nullif(b.name, ''), 'Someone'), i.created_at, i.reminded_at
    from group_invites i left join profiles p on p.id = i.user_id left join profiles b on b.id = i.invited_by
   where i.group_id = p_group and i.status <> 'joined' and public.is_admin(p_group)
   order by i.created_at desc;
$$;
revoke all on function public.group_invites_waiting(uuid) from public, anon;
grant execute on function public.group_invites_waiting(uuid) to authenticated;

-- Take back (the inviter or any admin of the group). Nobody is told.
create or replace function public.take_back_group_invite(p_invite uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from group_invites i where i.id = p_invite and i.status <> 'joined'
     and (i.invited_by = auth.uid() or public.is_admin(i.group_id));
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.take_back_group_invite(uuid) from public, anon;
grant execute on function public.take_back_group_invite(uuid) to authenticated;

-- Send a reminder (an admin of the group): one push, at most once a Central-time day per invite. Returns false when
-- it's too soon. Someone who turned it down hears nothing, but the admin sees the same answer (Not now is silent).
create or replace function public.remind_group_invite(p_invite uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare i group_invites; v_name text; v_g text;
begin
  select * into i from group_invites where id = p_invite and status <> 'joined';
  if i.id is null or not public.is_admin(i.group_id) then raise exception 'only the group''s owners and admins' using errcode = '42501'; end if;
  if i.reminded_at is not null and (i.reminded_at at time zone 'America/Chicago')::date = (now() at time zone 'America/Chicago')::date then return false; end if;
  update group_invites set reminded_at = now() where id = i.id;
  if i.status = 'pending' then
    select coalesce(nullif(split_part(trim(name), ' ', 1), ''), 'Someone') into v_name from profiles where id = coalesce(i.invited_by, auth.uid());
    select name into v_g from groups where id = i.group_id;
    perform private.push_send(array[i.user_id], 'friends', 'Reminder: ' || coalesce(v_name, 'Someone') || ' invited you to ' || coalesce(v_g, 'a group'),
      'Tap to see the group and join.', '/#/notifications', 'gi:' || i.id);
  end if;
  return true;
end $$;
revoke all on function public.remind_group_invite(uuid) from public, anon;
grant execute on function public.remind_group_invite(uuid) to authenticated;

-- Joining by link or code answers a waiting (or turned-down) invite to that group too. Otherwise the same as
-- 20261101040000_group_access.sql.
create or replace function public.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_inv uuid;
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
  select id into v_inv from group_invites where group_id = v_id and user_id = auth.uid() and status <> 'joined';
  if v_inv is not null then perform private.group_invite_joined(v_inv); end if;
  return v_id;
end $$;
revoke execute on function public.join_group(text) from public, anon;
grant execute on function public.join_group(text) to authenticated;

-- friend_state(): adds the group invites waiting for you (2a, Get started's Join a group) and the ones you joined
-- through in the last 7 days (the bell's "You joined …" row, 4a/4b name the inviter). Otherwise the same as
-- 20261102050000_ask_notes.sql. load_all() returns it, so this needs no new request.
create or replace function public.friend_state()
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  fr as (
    select case when f.user_a = me.id then f.user_b else f.user_a end as id, f.created_at
      from friendships f, me where me.id in (f.user_a, f.user_b)
  ),
  gi as (
    select i.*, g.name as g_name, g.photo as g_photo,
           (select count(*)::int from memberships x where x.group_id = i.group_id) as g_members,
           (select jsonb_build_object('text', s.text, 'day', s.day_date, 'time', s.day_time)
              from sparks s
             where (s.group_id = i.group_id or exists (select 1 from spark_groups sg where sg.spark_id = s.id and sg.group_id = i.group_id))
               and s.planned and s.cancelled_at is null and not s.test and s.visibility = 'group'
               and s.day_date >= (now() at time zone 'America/Chicago')::date
             order by s.day_date, s.day_time nulls last limit 1) as g_next
      from group_invites i join groups g on g.id = i.group_id
     where i.user_id = (select id from me)
       and (i.status = 'pending' or (i.status = 'joined' and i.answered_at > now() - interval '7 days'))
  )
  select jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', fr.id, 'name', coalesce(nullif(p.name, ''), 'No name yet'), 'avatar', p.avatar_path, 'since', fr.created_at,
               'groups', coalesce((select jsonb_agg(g.name order by g.name)
                                     from groups g
                                     join memberships a on a.group_id = g.id and a.user_id = (select id from me)
                                     join memberships b on b.group_id = g.id and b.user_id = fr.id), '[]'::jsonb))
             order by lower(coalesce(p.name, '')))
        from fr left join profiles p on p.id = fr.id), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.from_id, 'name', coalesce(nullif(p.name, ''), 'Someone'), 'avatar', p.avatar_path,
               'group', g.name, 'at', r.created_at) order by r.created_at desc)
        from friend_requests r left join profiles p on p.id = r.from_id left join groups g on g.id = r.group_id
       where r.to_id = (select id from me) and r.declined_at is null), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(r.to_id) from friend_requests r where r.from_id = (select id from me)), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('spark', i.spark_id, 'by', i.invited_by, 'at', i.created_at, 'note', i.message) order by i.created_at desc)
        from event_invites i where i.user_id = (select id from me) and i.created_at > now() - interval '60 days'), '[]'::jsonb),
    'group_invites', coalesce((
      select jsonb_agg(jsonb_build_object('id', gi.id, 'group', gi.group_id, 'name', gi.g_name, 'photo', gi.g_photo, 'members', gi.g_members,
               'next', gi.g_next, 'by', gi.invited_by, 'by_name', coalesce(nullif(p.name, ''), 'Someone'), 'by_avatar', p.avatar_path,
               'status', gi.status, 'at', gi.created_at, 'answered', gi.answered_at, 'hi', gi.hi_at is not null)
             order by gi.created_at desc)
        from gi left join profiles p on p.id = gi.invited_by), '[]'::jsonb)
  );
$$;
revoke execute on function public.friend_state() from public, anon;
grant execute on function public.friend_state() to authenticated;
