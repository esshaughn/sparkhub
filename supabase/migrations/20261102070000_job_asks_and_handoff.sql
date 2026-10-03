-- Asking someone to take a job, and handing the lead to someone (the owner, 2026-10-02, after Cynthia's demo: a
-- personal ask to Lindsay for barricades got a yes where the same post to everyone got silence).
--
-- 1. Job asks: on a job (no shifts yet), a lead asks one person at a time, two open asks per job at most, and each
--    ask carries the lead's finished "I thought of you because…" line. The person answers I'm in (signed up, and
--    Going on a plan) or Can't this time (the asker gets a quiet note). Taking the job the usual way also counts.
-- 2. Lead handover: the lead offers the lead to someone in the event's groups, with an optional note. Nothing changes
--    until they say yes; then they lead it and the old lead stays on as a co-lead. One open offer per event.
-- Both tables have no client writes; everything goes through the functions below.

create table public.job_asks (
  item_id     uuid not null references public.signup_items (id) on delete cascade,
  spark_id    uuid not null references public.sparks (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,   -- who was asked
  asked_by    uuid not null references auth.users (id) on delete cascade,
  message     text not null check (char_length(message) between 1 and 200),
  answer      text check (answer in ('in', 'cant')),
  created_at  timestamptz not null default now(),
  answered_at timestamptz,
  primary key (item_id, user_id)
);
create index job_asks_user on public.job_asks (user_id);
create index job_asks_spark on public.job_asks (spark_id);
alter table public.job_asks enable row level security;
create policy "your asks, or your event's" on public.job_asks
  for select to authenticated using (user_id = auth.uid() or public.is_host(spark_id));
revoke all on table public.job_asks from public, anon, authenticated;
grant select on table public.job_asks to authenticated;

create table public.lead_offers (
  spark_id    uuid primary key references public.sparks (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,   -- who it's offered to
  offered_by  uuid not null references auth.users (id) on delete cascade,
  message     text check (message is null or char_length(message) between 1 and 200),
  created_at  timestamptz not null default now()
);
create index lead_offers_user on public.lead_offers (user_id);
alter table public.lead_offers enable row level security;
create policy "offers you're part of" on public.lead_offers
  for select to authenticated using (user_id = auth.uid() or public.is_host(spark_id));
revoke all on table public.lead_offers from public, anon, authenticated;
grant select on table public.lead_offers to authenticated;

-- 1. Ask someone to take a job --------------------------------------------------------------------------------
create or replace function public.ask_for_job(p_item uuid, p_user uuid, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare
  it record; s record; v_msg text := left(nullif(btrim(coalesce(p_message, '')), ''), 200); v_name text;
  v_today date := (now() at time zone 'America/Chicago')::date;
begin
  select i.id, i.item, i.spark_id into it from signup_items i where i.id = p_item;
  if it.id is null or not public.is_host(it.spark_id) then raise exception 'only a lead can ask' using errcode = '42501'; end if;
  if exists (select 1 from signup_items where shift_of = p_item) then raise exception 'jobs with shifts can''t be asked for yet' using errcode = '22023'; end if;
  select id, text, cancelled_at, day_date, day_time, spot, visibility, demo, test into s from sparks where id = it.spark_id;
  if s.cancelled_at is not null or (s.day_date is not null and s.day_date < v_today) then
    raise exception 'this event isn''t taking sign-ups' using errcode = '22023';
  end if;
  if v_msg is null then raise exception 'say why them' using errcode = '22023'; end if;
  if p_user is null or p_user = auth.uid() or p_user = any(private.host_ids(s.id)) then raise exception 'ask someone else' using errcode = '22023'; end if;
  if not exists (select 1 from auth.users u where u.id = p_user and not coalesce(u.is_anonymous, false))
     or not private.invitable(s.id, p_user) then
    raise exception 'ask a friend or someone in the event''s groups' using errcode = '22023';
  end if;
  if exists (select 1 from signup_claims where item_id = p_item and user_id = p_user) then raise exception 'they''re already on it' using errcode = '22023'; end if;
  if exists (select 1 from job_asks where item_id = p_item and user_id = p_user) then raise exception 'you already asked them' using errcode = '22023'; end if;
  if (select count(*) from job_asks a where a.item_id = p_item and a.answered_at is null
        and not exists (select 1 from signup_claims c where c.item_id = a.item_id and c.user_id = a.user_id)) >= 2 then
    raise exception 'two asks at a time' using errcode = '22023';
  end if;
  insert into job_asks (item_id, spark_id, user_id, asked_by, message) values (p_item, s.id, p_user, auth.uid(), v_msg);
  if s.visibility <> 'group' then   -- an invite-only event: the ask lets them see it, like an invite
    insert into link_access (user_id, spark_id, via) values (p_user, s.id, 'invite') on conflict (user_id, spark_id) do nothing;
  end if;
  if not (s.demo or coalesce(s.test, false)) then
    v_name := private.person_name(auth.uid(), s.id);
    perform private.push_send(array[p_user], 'friends', v_name || ' asked if you’d take ' || left(it.item, 60),
      '“' || v_msg || '” ' || left(s.text, 120) || ' · ' || private.when_text(s.day_date, s.day_time, s.spot), '/#/idea/' || s.id, 'ja:' || p_item);
  end if;
end $$;
revoke execute on function public.ask_for_job(uuid, uuid, text) from public, anon;
grant execute on function public.ask_for_job(uuid, uuid, text) to authenticated;

create or replace function public.answer_job_ask(p_item uuid, p_in boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a record; it record; s record;
begin
  select * into a from job_asks where item_id = p_item and user_id = auth.uid() for update;
  if a.item_id is null then raise exception 'nobody asked you' using errcode = '22023'; end if;
  if a.answered_at is not null then return; end if;
  select id, item into it from signup_items where id = p_item;
  select id, text, planned, cancelled_at into s from sparks where id = a.spark_id;
  if p_in then
    if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '22023'; end if;
    insert into signup_claims (item_id, user_id) values (p_item, auth.uid()) on conflict (item_id, user_id) do nothing;   -- full: "that one's covered"
    if s.planned then
      insert into rsvps (spark_id, user_id, status) values (s.id, auth.uid(), 'going')
        on conflict (spark_id, user_id) do update set status = 'going';
    end if;
  else
    insert into notes (user_id, body, created_by)
      values (a.asked_by, left(private.person_name(auth.uid(), s.id) || ' can’t take ' || left(it.item, 60) || ' this time (' || left(s.text, 120) || ').', 320), auth.uid());
  end if;
  update job_asks set answer = case when p_in then 'in' else 'cant' end, answered_at = now() where item_id = p_item and user_id = auth.uid();
end $$;
revoke execute on function public.answer_job_ask(uuid, boolean) from public, anon;
grant execute on function public.answer_job_ask(uuid, boolean) to authenticated;

create or replace function public.withdraw_job_ask(p_item uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from job_asks where item_id = p_item and user_id = p_user and public.is_host(spark_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from job_asks where item_id = p_item and user_id = p_user and answered_at is null;
end $$;
revoke execute on function public.withdraw_job_ask(uuid, uuid) from public, anon;
grant execute on function public.withdraw_job_ask(uuid, uuid) to authenticated;

-- 2. Hand the lead to someone ---------------------------------------------------------------------------------
create or replace function public.offer_lead(p_spark uuid, p_user uuid, p_message text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_msg text := left(nullif(btrim(coalesce(p_message, '')), ''), 200); v_name text;
begin
  select id, text, lead_id, wants_host, cancelled_at, day_date, day_time, spot, demo, test into s from sparks where id = p_spark;
  if s.id is null or s.lead_id is distinct from auth.uid() then raise exception 'only the lead can hand it on' using errcode = '42501'; end if;
  if s.cancelled_at is not null or s.wants_host or (s.day_date is not null and s.day_date < (now() at time zone 'America/Chicago')::date) then
    raise exception 'this event can''t change hands' using errcode = '22023';
  end if;
  if p_user is null or p_user = auth.uid() then raise exception 'hand it to someone else' using errcode = '22023'; end if;
  if not exists (select 1 from auth.users u where u.id = p_user and not coalesce(u.is_anonymous, false))
     or not private.in_event_groups(p_spark, p_user) then
    raise exception 'leads come from the event''s groups' using errcode = '22023';
  end if;
  insert into lead_offers (spark_id, user_id, offered_by, message) values (p_spark, p_user, auth.uid(), v_msg)
    on conflict (spark_id) do update set user_id = excluded.user_id, offered_by = excluded.offered_by, message = excluded.message, created_at = now();
  if not (s.demo or coalesce(s.test, false)) then
    v_name := private.person_name(auth.uid(), p_spark);
    perform private.push_send(array[p_user], 'friends', v_name || ' asked if you’d take over leading ' || left(s.text, 120),
      coalesce('“' || v_msg || '” ', '') || 'You’d lead it, and ' || v_name || ' stays on as a co-lead.', '/#/idea/' || s.id, 'lo:' || s.id);
  end if;
end $$;
revoke execute on function public.offer_lead(uuid, uuid, text) from public, anon;
grant execute on function public.offer_lead(uuid, uuid, text) to authenticated;

create or replace function public.answer_lead_offer(p_spark uuid, p_yes boolean)
returns void language plpgsql security definer set search_path = public as $$
declare o record; s record; v_name text;
begin
  select * into o from lead_offers where spark_id = p_spark and user_id = auth.uid() for update;
  if o.spark_id is null then raise exception 'nobody offered you the lead' using errcode = '22023'; end if;
  select id, text, lead_id, planned, cancelled_at into s from sparks where id = p_spark for update;
  delete from lead_offers where spark_id = p_spark;
  v_name := private.person_name(auth.uid(), p_spark);
  if not p_yes or s.cancelled_at is not null then
    insert into notes (user_id, body, created_by)
      values (o.offered_by, left(v_name || ' can’t take over ' || left(s.text, 120) || ' right now.', 320), auth.uid());
    return;
  end if;
  if s.lead_id is distinct from o.offered_by then return; end if;   -- the lead changed since: the offer lapses
  delete from cohosts where spark_id = p_spark and user_id = auth.uid();
  update sparks set lead_id = auth.uid(), lead_name = coalesce((select nullif(p.name, '') from profiles p where p.id = auth.uid()), 'Someone'), wants_host = false where id = p_spark;
  insert into cohosts (spark_id, user_id, added_by) values (p_spark, o.offered_by, auth.uid()) on conflict (spark_id, user_id) do nothing;
  delete from interests where spark_id = p_spark and user_id = auth.uid();
  if s.planned then
    insert into rsvps (spark_id, user_id, status) values (p_spark, auth.uid(), 'going') on conflict (spark_id, user_id) do update set status = 'going';
  end if;
  insert into notes (user_id, body, created_by)
    values (o.offered_by, left(v_name || ' is leading ' || left(s.text, 120) || ' now. You’re a co-lead.', 320), auth.uid());
end $$;
revoke execute on function public.answer_lead_offer(uuid, boolean) from public, anon;
grant execute on function public.answer_lead_offer(uuid, boolean) to authenticated;

create or replace function public.withdraw_lead_offer(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from lead_offers where spark_id = p_spark and offered_by = auth.uid();
end $$;
revoke execute on function public.withdraw_lead_offer(uuid) from public, anon;
grant execute on function public.withdraw_lead_offer(uuid) to authenticated;

-- 3. The app's one request carries both (otherwise the same as 20261102050000_ask_notes.sql) -----------------
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
  jas as materialized (select item_id, spark_id, user_id, asked_by, message, answer, created_at, answered_at from job_asks),
  lof as materialized (select spark_id, user_id, offered_by, message, created_at from lead_offers),
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
    union select user_id from jas
    union select asked_by from jas
    union select user_id from lof
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
    'job_asks',       coalesce((select jsonb_agg(to_jsonb(jas) order by jas.created_at) from jas), '[]'::jsonb),
    'lead_offers',    coalesce((select jsonb_agg(to_jsonb(lof)) from lof), '[]'::jsonb),
    'profiles',       coalesce((select jsonb_agg(to_jsonb(t)) from (select id, name, avatar_path, place, bio from profiles where id = any (array(select id from who))) t), '[]'::jsonb),
    -- Friends, requests and invites: accounts only (a guest has none), as the app asked before
    'friend_state',   case when public.is_signed_in() then public.friend_state() end
  );
$$;
revoke execute on function public.load_all() from public, anon;
grant execute on function public.load_all() to authenticated;
