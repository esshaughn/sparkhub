-- A note with an ask (research, 2026-10-02: Cynthia got a yes from a personal ask and silence from the same post to
-- everyone). Inviting someone to an event, or asking someone to lead, can carry one line on why them (up to 140
-- characters). It goes in their push and shows under the bell row. The note is optional; the app asks for it.

alter table public.event_invites add column message text check (message is null or char_length(message) between 1 and 140);
alter table public.lead_asks add column message text check (message is null or char_length(message) between 1 and 140);

-- 1. invite_friends(): the same as 20261101170000_invite_people.sql, plus p_message
drop function public.invite_friends(uuid, uuid[]);
create function public.invite_friends(p_spark uuid, p_people uuid[], p_message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid(); s record; p uuid;
  v_invited uuid[] := '{}'; v_going uuid[] := '{}'; v_already uuid[] := '{}';
  v_name text; v_msg text := left(nullif(btrim(coalesce(p_message, '')), ''), 140);
begin
  if not public.is_signed_in() then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_people is null or cardinality(p_people) = 0 then return jsonb_build_object('invited', '[]'::jsonb, 'going', '[]'::jsonb, 'already', '[]'::jsonb); end if;
  if cardinality(p_people) > 30 then raise exception 'too many at once' using errcode = '22023'; end if;
  select id, text, lead_id, group_id, planned, guest_invites, cancelled_at, day_date, day_time, spot into s from sparks where id = p_spark;
  if s.id is null or not public.can_see_spark(p_spark) then raise exception 'no such event' using errcode = '22023'; end if;
  if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '22023'; end if;
  if not private.can_invite(p_spark) then raise exception 'the lead hasn''t turned on guest invites' using errcode = '42501'; end if;
  foreach p in array coalesce((select array_agg(distinct x) from unnest(p_people) x where x is not null), '{}') loop
    if p = v_me or not private.invitable(p_spark, p) then continue; end if;
    if p = any(private.host_ids(p_spark)) or exists (select 1 from rsvps r where r.spark_id = p_spark and r.user_id = p and r.status = 'going') then
      v_going := v_going || p;
    elsif exists (select 1 from event_invites i where i.spark_id = p_spark and i.user_id = p) then
      v_already := v_already || p;
    else
      insert into event_invites (spark_id, user_id, invited_by, message) values (p_spark, p, v_me, v_msg);
      insert into link_access (user_id, spark_id, via) values (p, p_spark, 'invite')
        on conflict (user_id, spark_id) do update set via = 'invite';
      v_invited := v_invited || p;
    end if;
  end loop;
  if cardinality(v_invited) > 0 then
    v_name := private.person_name(v_me, p_spark);
    perform private.push_send(v_invited, 'friends', v_name || ' invited you to ' || s.text,
      case when v_msg is not null then '“' || v_msg || '” ' else '' end || private.when_text(s.day_date, s.day_time, s.spot) || '. RSVP in Spark Hub.', '/#/idea/' || s.id, 'fi:' || s.id);
  end if;
  return jsonb_build_object('invited', to_jsonb(v_invited), 'going', to_jsonb(v_going), 'already', to_jsonb(v_already));
end $$;
revoke execute on function public.invite_friends(uuid, uuid[], text) from public, anon;
grant execute on function public.invite_friends(uuid, uuid[], text) to authenticated;

-- 2. ask_to_lead(): the same as 20261102020000_float_and_ask.sql, plus p_message
drop function public.ask_to_lead(uuid, uuid);
create function public.ask_to_lead(p_spark uuid, p_user uuid, p_message text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_name text; v_msg text := left(nullif(btrim(coalesce(p_message, '')), ''), 140);
begin
  select id, text, lead_id, group_id, visibility, wants_host, planned, cancelled_at into s from sparks where id = p_spark;
  if s.id is null or not (public.is_host(p_spark) or public.is_admin(s.group_id)) then
    raise exception 'only a lead can ask someone to lead' using errcode = '42501';
  end if;
  if not s.wants_host or s.planned or s.cancelled_at is not null then
    raise exception 'this idea isn''t looking for a lead' using errcode = '23514';
  end if;
  if p_user is null or p_user = auth.uid() or p_user = s.lead_id then
    raise exception 'ask someone else' using errcode = '22023';
  end if;
  -- An account (not a guest) in one of the event's groups: the same people who may take the lead
  if not exists (select 1 from auth.users u where u.id = p_user and not coalesce(u.is_anonymous, false))
     or not private.in_event_groups(p_spark, p_user) then
    raise exception 'leads come from the event''s groups' using errcode = '22023';
  end if;
  if exists (select 1 from lead_asks where spark_id = p_spark and user_id = p_user) then return; end if;   -- asked already: no second push
  if (select count(*) from lead_asks where spark_id = p_spark) >= 10 then
    raise exception 'up to 10 asks at a time' using errcode = '22023';
  end if;
  insert into lead_asks (spark_id, user_id, asked_by, message) values (p_spark, p_user, auth.uid(), v_msg);
  -- An invite-only idea: the ask lets them see it, like an invite
  if s.visibility <> 'group' then
    insert into link_access (user_id, spark_id, via) values (p_user, p_spark, 'invite') on conflict (user_id, spark_id) do nothing;
  end if;
  v_name := private.person_name(auth.uid(), p_spark);
  perform private.push_send(array[p_user], 'friends', v_name || ' asked if you’d lead ' || left(s.text, 120),
    coalesce('“' || v_msg || '” ', '') || 'Take a look. If you’re up for it, tap I’ll lead.', '/#/idea/' || s.id, 'la:' || s.id);
end $$;
revoke execute on function public.ask_to_lead(uuid, uuid, text) from public, anon;
grant execute on function public.ask_to_lead(uuid, uuid, text) to authenticated;

-- 3. friend_state(): invites you've had carry their note (otherwise the same as 20261030000000_friends.sql)
create or replace function public.friend_state()
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  fr as (
    select case when f.user_a = me.id then f.user_b else f.user_a end as id, f.created_at
      from friendships f, me where me.id in (f.user_a, f.user_b)
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
        from event_invites i where i.user_id = (select id from me) and i.created_at > now() - interval '60 days'), '[]'::jsonb)
  );
$$;
revoke execute on function public.friend_state() from public, anon;
grant execute on function public.friend_state() to authenticated;

-- 4. load_all(): asks to lead carry their note (otherwise the same as 20261102040000_invited_and_nudge.sql)
create or replace function public.load_all() returns jsonb
language sql stable security invoker set search_path = public as $$
  with
  sp  as materialized (select s.* from sparks s),
  ofr as materialized (select o.* from offers o),
  itr as materialized (select spark_id, user_id, created_at, can_help from interests),
  rsv as materialized (select spark_id, user_id, status, created_at, attended from rsvps),
  coh as materialized (select spark_id, user_id, created_at from cohosts),
  scl as materialized (select item_id, user_id, note, created_at from signup_claims),
  rct as materialized (select spark_id, user_id, kind from reactions),
  nts as materialized (select id, body, created_by, created_at from notes order by created_at desc limit 50),
  las as materialized (select spark_id, user_id, asked_by, created_at, message from lead_asks),
  inv as materialized (select spark_id, user_id, invited_by, created_at, nudged_at from event_invites),
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
    union select user_id from rct
    union select created_by from nts
    union select user_id from las
    union select asked_by from las
    union select user_id from inv
  )
  select jsonb_build_object(
    'memberships',    coalesce((select jsonb_agg(to_jsonb(t)) from (select group_id, role, last_seen_at, pinned from memberships) t), '[]'::jsonb),
    'groups',         coalesce((select jsonb_agg(to_jsonb(t)) from (select id, name, photo, photo_pos, demo from groups) t), '[]'::jsonb),
    'sparks',         coalesce((select jsonb_agg(to_jsonb(sp) order by sp.created_at desc) from sp), '[]'::jsonb),
    'offers',         coalesce((select jsonb_agg(to_jsonb(ofr) order by ofr.created_at) from ofr), '[]'::jsonb),
    'interests',      coalesce((select jsonb_agg(to_jsonb(itr)) from itr), '[]'::jsonb),
    'guest_contacts', coalesce((select jsonb_agg(to_jsonb(t)) from (select spark_id, user_id, name, phone from guest_contacts) t), '[]'::jsonb),
    'rsvps',          coalesce((select jsonb_agg(to_jsonb(rsv)) from rsv), '[]'::jsonb),
    'date_options',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, day_date, day_time, who, created_by, created_at from date_options) t), '[]'::jsonb),
    'date_votes',     coalesce((select jsonb_agg(to_jsonb(t)) from (select option_id, user_id from date_votes) t), '[]'::jsonb),
    'spot_options',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, name, address, lat, lon, who, created_by, created_at from spot_options) t), '[]'::jsonb),
    'spot_votes',     coalesce((select jsonb_agg(to_jsonb(t)) from (select option_id, user_id from spot_votes) t), '[]'::jsonb),
    'signup_items',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, item, need, time, end_time, descr, shift_of, created_by, created_at from signup_items) t), '[]'::jsonb),
    'signup_claims',  coalesce((select jsonb_agg(to_jsonb(scl)) from scl), '[]'::jsonb),
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
    'profiles',       coalesce((select jsonb_agg(to_jsonb(t)) from (select id, name, avatar_path, place, bio from profiles where id = any (array(select id from who))) t), '[]'::jsonb),
    -- Friends, requests and invites: accounts only (a guest has none), as the app asked before
    'friend_state',   case when public.is_signed_in() then public.friend_state() end
  );
$$;
revoke execute on function public.load_all() from public, anon;
grant execute on function public.load_all() to authenticated;
