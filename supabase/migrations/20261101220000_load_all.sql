-- One request loads the app (owner, 2026-10-02). loadAll in js/sparks.js read 21 tables, then profiles and
-- friend_state(): about 24 requests on every page load and again after every write. A full test run sent
-- the free TEST instance 2,500+ requests a minute and froze it, and every request is a line of log
-- ingestion for real members too. load_all() gives the app the same rows in one answer.
--
-- security invoker: every table is read as the caller, so the row-level rules decide what comes back,
-- exactly as when the app read each table itself. It adds no access. Each key holds the columns the app
-- asked that table for; a new column the app needs is added here too (sparks and offers send every column).

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
    'profiles',       coalesce((select jsonb_agg(to_jsonb(t)) from (select id, name, avatar_path, place, bio from profiles where id = any (array(select id from who))) t), '[]'::jsonb),
    -- Friends, requests and invites: accounts only (a guest has none), as the app asked before
    'friend_state',   case when public.is_signed_in() then public.friend_state() end
  );
$$;

revoke execute on function public.load_all() from public, anon;
grant execute on function public.load_all() to authenticated;
