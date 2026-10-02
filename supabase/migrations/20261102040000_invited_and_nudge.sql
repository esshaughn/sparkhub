-- Invited and Nudge (Claude Design v7, Update 15 sixth pass; the owner's calls, 2026-10-02).
-- The lead's Leading card counts who's been invited, and Who's coming lists the people invited who haven't
-- replied, each with a Nudge: a fixed note (*{Lead} is hoping you can make {event}. Going, Maybe or Can't?*),
-- once a day per person.
--
-- Until now an invite row was readable only by the person invited and whoever invited them. Now the event's hosts
-- (the lead and co-leads) read every invite to it, so the count and the list include invites sent by people going.
-- event_invites.nudged_at records the last nudge; it changes only through nudge_invitee().

alter table public.event_invites add column nudged_at timestamptz;

create policy "hosts see their event's invites" on public.event_invites
  for select to authenticated using (public.is_host(spark_id));

-- Nudge one person who was invited and hasn't replied. Returns false (and sends nothing) when they were already
-- nudged today (Central time, like the reminders).
create or replace function public.nudge_invitee(p_spark uuid, p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  s record; v_at timestamptz; v_today date := (now() at time zone 'America/Chicago')::date; v_body text;
begin
  if not public.is_signed_in() or not public.is_host(p_spark) then raise exception 'only a lead can nudge' using errcode = '42501'; end if;
  select id, text, planned, cancelled_at, day_date, demo, test into s from sparks where id = p_spark;
  if s.id is null or not s.planned or s.cancelled_at is not null then raise exception 'this event isn''t taking replies' using errcode = '22023'; end if;
  if s.day_date is not null and s.day_date < v_today then raise exception 'that event has passed' using errcode = '22023'; end if;
  select nudged_at into v_at from event_invites where spark_id = p_spark and user_id = p_user for update;
  if not found then raise exception 'they weren''t invited' using errcode = '22023'; end if;
  if exists (select 1 from rsvps where spark_id = p_spark and user_id = p_user) then raise exception 'they already replied' using errcode = '22023'; end if;
  if v_at is not null and (v_at at time zone 'America/Chicago')::date = v_today then return false; end if;
  update event_invites set nudged_at = now() where spark_id = p_spark and user_id = p_user;
  -- Test and demo events stay quiet (as every other note and push)
  if s.demo or coalesce(s.test, false) then return true; end if;
  v_body := left(private.person_name(auth.uid(), p_spark) || ' is hoping you can make ' || left(s.text, 160) || '. Going, Maybe or Can’t?', 320);
  insert into notes (user_id, body, created_by) values (p_user, v_body, auth.uid());
  perform private.push_send(array[p_user], 'friends', s.text, v_body, '/#/idea/' || s.id, 'nu:' || s.id);
  return true;
end $$;
revoke execute on function public.nudge_invitee(uuid, uuid) from public, anon;
grant execute on function public.nudge_invitee(uuid, uuid) to authenticated;

-- The app's one request carries the invites the caller can read (otherwise the same as 20261102020000_float_and_ask.sql)
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
  las as materialized (select spark_id, user_id, asked_by, created_at from lead_asks),
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
