-- Communities (owner, 2026-10-11/12): a group becomes a community tied to a physical place, with a purpose and a
-- plan. The table keeps its name (groups) so nothing else changes. All new columns are optional for now: the four
-- existing groups get their places by hand, and Start a community will ask for them in the app.
--   place_*:   where it is (a name like "Woodcliff", a kind, an optional pin and radius; a pin is never copied
--              from Google, whose terms don't allow keeping its coordinates)
--   purpose:   what it's for, in a line
--   plan:      seed (free) / neighborhood / active; no client writes (WAN sets it)
--   sponsored: a plan paid by a sponsor or the Sponsor a neighborhood fund; no client writes

alter table public.groups
  add column place_name text check (char_length(btrim(place_name)) between 1 and 60),
  add column place_kind text check (place_kind in ('neighborhood', 'school', 'building', 'park', 'other')),
  add column place_lat double precision check (place_lat between -90 and 90),
  add column place_lon double precision check (place_lon between -180 and 180),
  add column place_radius_m integer check (place_radius_m between 50 and 50000),
  add column purpose text check (char_length(btrim(purpose)) between 1 and 200),
  add column plan text not null default 'seed' check (plan in ('seed', 'neighborhood', 'active')),
  add column sponsored boolean not null default false,
  add constraint groups_pin_whole check ((place_lat is null) = (place_lon is null));
-- groups is read column by column (code stays hidden), so the new columns need their own grant
grant select (place_name, place_kind, place_lat, place_lon, place_radius_m, purpose, plan, sponsored) on public.groups to authenticated;

-- Owners and admins set the place and purpose (nulls clear them; a pin needs both coordinates)
create or replace function public.set_community_place(p_group uuid, p_name text, p_kind text default null,
  p_lat double precision default null, p_lon double precision default null, p_radius_m integer default null,
  p_purpose text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_group) then raise exception 'only the community''s admins can change this' using errcode = '42501'; end if;
  update groups set place_name = nullif(btrim(p_name), ''), place_kind = p_kind,
                    place_lat = p_lat, place_lon = p_lon, place_radius_m = p_radius_m,
                    purpose = nullif(btrim(p_purpose), '')
   where id = p_group;
end $$;
revoke all on function public.set_community_place(uuid, text, text, double precision, double precision, integer, text) from public, anon;
grant execute on function public.set_community_place(uuid, text, text, double precision, double precision, integer, text) to authenticated;

-- Active members: a member who opened the community in the last 30 days, or replied, said they're interested or
-- signed up for one of its events in that time. Tiers will count these, not everyone who ever joined.
create or replace function private.active_member_ids(p_group uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select m.user_id from memberships m
   where m.group_id = p_group
     and (m.last_seen_at > now() - interval '30 days'
          or exists (select 1 from rsvps r join sparks s on s.id = r.spark_id
                      where r.user_id = m.user_id and r.created_at > now() - interval '30 days'
                        and (s.group_id = p_group or exists (select 1 from spark_groups g where g.spark_id = s.id and g.group_id = p_group)))
          or exists (select 1 from interests i join sparks s on s.id = i.spark_id
                      where i.user_id = m.user_id and i.created_at > now() - interval '30 days'
                        and (s.group_id = p_group or exists (select 1 from spark_groups g where g.spark_id = s.id and g.group_id = p_group)))
          or exists (select 1 from signup_claims c join signup_items t on t.id = c.item_id join sparks s on s.id = t.spark_id
                      where c.user_id = m.user_id and c.created_at > now() - interval '30 days'
                        and (s.group_id = p_group or exists (select 1 from spark_groups g where g.spark_id = s.id and g.group_id = p_group))));
$$;

-- What a community's admins see about it: its size, its active members, its plan, and how many private gatherings
-- its members started in the last 30 days. Only that count: never names, titles or guests (owner, 2026-10-11).
create or replace function public.community_stats(p_group uuid)
returns table (members integer, active_members integer, plan text, sponsored boolean, private_gatherings_30d integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin(p_group) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select (select count(*)::int from memberships m where m.group_id = p_group),
         (select count(*)::int from private.active_member_ids(p_group)),
         g.plan, g.sponsored,
         (select count(*)::int from sparks s
           where s.group_id = p_group and s.visibility = 'invite' and not s.test
             and s.created_at > now() - interval '30 days')
    from groups g where g.id = p_group;
end $$;
revoke all on function public.community_stats(uuid) from public, anon;
grant execute on function public.community_stats(uuid) to authenticated;

-- Beta measurement for the app owner (owner, 2026-10-11: measure 60 days before setting caps): per month, events by
-- kind, how many people go to private ones, and how big lists are. Counts only, no names.
create or replace function public.beta_metrics(p_months integer default 6)
returns table (month date, community_events integer, community_private integer, personal_events integer,
               private_going_avg numeric, private_going_max integer, private_over_20 integer,
               lists integer, list_size_avg numeric, list_size_max integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_app_owner() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  with months as (
    select generate_series(date_trunc('month', now()) - make_interval(months => greatest(1, least(p_months, 24)) - 1),
                           date_trunc('month', now()), interval '1 month')::date as m
  ), ev as (
    select date_trunc('month', s.created_at)::date as m, s.id, s.group_id, s.visibility, s.planned,
           (select coalesce(sum(1 + coalesce(r.plus_count, 0)), 0)::int from rsvps r where r.spark_id = s.id and r.status = 'going') as going
      from sparks s where not s.test and not s.demo and left(s.text, 5) <> '[E2E]'
  ), ls as (
    select date_trunc('month', l.created_at)::date as m, cardinality(l.people) as n from lists l
  )
  select months.m,
         (select count(*)::int from ev where ev.m = months.m and ev.group_id is not null and ev.visibility = 'group'),
         (select count(*)::int from ev where ev.m = months.m and ev.group_id is not null and ev.visibility = 'invite'),
         (select count(*)::int from ev where ev.m = months.m and ev.group_id is null),
         (select round(avg(going), 1) from ev where ev.m = months.m and ev.visibility = 'invite' and ev.planned),
         (select max(going) from ev where ev.m = months.m and ev.visibility = 'invite' and ev.planned),
         (select count(*)::int from ev where ev.m = months.m and ev.visibility = 'invite' and ev.going > 20),
         (select count(*)::int from ls where ls.m = months.m),
         (select round(avg(n), 1) from ls where ls.m = months.m),
         (select max(n) from ls where ls.m = months.m)
    from months order by months.m;
end $$;
revoke all on function public.beta_metrics(integer) from public, anon;
grant execute on function public.beta_metrics(integer) to authenticated;

-- The app loads the new columns with every group
create or replace function public.load_all()
returns jsonb language sql stable set search_path = public as $$
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
    'groups',         coalesce((select jsonb_agg(to_jsonb(t)) from (select id, name, photo, photo_pos, demo, members_can_invite,
                                                                            place_name, place_kind, place_lat, place_lon, place_radius_m, purpose, plan, sponsored from groups) t), '[]'::jsonb),
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
