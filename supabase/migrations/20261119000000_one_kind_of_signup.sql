-- One kind of sign-up (owner, 2026-10-07): jobs and spots work the same way. Every item can have a waitlist and a
-- most-per-person limit, and guests (with a phone for that event) can take any item whose new `guests` option is on.
-- `kind` stays as stored (job / time / seat / other) but no rule depends on it any more, except who hears what:
--  * signup_items.guests (default true; a shift follows its parent): guest_can_take() checks it instead of kind <> 'job'.
--  * Jobs that existed before keep no waitlist (waitlist = false); new items get what the host picks.
--  * signup_waits: anyone may wait for a full item with its waitlist on (jobs too).
--  * check_signup_room: the per-person cap applies to jobs too.
--  * fill_from_waitlist / part_room / part_dropped: the waitlist moves up for jobs too (a job's hosts still hear from
--    claim_dropped, not part_dropped).
--  * push_parts: a job with its own time gets the same reminder as a spot.
--  * load_all() carries guests.

alter table public.signup_items add column if not exists guests boolean not null default true;
grant update (guests) on table public.signup_items to authenticated;
update public.signup_items set waitlist = false where kind = 'job';

create or replace function public.guest_can_take(p_item uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from signup_items i join signup_items j on j.id = coalesce(i.shift_of, i.id)
                   join guest_contacts g on g.spark_id = i.spark_id and g.user_id = auth.uid()
                  where i.id = p_item and j.guests and nullif(btrim(coalesce(g.phone, '')), '') is not null)
$$;

drop policy if exists "join a waitlist" on public.signup_waits;
create policy "join a waitlist" on public.signup_waits for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from signup_items i join signup_items j on j.id = coalesce(i.shift_of, i.id)
                           where i.id = item_id and public.can_see_spark(i.spark_id) and j.waitlist
                             and not exists (select 1 from signup_items k where k.shift_of = i.id))
              and (public.is_signed_in() or public.guest_can_take(item_id)));

-- (otherwise as 20261106000000_take_part.sql)
create or replace function public.check_signup_room() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_need integer; v_have integer; p record;
begin
  if exists (select 1 from signup_items where shift_of = new.item_id) then return null; end if;
  select need into v_need from signup_items where id = new.item_id;
  if v_need is not null then
    select count(*) into v_have from signup_claims where item_id = new.item_id;
    if v_have >= v_need then raise exception 'that one''s covered' using errcode = '23514'; end if;
  end if;
  select j.id, j.kind, j.per_person, j.item into p from signup_items i join signup_items j on j.id = coalesce(i.shift_of, i.id) where i.id = new.item_id;
  if p.per_person is not null
     and (select count(*) from signup_claims c join signup_items i on i.id = c.item_id
           where (i.id = p.id or i.shift_of = p.id) and c.user_id = new.user_id) >= p.per_person then
    raise exception 'per person: up to % per person for %', p.per_person, lower(p.item) using errcode = '23514';
  end if;
  return new;
end $$;


-- (otherwise as 20261118000000_one_push_and_full_asks.sql)
create or replace function private.fill_from_waitlist(p_item uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare i record; w record; s record; v_label text;
begin
  select id, spark_id, need, kind into i from signup_items where id = p_item;
  if i.id is null or i.need is null then return null; end if;   -- jobs too (20261119000000)
  select id, text, planned, cancelled_at, demo, test into s from sparks where id = i.spark_id;
  if s.cancelled_at is not null then return null; end if;
  for w in select user_id from signup_waits where item_id = p_item order by created_at loop
    exit when (select count(*) from signup_claims where item_id = p_item) >= i.need;
    begin
      insert into signup_claims (item_id, user_id) values (p_item, w.user_id);
    exception when sqlstate '23514' then continue;   -- over their cap now: the next in line
    end;
    delete from signup_waits where item_id = p_item and user_id = w.user_id;
    if s.planned then
      insert into rsvps (spark_id, user_id, status) values (s.id, w.user_id, 'going')
        on conflict (spark_id, user_id) do update set status = 'going';
    end if;
    v_label := private.part_label(p_item);
    insert into notes (user_id, body, created_by, quiet)
      values (w.user_id, left('You’re in: ' || v_label || ' opened up (' || left(s.text, 120) || ').', 320), auth.uid(), true);
    if not (s.demo or coalesce(s.test, false)) then
      perform private.push_send(array[w.user_id], 'reminders', s.text, 'You’re in: ' || v_label || ' opened up', '/#/idea/' || s.id, 'pm:' || p_item || ':' || w.user_id);
    end if;
    return w.user_id;
  end loop;
  return null;
end $$;

create or replace function private.part_dropped() returns trigger language plpgsql security definer set search_path = public as $$
declare i record; s record; v_up uuid; v_msg text;
begin
  select id, spark_id, kind, shift_of into i from signup_items where id = old.item_id;
  if i.id is null then return null; end if;   -- the item itself is being removed
  v_up := private.fill_from_waitlist(old.item_id);   -- jobs too (20261119000000)
  if i.kind = 'job' then return null; end if;          -- a job's hosts hear from claim_dropped
  -- The hosts hear when someone gives one up (not the lead's own removals, not an Undo right after claiming)
  if auth.uid() is distinct from old.user_id or old.created_at > now() - interval '2 minutes' then return null; end if;
  select id, text, demo, test into s from sparks where id = i.spark_id;
  if old.user_id = any(private.host_ids(s.id)) or s.demo or coalesce(s.test, false) then return null; end if;
  v_msg := private.person_name(old.user_id, s.id) || ' gave up ' ||
           (case when i.kind = 'time' then (select to_char("time", 'FMHH12:MIam') from signup_items where id = i.id) else private.part_label(i.id) end) || '.' ||
           coalesce(' ' || private.person_name(v_up, s.id) || ' moved up.', '');
  insert into notes (user_id, body, created_by, quiet)
    select u, left(v_msg || ' (' || left(s.text, 120) || ')', 320), old.user_id, true from unnest(private.host_ids(s.id)) u;
  perform private.push_send(private.host_ids(s.id), 'hosting', s.text, v_msg, '/#/idea/' || s.id, 'pg:' || old.item_id);
  return null;
end $$;

-- (otherwise as 20261106000000_take_part.sql)
create or replace function private.part_room() returns trigger language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if new.need is null or new.need <= coalesce(old.need, 0) then return null; end if;
  while n < new.need - coalesce(old.need, 0) loop
    exit when private.fill_from_waitlist(new.id) is null;
    n := n + 1;
  end loop;
  return null;
end $$;

-- (otherwise as 20261115000000_multi_day_fixes.sql)
create or replace function private.push_parts() returns void language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_now timestamp := now() at time zone 'America/Chicago';
begin
  for r in
    select x.* from (
      select c.item_id, c.user_id, s.id as spark_id, s.text, coalesce(i.day, s.day_date) as day_date,
             coalesce(i."time",
                      case when i.day is not null then
                        (select nullif(e->>'t', '')::time from jsonb_array_elements(case when s.schedule->>'kind' = 'days' then s.schedule->'days' else '[]'::jsonb end) e
                          where (e->>'d')::date = i.day limit 1) end,
                      s.day_time) as t,
             i.kind, i.item
        from signup_claims c join signup_items i on i.id = c.item_id join sparks s on s.id = i.spark_id
       where c.reminded_at is null and (i.kind <> 'job' or i."time" is not null) and s.planned and s.cancelled_at is null and not s.demo and not coalesce(s.test, false)) x
     where x.day_date between (v_now::date) and (v_now::date + 1) and x.t is not null
  loop
    if (r.day_date + r.t) <= v_now then continue; end if;
    if (r.t < time '12:00' and v_now >= (r.day_date - 1) + time '19:00')
       or (r.t >= time '12:00' and v_now >= (r.day_date + r.t) - interval '2 hours') then
      perform private.push_send(array[r.user_id], 'reminders', r.text,
        'Your ' || (case when r.kind = 'time' then lower(r.item) else r.item end) || ' is at ' || to_char(r.t, 'FMHH12:MIam') ||
        (case when r.day_date = v_now::date then ' today' else ' tomorrow' end), '/#/idea/' || r.spark_id, 'pt:' || r.item_id || ':' || r.user_id);
      update signup_claims set reminded_at = now() where item_id = r.item_id and user_id = r.user_id;
    end if;
  end loop;
end $$;

-- (otherwise as 20261110000000_plus_ones.sql, plus signup_items.guests)
create or replace function public.load_all() returns jsonb
language sql stable security invoker set search_path = public as $$
  with
  sp  as materialized (select s.* from sparks s),
  ofr as materialized (select o.* from offers o),
  itr as materialized (select spark_id, user_id, created_at, can_help from interests),
  rsv as materialized (select spark_id, user_id, status, created_at, attended, days, maybe_days, plus_count, plus_note from rsvps),
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
    'signup_items',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, item, need, time, end_time, descr, shift_of, kind, waitlist, per_person, guests, day, created_by, created_at from signup_items) t), '[]'::jsonb),
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
