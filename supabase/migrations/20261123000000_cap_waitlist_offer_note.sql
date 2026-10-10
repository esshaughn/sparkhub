-- Design v8-18 (2026-10-10), items 2–4:
--  * Limit RSVPs (2): the lead sets sparks.cap (2–500 in the app) in Plan an event or Edit event; a client update grant.
--  * At the cap (3): the cap counts Going only, plus-ones included; hosts are never capped. A reply that would go past
--    it is refused (23514 'full: …'), and people join event_waits instead. When someone going drops to Maybe or Can't
--    (or their plus-ones go down, or the cap rises or goes), the first in line moves to Going on their own, with a quiet
--    note and a push, like the sign-up waitlists (fill_from_waitlist). Only replies people write themselves are checked
--    (current_user = 'authenticated'), so make_plan, the sign-up waitlist and other functions never fail on it.
--  * Offer to lead with a note (4): interests.offer_note (≤ 120), written on your own row with the offer; the starter's
--    push carries it.
--  * load_all() carries event_waits and offer_note.

-- 2. Limit RSVPs ---------------------------------------------------------------------------------------------------
grant update (cap) on table public.sparks to authenticated;

-- 3. The event waitlist -------------------------------------------------------------------------------------------
create table if not exists public.event_waits (
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (spark_id, user_id)
);
create index if not exists event_waits_user on public.event_waits (user_id);
alter table public.event_waits enable row level security;
drop policy if exists "event waits follow the event" on public.event_waits;
create policy "event waits follow the event" on public.event_waits for select to authenticated
  using (public.can_see_spark(spark_id));
drop policy if exists "join the event waitlist" on public.event_waits;
create policy "join the event waitlist" on public.event_waits for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_spark(spark_id));
drop policy if exists "leave the event waitlist" on public.event_waits;
create policy "leave the event waitlist" on public.event_waits for delete to authenticated
  using (user_id = auth.uid() or public.is_host(spark_id));
revoke all on table public.event_waits from anon, authenticated;
grant select, delete on table public.event_waits to authenticated;
grant insert (spark_id, user_id) on table public.event_waits to authenticated;   -- not created_at: no jumping the line

-- How many are going, plus-ones included (hosts count, like the cards' N spots left, though they're never refused),
-- leaving one person out (their own row is being written)
create or replace function private.going_count(p_spark uuid, p_except uuid default null) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(1 + coalesce(plus_count, 0)), 0)::integer from rsvps
   where spark_id = p_spark and status = 'going' and user_id is distinct from p_except;
$$;
revoke all on function private.going_count(uuid, uuid) from public, anon, authenticated;

-- Joining the waitlist: only a planned, uncancelled event with a cap that's full, and not if you're going already
create or replace function private.check_event_wait() returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select id, cap, planned, cancelled_at into s from sparks where id = new.spark_id;
  if s.id is null or s.cap is null or not s.planned or s.cancelled_at is not null then
    raise exception 'this event has no waitlist' using errcode = '23514';
  end if;
  if exists (select 1 from rsvps where spark_id = new.spark_id and user_id = new.user_id and status = 'going') then
    raise exception 'you''re going already' using errcode = '23514';
  end if;
  if private.going_count(new.spark_id) < s.cap then
    raise exception 'there''s room: RSVP Going instead' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.check_event_wait() from public, anon, authenticated;
drop trigger if exists check_event_wait on public.event_waits;
create trigger check_event_wait before insert on public.event_waits for each row execute function private.check_event_wait();

-- The cap on replies people write themselves (hosts aren't capped; a reply that doesn't add people always saves).
-- The trigger runs as the caller (so current_user tells a person's own write from a function's); the count needs
-- every reply, so it asks rsvp_room_for(), which runs as its owner and answers only yes or no
create or replace function public.rsvp_room_for(p_spark uuid, p_user uuid, p_add integer) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select s.cap is null or p_user = any(private.host_ids(s.id)) or private.going_count(s.id, p_user) + p_add <= s.cap
                     from sparks s where s.id = p_spark), true);
$$;
revoke all on function public.rsvp_room_for(uuid, uuid, integer) from public, anon;
grant execute on function public.rsvp_room_for(uuid, uuid, integer) to authenticated;
create or replace function private.rsvp_cap() returns trigger language plpgsql as $$
declare v_was integer := 0; v_now integer;
begin
  if current_user <> 'authenticated' or new.status <> 'going' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'going' then v_was := 1 + coalesce(old.plus_count, 0); end if;
  v_now := 1 + coalesce(new.plus_count, 0);
  if v_now > v_was and not public.rsvp_room_for(new.spark_id, new.user_id, v_now) then
    raise exception 'full: this event is full' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists rsvp_cap on public.rsvps;
create trigger rsvp_cap before insert or update on public.rsvps for each row execute function private.rsvp_cap();

-- The first in line moves up while there's room (in order: someone whose party doesn't fit holds the line)
create or replace function private.fill_event_waitlist(p_spark uuid) returns void language plpgsql security definer set search_path = public as $$
declare s record; w record; v_plus integer;
begin
  select id, text, cap, planned, cancelled_at, demo, test into s from sparks where id = p_spark;
  if s.id is null or not s.planned or s.cancelled_at is not null then return; end if;
  for w in select user_id from event_waits where spark_id = p_spark order by created_at loop
    select coalesce(plus_count, 0) into v_plus from rsvps where spark_id = p_spark and user_id = w.user_id;
    exit when s.cap is not null and private.going_count(p_spark) + 1 + coalesce(v_plus, 0) > s.cap;
    insert into rsvps (spark_id, user_id, status) values (p_spark, w.user_id, 'going')
      on conflict (spark_id, user_id) do update set status = 'going';
    delete from event_waits where spark_id = p_spark and user_id = w.user_id;
    insert into notes (user_id, body, created_by, quiet)
      values (w.user_id, left('A spot opened: you’re going to ' || left(s.text, 120) || '.', 320), auth.uid(), true);
    if not (s.demo or coalesce(s.test, false)) then
      perform private.push_send(array[w.user_id], 'reminders', s.text, 'A spot opened: you’re going', '/#/idea/' || s.id, 'ew:' || s.id || ':' || w.user_id);
    end if;
  end loop;
end $$;
revoke all on function private.fill_event_waitlist(uuid) from public, anon, authenticated;

-- Someone going drops (or brings fewer people), or a reply goes: room may have opened
create or replace function private.rsvp_room() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'going' then perform private.fill_event_waitlist(old.spark_id); end if;
    return null;
  end if;
  -- Going now: off the waitlist
  if new.status = 'going' then delete from event_waits where spark_id = new.spark_id and user_id = new.user_id; end if;
  if old.status = 'going' and (new.status <> 'going' or coalesce(new.plus_count, 0) < coalesce(old.plus_count, 0)) then
    perform private.fill_event_waitlist(new.spark_id);
  end if;
  return null;
end $$;
revoke all on function private.rsvp_room() from public, anon, authenticated;
drop trigger if exists rsvp_room on public.rsvps;
create trigger rsvp_room after update or delete on public.rsvps for each row execute function private.rsvp_room();
create or replace function private.rsvp_going_unwait() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'going' then delete from event_waits where spark_id = new.spark_id and user_id = new.user_id; end if;
  return null;
end $$;
revoke all on function private.rsvp_going_unwait() from public, anon, authenticated;
drop trigger if exists rsvp_going_unwait on public.rsvps;
create trigger rsvp_going_unwait after insert on public.rsvps for each row execute function private.rsvp_going_unwait();

-- The lead raises the cap or takes it off: the line moves up
create or replace function private.cap_room() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.cap is null or (old.cap is not null and new.cap > old.cap) then perform private.fill_event_waitlist(new.id); end if;
  if new.cap is null then delete from event_waits where spark_id = new.id; end if;
  return null;
end $$;
revoke all on function private.cap_room() from public, anon, authenticated;
drop trigger if exists cap_room on public.sparks;
create trigger cap_room after update of cap on public.sparks for each row execute function private.cap_room();

-- 4. Offer to lead with a note ------------------------------------------------------------------------------------
alter table public.interests add column if not exists offer_note text;
alter table public.interests drop constraint if exists interests_offer_note_ok;
alter table public.interests add constraint interests_offer_note_ok check (offer_note is null or char_length(offer_note) <= 120);
grant update (offer_note) on table public.interests to authenticated;

-- (otherwise as 20261111000000_idea_handoffs.sql) the push carries the note: Dee offered to lead Porch concert: "…"
create or replace function private.push_lead_offer() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; hosts uuid[];
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() or not new.can_help then return null; end if;
  if tg_op = 'UPDATE' and old.can_help then return null; end if;
  select id, text, planned, cancelled_at into s from sparks where id = new.spark_id;
  if s.id is null or s.planned or s.cancelled_at is not null then return null; end if;
  hosts := array(select h from unnest(private.host_ids(s.id)) h where h <> new.user_id);
  perform private.push_send(hosts, 'hosting', s.text, private.person_name(new.user_id, s.id) || ' offered to lead ' || s.text ||
      coalesce(': “' || nullif(btrim(new.offer_note), '') || '”', ''),
    '/#/idea/' || s.id, 'i:' || s.id || ':' || new.user_id);
  return null;
end $$;
revoke all on function private.push_lead_offer() from public, anon, authenticated;
drop trigger if exists push_lead_offer on public.interests;
create trigger push_lead_offer after insert or update of can_help on public.interests
  for each row execute function private.push_lead_offer();

-- load_all() (otherwise as 20261119000000_one_kind_of_signup.sql): offer_note and event_waits
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

-- Realtime (as 20261121020000_realtime.sql): the event waitlist too
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_waits') then
    alter publication supabase_realtime add table public.event_waits;
  end if;
end $$;
