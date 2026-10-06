-- Multi-day events (Design v8-7, items 1–8): how long an event is, an RSVP for each day, and jobs tied to a day.
--   sparks.schedule        null = one day (day_date / day_time / day_end, as before). Otherwise one of:
--                            {"kind":"repeat","every":"week"|"2week"|"month","until":"YYYY-MM-DD"|null}
--                            {"kind":"span","to":"YYYY-MM-DD","to_time":"HH:MM"|null}    (runs from day_date to `to`)
--                            {"kind":"days","days":[{"d":"YYYY-MM-DD","t":"HH:MM"|null,"e":"HH:MM"|null}, …],"each":bool}
--                          day_date is always the first day (for "days", days[0]), so everything that reads day_date
--                          (plans need a date, sorting, the new-event push) keeps working. The lead updates it (grant).
--   rsvps.days / maybe_days  on an "Each day" event, the days someone picked Going / Maybe (null = the whole event)
--   signup_items.day       a job tied to one day of a Separate days event (hosts only, like a job's time)
-- push_daily sends one reminder before each day: for "days" to the people going that day (or the whole thing, or
-- holding a job that day); for a recurring event before each date; a span only before its first day.

create or replace function private.schedule_ok(p jsonb, p_date date) returns boolean
language plpgsql immutable as $$
declare hm constant text := '^([01][0-9]|2[0-3]):[0-5][0-9]$'; e jsonb; prev date; d date; n int := 0;
begin
  if p is null then return true; end if;
  if p_date is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) > 4000 then return false; end if;
  if p->>'kind' = 'repeat' then
    if exists (select 1 from jsonb_object_keys(p) k where k not in ('kind', 'every', 'until')) then return false; end if;
    if coalesce(p->>'every', '') not in ('week', '2week', 'month') then return false; end if;
    if p->'until' is not null and jsonb_typeof(p->'until') <> 'null' then
      if (p->>'until')::date <= p_date then return false; end if;
    end if;
    return true;
  elsif p->>'kind' = 'span' then
    if exists (select 1 from jsonb_object_keys(p) k where k not in ('kind', 'to', 'to_time')) then return false; end if;
    d := (p->>'to')::date;
    if d is null or d <= p_date or d > p_date + 31 then return false; end if;
    if p->'to_time' is not null and jsonb_typeof(p->'to_time') <> 'null' and (p->>'to_time') !~ hm then return false; end if;
    return true;
  elsif p->>'kind' = 'days' then
    if exists (select 1 from jsonb_object_keys(p) k where k not in ('kind', 'days', 'each')) then return false; end if;
    if jsonb_typeof(p->'days') <> 'array' or jsonb_array_length(p->'days') not between 2 and 30 then return false; end if;
    if p->'each' is not null and jsonb_typeof(p->'each') <> 'boolean' then return false; end if;
    for e in select * from jsonb_array_elements(p->'days') loop
      if jsonb_typeof(e) <> 'object' or exists (select 1 from jsonb_object_keys(e) k where k not in ('d', 't', 'e')) then return false; end if;
      d := (e->>'d')::date;
      if d is null or (n = 0 and d <> p_date) or (prev is not null and d <= prev) then return false; end if;
      if coalesce(e->>'t', '') <> '' and (e->>'t') !~ hm then return false; end if;
      if coalesce(e->>'e', '') <> '' and (e->>'e') !~ hm then return false; end if;
      prev := d; n := n + 1;
    end loop;
    return true;
  end if;
  return false;
exception when others then return false;   -- a date that doesn't parse
end $$;

alter table public.sparks add column if not exists schedule jsonb;
alter table public.sparks drop constraint if exists sparks_schedule_ok;
alter table public.sparks add constraint sparks_schedule_ok check (private.schedule_ok(schedule, day_date));
grant update (schedule) on table public.sparks to authenticated;

-- Taking the date off (clear_plan, Edit event's Date TBD) takes the schedule with it
create or replace function private.sparks_schedule_clear() returns trigger language plpgsql as $$
begin
  if new.day_date is null then new.schedule := null; end if;
  return new;
end $$;
drop trigger if exists sparks_schedule_clear on public.sparks;
create trigger sparks_schedule_clear before insert or update of day_date, schedule on public.sparks
  for each row execute function private.sparks_schedule_clear();

-- Each day's RSVP: you write your own row as before (the upsert), now with the days you picked
alter table public.rsvps
  add column if not exists days       date[],
  add column if not exists maybe_days date[];
alter table public.rsvps drop constraint if exists rsvps_days_ok;
alter table public.rsvps add constraint rsvps_days_ok
  check (coalesce(cardinality(days), 0) <= 31 and coalesce(cardinality(maybe_days), 0) <= 31);
grant insert (days, maybe_days) on table public.rsvps to authenticated;
grant update (days, maybe_days) on table public.rsvps to authenticated;

-- A job on one day (WHICH DAY in the add-a-job sheet): set by hosts only, like the job's time
alter table public.signup_items add column if not exists day date;
grant update (day) on table public.signup_items to authenticated;
drop policy "add a sign-up" on public.signup_items;
create policy "add a sign-up" on public.signup_items for insert to authenticated
  with check (created_by = auth.uid() and public.can_see_spark(spark_id)
              and (public.is_host(spark_id)
                   or (kind = 'job' and need is null and "time" is null and end_time is null and descr is null and shift_of is null and day is null))
              and (shift_of is null or exists (select 1 from signup_items j
                                                where j.id = signup_items.shift_of and j.spark_id = signup_items.spark_id
                                                  and j.shift_of is null and j.kind = signup_items.kind)));

-- Every day an event happens on, from its first day up to p_to (a recurring event without an end goes on)
create or replace function private.event_days(p_date date, p_time time, p_sched jsonb, p_to date)
returns table (day date, day_time time) language sql immutable as $$
  select p_date, p_time where p_sched is null or p_sched->>'kind' = 'span'
  union all
  select (e->>'d')::date, nullif(e->>'t', '')::time
    from jsonb_array_elements(case when p_sched->>'kind' = 'days' then p_sched->'days' else '[]'::jsonb end) e
  union all
  select g::date, p_time
    from generate_series(p_date::timestamp,
                         least(p_to, coalesce(nullif(p_sched->>'until', '')::date, p_to))::timestamp,
                         case p_sched->>'every' when '2week' then interval '2 weeks' when 'month' then interval '1 month' else interval '1 week' end) g
   where p_sched->>'kind' = 'repeat'
$$;

-- The daily job (otherwise the same as 20261103000000_soft_holds.sql): one reminder before each day
create or replace function private.push_daily() returns void language plpgsql security definer set search_path = public, extensions as $$
declare s record; o record; users uuid[]; today date := (now() at time zone 'America/Chicago')::date; top record;
begin
  for s in select id, text, day_date, day_time, spot, lead_id, schedule from sparks
            where planned and not demo and not test and auto_remind and cancelled_at is null
              and day_date <= today + 1 and (day_date >= today or schedule is not null) loop
    for o in select * from private.event_days(s.day_date, s.day_time, s.schedule, today + 1) where day in (today, today + 1) loop
      select array_agg(distinct u) into users from (
        select user_id as u from rsvps
         where spark_id = s.id and status in ('going', 'maybe')
           and (coalesce(cardinality(days), 0) + coalesce(cardinality(maybe_days), 0) = 0 or o.day = any (days) or o.day = any (maybe_days))
        union select c.user_id from signup_claims c join signup_items i on i.id = c.item_id
         where i.spark_id = s.id and (i.day is null or i.day = o.day)) x
       where u <> all(private.host_ids(s.id));
      perform private.push_send(users, 'reminders', (case when o.day = today then 'Today: ' else 'Tomorrow: ' end) || s.text,
        private.when_text(o.day, o.day_time, s.spot), '/#/idea/' || s.id, 'r:' || s.id || ':' || o.day || (case when o.day = today then ':0' else ':1' end));
    end loop;
  end loop;

  -- Soft holds: only ideas with a lead (not looking for one), never test or demo events
  for s in select id, text, lead_id, hold_until, hold_nudged_at from sparks
            where not planned and day_date is null and cancelled_at is null and not demo and not test and not wants_host
              and lead_id is not null and hold_until >= today loop
    if s.hold_nudged_at is null then
      select o2.day_date, count(v.user_id) as n,
             count(v.user_id) > coalesce((select max(c) from (select count(v2.user_id) as c from date_options o3 left join date_votes v2 on v2.option_id = o3.id
                                                                where o3.spark_id = s.id and o3.id <> o2.id group by o3.id) z), 0) as alone,
             (select count(distinct v3.user_id) from date_votes v3 join date_options o4 on o4.id = v3.option_id where o4.spark_id = s.id) as voters
        into top
        from date_options o2 left join date_votes v on v.option_id = o2.id
       where o2.spark_id = s.id and o2.day_date >= today
       group by o2.id, o2.day_date order by count(v.user_id) desc limit 1;
      if top.n >= 3 and top.alone then
        perform private.push_send(private.host_ids(s.id), 'hosting', s.text,
          top.voters || ' voted, ' || to_char(top.day_date, 'FMDay') || ' leads. Lock it in?', '/#/idea/' || s.id, 'hv:' || s.id);
        update sparks set hold_nudged_at = now() where id = s.id;
      end if;
    end if;
    if s.hold_until = today + 1 then
      perform private.push_send(private.host_ids(s.id), 'hosting', s.text,
        'Your dates for ' || s.text || ' stop holding tomorrow. Keep holding?', '/#/idea/' || s.id, 'hl:' || s.id || ':' || s.hold_until);
    end if;
  end loop;

  begin
    delete from push_subscriptions where endpoint in (
      select jsonb_array_elements_text(r.content::jsonb -> 'gone') from net._http_response r
       where r.created > now() - interval '2 days' and r.status_code = 200 and r.content like '{%');
  exception when others then raise warning 'push cleanup: %', sqlerrm;
  end;
end $$;

-- One request loads the app: replies carry their days and jobs their day (sparks.schedule comes with s.*)
create or replace function public.load_all() returns jsonb
language sql stable security invoker set search_path = public as $$
  with
  sp  as materialized (select s.* from sparks s),
  ofr as materialized (select o.* from offers o),
  itr as materialized (select spark_id, user_id, created_at, can_help from interests),
  rsv as materialized (select spark_id, user_id, status, created_at, attended, days, maybe_days from rsvps),
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
    'signup_items',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, item, need, time, end_time, descr, shift_of, kind, waitlist, per_person, day, created_by, created_at from signup_items) t), '[]'::jsonb),
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
