-- Float an idea (Design v8-4 §5 and v8-5 items 3–6): the two-page Float sheet and the starter's idea page.
--   talk       the starter's "Talk it through with someone?" (people can offer to brainstorm); off by default
--   lead_rule  "Who leads it": 'me' (I decide: people offer, the starter picks) or 'any' (the first to step up leads)
--   overview   the SHORT DESCRIPTION is up to 120 characters (it was 80)
--   day_part   a date option's time can be Morning, Afternoon or Evening instead of a clock time (the time chips:
--              Any time · Set time / Morning · Afternoon · Evening); day_time stays for Set time
alter table public.sparks
  add column if not exists talk boolean not null default false,
  add column if not exists lead_rule text not null default 'me';
alter table public.sparks drop constraint if exists sparks_lead_rule_check;
alter table public.sparks add constraint sparks_lead_rule_check check (lead_rule in ('me', 'any'));
grant update (talk, lead_rule) on table public.sparks to authenticated;

alter table public.sparks drop constraint if exists sparks_overview_check;
alter table public.sparks add constraint sparks_overview_check
  check (overview is null or (char_length(overview) between 1 and 120));

alter table public.date_options add column if not exists day_part text;
alter table public.date_options drop constraint if exists date_options_day_part_check;
alter table public.date_options add constraint date_options_day_part_check
  check (day_part is null or (day_part in ('morning', 'afternoon', 'evening') and day_time is null));

-- Talk it through (v8-4 §4): a member taps Contact {starter} on an idea whose starter said yes to Talk it through.
-- The starter gets a note (and so a push); the member's tap is kept so the button reads "✓ {first} will be in touch".
-- Only offer_to_talk writes; you see your own offers, and the starter sees the offers on their ideas.
create table if not exists public.talk_offers (
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (spark_id, user_id)
);
alter table public.talk_offers enable row level security;
create policy "your talk offers, or the ones on your ideas" on public.talk_offers
  for select to authenticated using (user_id = auth.uid() or exists (select 1 from public.sparks s where s.id = spark_id and s.created_by = auth.uid()));
revoke all on table public.talk_offers from anon, authenticated;   -- new tables come with every privilege by default
grant select on table public.talk_offers to authenticated;

create or replace function public.offer_to_talk(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_name text;
begin
  select id, text, created_by, talk, planned, cancelled_at into s from sparks where id = p_spark;
  if s.id is null or not public.can_see_spark(p_spark) or not public.is_signed_in() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not s.talk or s.planned or s.cancelled_at is not null or s.created_by is null or s.created_by = auth.uid() then
    raise exception 'this idea isn''t looking for someone to talk it through' using errcode = '23514';
  end if;
  if exists (select 1 from talk_offers where spark_id = p_spark and user_id = auth.uid()) then return; end if;
  if not exists (select 1 from private.rate_exempt where user_id = auth.uid()) and not private.rate_ok(auth.uid(), 'talk', 10, interval '1 hour') then
    raise exception 'rate limit: too many at once, try again in a while' using errcode = 'PT429';
  end if;
  insert into talk_offers (spark_id, user_id) values (p_spark, auth.uid());
  select coalesce(nullif(p.name, ''), 'Someone') into v_name from profiles p where p.id = auth.uid();
  insert into notes (user_id, body, created_by)
    values (s.created_by, left(coalesce(v_name, 'Someone') || ' would like to talk through ' || left(s.text, 120) || ' with you.', 320), auth.uid());
end $$;
revoke execute on function public.offer_to_talk(uuid) from public, anon;
grant execute on function public.offer_to_talk(uuid) to authenticated;

-- One request loads the app: date options now carry their day part, and Talk it through's offers come along
create or replace function public.load_all() returns jsonb
language sql stable security invoker set search_path = public as $$
  with
  sp  as materialized (select s.* from sparks s),
  ofr as materialized (select o.* from offers o),
  itr as materialized (select spark_id, user_id, created_at, can_help from interests),
  rsv as materialized (select spark_id, user_id, status, created_at, attended from rsvps),
  coh as materialized (select spark_id, user_id, created_at from cohosts),
  scl as materialized (select item_id, user_id, note, created_at from signup_claims),
  swt as materialized (select item_id, user_id, created_at from signup_waits),
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
    'groups',         coalesce((select jsonb_agg(to_jsonb(t)) from (select id, name, photo, photo_pos, demo from groups) t), '[]'::jsonb),
    'sparks',         coalesce((select jsonb_agg(to_jsonb(sp) order by sp.created_at desc) from sp), '[]'::jsonb),
    'offers',         coalesce((select jsonb_agg(to_jsonb(ofr) order by ofr.created_at) from ofr), '[]'::jsonb),
    'interests',      coalesce((select jsonb_agg(to_jsonb(itr)) from itr), '[]'::jsonb),
    'guest_contacts', coalesce((select jsonb_agg(to_jsonb(t)) from (select spark_id, user_id, name, phone from guest_contacts) t), '[]'::jsonb),
    'rsvps',          coalesce((select jsonb_agg(to_jsonb(rsv)) from rsv), '[]'::jsonb),
    'date_options',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, day_date, day_time, day_part, who, created_by, created_at from date_options) t), '[]'::jsonb),
    'date_votes',     coalesce((select jsonb_agg(to_jsonb(t)) from (select option_id, user_id from date_votes) t), '[]'::jsonb),
    'spot_options',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, name, address, lat, lon, who, created_by, created_at from spot_options) t), '[]'::jsonb),
    'spot_votes',     coalesce((select jsonb_agg(to_jsonb(t)) from (select option_id, user_id from spot_votes) t), '[]'::jsonb),
    'signup_items',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, item, need, time, end_time, descr, shift_of, kind, waitlist, per_person, created_by, created_at from signup_items) t), '[]'::jsonb),
    'signup_claims',  coalesce((select jsonb_agg(to_jsonb(scl)) from scl), '[]'::jsonb),
    'signup_waits',   coalesce((select jsonb_agg(to_jsonb(swt) order by swt.created_at) from swt), '[]'::jsonb),
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
