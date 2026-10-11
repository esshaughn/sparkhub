-- Members can invite people (Design v8-24 item 3): a per-group switch for owners and admins, off by default. When on,
-- any member gets what owners and admins get for inviting: the group's link and QR (group_code()), and sending
-- invites to friends (send_group_invites, group_invite_options). Members INVITED, reminders and the new-link button
-- stay with owners and admins.

alter table public.groups add column if not exists members_can_invite boolean not null default false;
grant select (members_can_invite) on table public.groups to authenticated;

create or replace function public.can_invite(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(p_group)
      or (public.is_member(p_group) and coalesce((select members_can_invite from groups where id = p_group), false));
$$;
revoke all on function public.can_invite(uuid) from public, anon;
grant execute on function public.can_invite(uuid) to authenticated;

-- The switch (Group ⋯ → ADMINS ONLY)
create or replace function public.set_members_can_invite(p_group uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_group) then raise exception 'only the group''s owners and admins' using errcode = '42501'; end if;
  update groups set members_can_invite = coalesce(p_on, false) where id = p_group;
end $$;
revoke all on function public.set_members_can_invite(uuid, boolean) from public, anon;
grant execute on function public.set_members_can_invite(uuid, boolean) to authenticated;

-- The link and QR: anyone who can invite
create or replace function public.group_code(p_group uuid)
returns text language sql stable security definer set search_path = public as $$
  select code from groups where id = p_group and public.can_invite(p_group);
$$;
revoke execute on function public.group_code(uuid) from public, anon;
grant execute on function public.group_code(uuid) to authenticated;

-- Invite to a group (profile): the groups the caller can invite to
create or replace function public.group_invite_options(p_user uuid)
returns table (group_id uuid, name text, photo text, role text, members int, state text)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.photo, m.role,
         (select count(*)::int from memberships x where x.group_id = g.id),
         case when exists (select 1 from memberships x where x.group_id = g.id and x.user_id = p_user) then 'member'
              when exists (select 1 from group_invites i where i.group_id = g.id and i.user_id = p_user and i.status <> 'joined') then 'invited'
         end
    from memberships m join groups g on g.id = m.group_id
   where m.user_id = auth.uid() and (m.role in ('owner', 'admin') or g.members_can_invite) and public.is_signed_in()
   order by lower(g.name);
$$;
revoke all on function public.group_invite_options(uuid) from public, anon;
grant execute on function public.group_invite_options(uuid) to authenticated;

-- Send: as before, to groups the caller can invite to
create or replace function public.send_group_invites(p_groups uuid[], p_users uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_name text; g uuid; u uuid; v_id uuid; v_gname text; n int := 0;
begin
  if not public.is_signed_in() then raise exception 'sign in to invite people' using errcode = '42501'; end if;
  if coalesce(cardinality(p_groups), 0) = 0 or coalesce(cardinality(p_users), 0) = 0 then return 0; end if;
  if cardinality(p_groups) > 20 or cardinality(p_users) > 50 then raise exception 'too many at once' using errcode = '22023'; end if;
  foreach g in array p_groups loop
    if not public.can_invite(g) then raise exception 'only a group''s owners and admins invite people, unless members can' using errcode = '42501'; end if;
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

-- The group's Invite people sheet (v8-24 item 4): who already has an invite to this group, for anyone who can invite.
-- A turned-down invite reads as invited (Not now stays silent, as on Members INVITED). mine: you sent it
create or replace function public.group_invite_people(p_group uuid)
returns table (user_id uuid, status text, mine boolean)
language sql stable security definer set search_path = public as $$
  select i.user_id, case when i.status = 'joined' then 'joined' else 'invited' end, i.invited_by = auth.uid()
    from group_invites i
   where i.group_id = p_group and public.can_invite(p_group);
$$;
revoke all on function public.group_invite_people(uuid) from public, anon;
grant execute on function public.group_invite_people(uuid) to authenticated;

-- load_all() (otherwise as 20261123000000_cap_waitlist_offer_note.sql): groups.members_can_invite
create or replace function public.load_all() returns jsonb
language sql stable security invoker set search_path = public as $$
  with
  sp  as materialized (select s.* from sparks s),
  ofr as materialized (select o.* from offers o),
  itr as materialized (select spark_id, user_id, created_at, can_help, offer_note from interests),
  rsv as materialized (select spark_id, user_id, status, created_at, attended, days, maybe_days, plus_count, plus_note from rsvps),
  coh as materialized (select spark_id, user_id, created_at from cohosts),
  scl as materialized (select item_id, user_id, note, created_at from signup_claims),
  swt as materialized (select item_id, user_id, created_at from signup_waits),
  ewt as materialized (select spark_id, user_id, created_at from event_waits),
  rct as materialized (select spark_id, user_id, kind from reactions),
  nts as materialized (select id, body, created_by, created_at from notes order by created_at desc limit 50),
  las as materialized (select spark_id, user_id, asked_by, created_at, message from lead_asks),
  inv as materialized (select spark_id, user_id, invited_by, created_at, nudged_at from event_invites),
  jas as materialized (select item_id, spark_id, user_id, asked_by, message, answer, created_at, answered_at from job_asks),
  lof as materialized (select spark_id, user_id, offered_by, message, created_at from lead_offers),
  tlk as materialized (select spark_id, user_id, created_at from talk_offers),
  -- Everyone on screen: their names and photos come along (the profiles rules still decide which). They are
  -- looked up as a list of ids (= any(array)), so the profiles rules run for those rows only, not the table.
  who as (
    select auth.uid() as id
    union select lead_id from sp
    union select user_id from ofr
    union select user_id from itr
    union select user_id from rsv
    union select user_id from coh
    union select user_id from scl
    union select user_id from swt
    union select user_id from ewt
    union select user_id from rct
    union select created_by from nts
    union select user_id from las
    union select asked_by from las
    union select user_id from inv
    union select user_id from jas
    union select asked_by from jas
    union select user_id from lof
    union select user_id from tlk
  )
  select jsonb_build_object(
    'memberships',    coalesce((select jsonb_agg(to_jsonb(t)) from (select group_id, role, last_seen_at, pinned from memberships) t), '[]'::jsonb),
    'groups',         coalesce((select jsonb_agg(to_jsonb(t)) from (select id, name, photo, photo_pos, demo, members_can_invite from groups) t), '[]'::jsonb),
    'sparks',         coalesce((select jsonb_agg(to_jsonb(sp) order by sp.created_at desc) from sp), '[]'::jsonb),
    'offers',         coalesce((select jsonb_agg(to_jsonb(ofr) order by ofr.created_at) from ofr), '[]'::jsonb),
    'interests',      coalesce((select jsonb_agg(to_jsonb(itr)) from itr), '[]'::jsonb),
    'guest_contacts', coalesce((select jsonb_agg(to_jsonb(t)) from (select spark_id, user_id, name, phone from guest_contacts) t), '[]'::jsonb),
    'rsvps',          coalesce((select jsonb_agg(to_jsonb(rsv)) from rsv), '[]'::jsonb),
    'date_options',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, day_date, day_time, day_part, who, created_by, created_at from date_options) t), '[]'::jsonb),
    'date_votes',     coalesce((select jsonb_agg(to_jsonb(t)) from (select option_id, user_id from date_votes) t), '[]'::jsonb),
    'spot_options',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, name, address, lat, lon, who, created_by, created_at from spot_options) t), '[]'::jsonb),
    'spot_votes',     coalesce((select jsonb_agg(to_jsonb(t)) from (select option_id, user_id from spot_votes) t), '[]'::jsonb),
    'signup_items',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, item, need, time, end_time, descr, shift_of, kind, waitlist, per_person, guests, day, created_by, created_at from signup_items) t), '[]'::jsonb),
    'signup_claims',  coalesce((select jsonb_agg(to_jsonb(scl)) from scl), '[]'::jsonb),
    'signup_waits',   coalesce((select jsonb_agg(to_jsonb(swt) order by swt.created_at) from swt), '[]'::jsonb),
    'event_waits',    coalesce((select jsonb_agg(to_jsonb(ewt) order by ewt.created_at) from ewt), '[]'::jsonb),
    'plan_updates',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, body, audience, created_by, created_at from plan_updates) t), '[]'::jsonb),
    'cohosts',        coalesce((select jsonb_agg(to_jsonb(coh) order by coh.created_at) from coh), '[]'::jsonb),
    'album_photos',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, path, created_by, created_at from album_photos) t), '[]'::jsonb),
    'plan_prep',      coalesce((select jsonb_agg(to_jsonb(t)) from (select spark_id, answers from plan_prep) t), '[]'::jsonb),
    'reactions',      coalesce((select jsonb_agg(to_jsonb(rct)) from rct), '[]'::jsonb),
    'spark_groups',   coalesce((select jsonb_agg(to_jsonb(t)) from (select spark_id, group_id from spark_groups) t), '[]'::jsonb),
    'event_drafts',   coalesce((select jsonb_agg(to_jsonb(t) order by t.updated_at desc) from (select id, data, updated_at from event_drafts) t), '[]'::jsonb),
    'notes',          coalesce((select jsonb_agg(to_jsonb(nts) order by nts.created_at desc) from nts), '[]'::jsonb),
    'lead_asks',      coalesce((select jsonb_agg(to_jsonb(las) order by las.created_at) from las), '[]'::jsonb),
    'event_invites',  coalesce((select jsonb_agg(to_jsonb(inv) order by inv.created_at) from inv), '[]'::jsonb),
    'job_asks',       coalesce((select jsonb_agg(to_jsonb(jas) order by jas.created_at) from jas), '[]'::jsonb),
    'lead_offers',    coalesce((select jsonb_agg(to_jsonb(lof)) from lof), '[]'::jsonb),
    'talk_offers',    coalesce((select jsonb_agg(to_jsonb(tlk) order by tlk.created_at) from tlk), '[]'::jsonb),
    'profiles',       coalesce((select jsonb_agg(to_jsonb(t)) from (select id, name, avatar_path, place, bio from profiles where id = any (array(select id from who))) t), '[]'::jsonb),
    -- Friends, requests and invites: accounts only (a guest has none), as the app asked before
    'friend_state',   case when public.is_signed_in() then public.friend_state() end
  );
$$;
