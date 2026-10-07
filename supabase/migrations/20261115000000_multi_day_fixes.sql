-- Multi-day fixes (review of 20261108000000_multi_day.sql, 2026-10-07). day_date is an event's FIRST day, so:
--   B2  "Has the event passed?" asks the LAST day (private.event_last_day): a weekend sale is still on on Sunday, a
--       weekly class with no end date never passes. check_wait, claim_dropped, nudge_invitee, ask_for_job, offer_lead
--       and make_plan used day_date; push_daily skips events that are over. A job or spot tied to one day
--       (signup_items.day) has passed when that day has.
--   B3  push_parts times a spot reminder from the spot's own day (signup_items.day, and that day's start time) when
--       it has one; ask_for_job's push shows the job's day.
--   B4  Monthly repeats count each month from the START date, clamped to the month's last day (Jan 31 → Feb 28 →
--       Mar 31); generate_series with a 1-month step drifted (Jan 31 → Feb 28 → Mar 28). The app clamps the same way.
--   B5  Changing the schedule cleans up day picks (trigger sparks_schedule_days, after update of schedule/day_date):
--       - no longer an Each-day event: every reply's days / maybe_days go null (the reply stands for the whole event);
--       - days taken off: those dates leave days / maybe_days; a reply left with no days at all keeps its status and
--         goes null (= the whole event) rather than being dropped or turned into a Maybe;
--       - a job or spot whose day is no longer in the event loses its day (signup_items.day = null: the whole event);
--       - people who had picked, or hold a job on, a day that was taken off get a note (and so a push):
--         "{title}: Sat, Oct 24 was taken off the schedule." Not when the date comes off altogether (clear_plan tells
--         them) or on a cancelled event.
--       rsvp_guard only stops `authenticated` moving a reply or changing attended; this trigger is security definer
--       and touches days / maybe_days only.
--   U5  push_daily's per-day filter applies only to an Each-day event (otherwise everyone going gets every day).
--   M1  event_preview() (the link preview) also returns the schedule (a new last column; the old ones stay) and its
--       photo falls back cover → mood photo → home group's photo (owner, 2026-10-07), and
--       private.when_text(date, time, spot, schedule) adds a short multi-day hint, used by make_plan, push_made_plan
--       and ask_for_job: "Fri, Oct 16 – Sun, Oct 18", "Fri, Oct 30 at 10:00am + 1 more day", "… · every week".

-- B4: every day an event happens on, from its first day up to p_to; repeats step from the start date ------------------
create or replace function private.event_days(p_date date, p_time time, p_sched jsonb, p_to date)
returns table (day date, day_time time) language sql immutable as $$
  select p_date, p_time where p_sched is null or p_sched->>'kind' = 'span'
  union all
  select (e->>'d')::date, nullif(e->>'t', '')::time
    from jsonb_array_elements(case when p_sched->>'kind' = 'days' then p_sched->'days' else '[]'::jsonb end) e
  union all
  select g.d, p_time
    from (select (p_date + k * case p_sched->>'every' when '2week' then interval '2 weeks' when 'month' then interval '1 month'
                                                       else interval '1 week' end)::date as d
            from generate_series(0, greatest(least(p_to, coalesce(nullif(p_sched->>'until', '')::date, p_to)) - p_date, -1) / 7 + 1) k) g
   where p_sched->>'kind' = 'repeat'
     and g.d <= least(p_to, coalesce(nullif(p_sched->>'until', '')::date, p_to))
$$;
-- (date + n months clamps to the month's last day, counted from p_date each time; the series runs past the end for
-- months and the where trims it)

-- B2: an event's last day; null = no end (a repeat without `until`), which never passes ----------------------------
create or replace function private.event_last_day(p_date date, p_sched jsonb)
returns date language sql immutable as $$
  select case
    when p_date is null then null
    when p_sched is null then p_date
    when p_sched->>'kind' = 'span' then coalesce(nullif(p_sched->>'to', '')::date, p_date)
    when p_sched->>'kind' = 'days' then coalesce((select max((e->>'d')::date) from jsonb_array_elements(p_sched->'days') e), p_date)
    when p_sched->>'kind' = 'repeat' then
      case when nullif(p_sched->>'until', '') is null then null
           else (select max(day) from private.event_days(p_date, null, p_sched, (p_sched->>'until')::date)) end
    else p_date end
$$;

-- Does the event happen on p_day? (a span covers every day from its first to `to`)
create or replace function private.event_has_day(p_date date, p_sched jsonb, p_day date)
returns boolean language sql immutable as $$
  select p_date is not null and p_day is not null and case
    when p_sched is null then p_day = p_date
    when p_sched->>'kind' = 'span' then p_day between p_date and coalesce(nullif(p_sched->>'to', '')::date, p_date)
    else exists (select 1 from private.event_days(p_date, null, p_sched, p_day) d where d.day = p_day) end
$$;

-- M1: "Fri, Oct 16 – Sun, Oct 18", "Fri, Oct 30 at 10:00am + 1 more day", "Fri, Oct 30 at 7:00pm, every week"
create or replace function private.when_text(p_date date, p_time time, p_spot text, p_sched jsonb)
returns text language sql stable as $$
  select case
    when p_date is null or p_sched is null then private.when_text(p_date, p_time, p_spot)
    else concat_ws(' · ',
      to_char(p_date, 'Dy, Mon FMDD') || coalesce(' at ' || to_char(p_date + p_time, 'FMHH12:MIam'), '') ||
      case p_sched->>'kind'
        when 'span' then ' – ' || to_char((p_sched->>'to')::date, 'Dy, Mon FMDD')
        when 'days' then ' + ' || (jsonb_array_length(p_sched->'days') - 1) ||
                         case when jsonb_array_length(p_sched->'days') = 2 then ' more day' else ' more days' end
        when 'repeat' then case p_sched->>'every' when '2week' then ', every 2 weeks' when 'month' then ', every month' else ', every week' end
        else '' end,
      p_spot) end
$$;

-- B2: check_wait (otherwise the same as 20261106000000_take_part.sql) ----------------------------------------------------
create or replace function private.check_wait() returns trigger language plpgsql security definer set search_path = public as $$
declare i record; s record; p record; v_today date := (now() at time zone 'America/Chicago')::date;
begin
  select id, spark_id, need, day into i from signup_items where id = new.item_id;
  select cancelled_at, day_date, schedule into s from sparks where id = i.spark_id;
  if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '23514'; end if;
  if private.event_last_day(s.day_date, s.schedule) < v_today or i.day < v_today then
    raise exception 'this event has passed' using errcode = '23514';
  end if;
  if i.need is null or (select count(*) from signup_claims where item_id = i.id) < i.need then
    raise exception 'there''s an open spot' using errcode = '23514';
  end if;
  if exists (select 1 from signup_claims where item_id = i.id and user_id = new.user_id) then
    raise exception 'you have this one' using errcode = '23514';
  end if;
  select j.id, j.per_person, j.item into p from signup_items x join signup_items j on j.id = coalesce(x.shift_of, x.id) where x.id = new.item_id;
  if p.per_person is not null
     and (select count(*) from signup_claims c join signup_items k on k.id = c.item_id where (k.id = p.id or k.shift_of = p.id) and c.user_id = new.user_id)
       + (select count(*) from signup_waits w join signup_items k on k.id = w.item_id where (k.id = p.id or k.shift_of = p.id) and w.user_id = new.user_id)
       >= p.per_person then
    raise exception 'per person: up to % per person for %', p.per_person, lower(p.item) using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.check_wait() from public, anon, authenticated;

-- B2: claim_dropped (otherwise the same as 20261106000000_take_part.sql) ------------------------------------------------
create or replace function private.claim_dropped() returns trigger language plpgsql security definer set search_path = public as $$
declare it record; s record; v_today date := (now() at time zone 'America/Chicago')::date;
begin
  if auth.uid() is null or auth.uid() <> old.user_id then return null; end if;      -- only when they take themselves off
  if old.created_at > now() - interval '2 minutes' then return null; end if;         -- Undo right after signing up
  select i.item, i.spark_id, i.kind, i.day into it from signup_items i where i.id = old.item_id;
  if it.spark_id is null or it.kind <> 'job' then return null; end if;               -- the job itself is being removed, or a spot
  select id, text, demo, test, cancelled_at, day_date, schedule into s from sparks where id = it.spark_id;
  if s.id is null or s.cancelled_at is not null or s.demo or coalesce(s.test, false) then return null; end if;
  if private.event_last_day(s.day_date, s.schedule) < v_today or it.day < v_today then return null; end if;
  if old.user_id = any(private.host_ids(s.id)) then return null; end if;
  insert into notes (user_id, body, created_by)
    select u, left(private.person_name(old.user_id, s.id) || ' can’t do ' || left(it.item, 60) || ' any more (' || left(s.text, 120) || ').', 320), old.user_id
      from unnest(private.host_ids(s.id)) u;
  return null;
end $$;
revoke all on function private.claim_dropped() from public, anon, authenticated;

-- B2: nudge_invitee (otherwise the same as 20261102040000_invited_and_nudge.sql) ---------------------------------------
create or replace function public.nudge_invitee(p_spark uuid, p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  s record; v_at timestamptz; v_today date := (now() at time zone 'America/Chicago')::date; v_body text;
begin
  if not public.is_signed_in() or not public.is_host(p_spark) then raise exception 'only a lead can nudge' using errcode = '42501'; end if;
  select id, text, planned, cancelled_at, day_date, schedule, demo, test into s from sparks where id = p_spark;
  if s.id is null or not s.planned or s.cancelled_at is not null then raise exception 'this event isn''t taking replies' using errcode = '22023'; end if;
  if private.event_last_day(s.day_date, s.schedule) < v_today then raise exception 'that event has passed' using errcode = '22023'; end if;
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

-- B2 + B3: ask_for_job (otherwise the same as 20261103020000_job_ask_note_optional.sql) --------------------------------
create or replace function public.ask_for_job(p_item uuid, p_user uuid, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare
  it record; s record; v_msg text := left(nullif(btrim(coalesce(p_message, '')), ''), 200); v_name text;
  v_today date := (now() at time zone 'America/Chicago')::date; v_when text;
begin
  select i.id, i.item, i.spark_id, i.day into it from signup_items i where i.id = p_item;
  if it.id is null or not public.is_host(it.spark_id) then raise exception 'only a lead can ask' using errcode = '42501'; end if;
  if exists (select 1 from signup_items where shift_of = p_item) then raise exception 'jobs with shifts can''t be asked for yet' using errcode = '22023'; end if;
  select id, text, cancelled_at, day_date, day_time, schedule, spot, visibility, demo, test into s from sparks where id = it.spark_id;
  if s.cancelled_at is not null or private.event_last_day(s.day_date, s.schedule) < v_today or it.day < v_today then
    raise exception 'this event isn''t taking sign-ups' using errcode = '22023';
  end if;
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
    -- A job on one day says that day (and its start time); otherwise the whole event, with its multi-day hint
    v_when := case when it.day is not null
      then private.when_text(it.day, coalesce((select nullif(e->>'t', '')::time from jsonb_array_elements(case when s.schedule->>'kind' = 'days' then s.schedule->'days' else '[]'::jsonb end) e
                                                where (e->>'d')::date = it.day limit 1), s.day_time), s.spot)
      else private.when_text(s.day_date, s.day_time, s.spot, s.schedule) end;
    perform private.push_send(array[p_user], 'friends', v_name || ' asked if you’d take ' || left(it.item, 60),
      coalesce('“' || v_msg || '” ', '') || left(s.text, 120) || ' · ' || v_when, '/#/idea/' || s.id, 'ja:' || p_item);
  end if;
end $$;
revoke execute on function public.ask_for_job(uuid, uuid, text) from public, anon;
grant execute on function public.ask_for_job(uuid, uuid, text) to authenticated;

-- B2: offer_lead (otherwise the same as 20261102070000_job_asks_and_handoff.sql) -------------------------------------
create or replace function public.offer_lead(p_spark uuid, p_user uuid, p_message text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_msg text := left(nullif(btrim(coalesce(p_message, '')), ''), 200); v_name text;
begin
  select id, text, lead_id, wants_host, cancelled_at, day_date, day_time, schedule, spot, demo, test into s from sparks where id = p_spark;
  if s.id is null or s.lead_id is distinct from auth.uid() then raise exception 'only the lead can hand it on' using errcode = '42501'; end if;
  if s.cancelled_at is not null or s.wants_host or private.event_last_day(s.day_date, s.schedule) < (now() at time zone 'America/Chicago')::date then
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

-- B2 + M1: make_plan (otherwise the same as 20261111000000_idea_handoffs.sql) -----------------------------------------
create or replace function public.make_plan(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; users uuid[];
begin
  if not public.is_host(p_spark) then
    raise exception 'only a host can make it a plan' using errcode = '42501';
  end if;
  if exists (select 1 from sparks where id = p_spark and wants_host) then
    raise exception 'find a lead first' using errcode = '23514';
  end if;
  if exists (select 1 from sparks where id = p_spark and day_date is null) then
    raise exception 'pick a date first' using errcode = '23514';
  end if;
  if exists (select 1 from sparks where id = p_spark and private.event_last_day(day_date, schedule) < (now() at time zone 'America/Chicago')::date) then
    raise exception 'that date has passed' using errcode = '23514';
  end if;
  select id, text, planned, lead_id, day_date, day_time, schedule, spot, demo, test, cancelled_at into s from sparks where id = p_spark;
  if s.planned then return; end if;
  update sparks set planned = true where id = p_spark;
  insert into rsvps (spark_id, user_id, status)
  select s.id, s.lead_id, 'going' where s.lead_id is not null and s.cancelled_at is null
  on conflict (spark_id, user_id) do nothing;
  with moved as (
    insert into rsvps (spark_id, user_id, status)
    select i.spark_id, i.user_id, 'maybe' from interests i
     where i.spark_id = p_spark and i.user_id is distinct from s.lead_id
       and not exists (select 1 from cohosts c where c.spark_id = p_spark and c.user_id = i.user_id)
    on conflict (spark_id, user_id) do nothing
    returning user_id)
  select array_agg(user_id) into users from moved;
  if users is not null and not (s.demo or coalesce(s.test, false)) then
    perform private.push_send(users, 'updates', s.text || ' is on: ' || to_char(s.day_date, 'Dy, Mon FMDD'),
      private.when_text(s.day_date, s.day_time, s.spot, s.schedule) || '. Are you going? You’re a Maybe for now.', '/#/idea/' || s.id, 'mp:' || s.id);
  end if;
end $$;

-- M1: push_made_plan (otherwise the same as 20261111000000_idea_handoffs.sql) -----------------------------------------
create or replace function private.push_made_plan() returns trigger language plpgsql security definer set search_path = public as $$
declare g text; users uuid[];
begin
  if auth.uid() is null or new.visibility <> 'group' then return null; end if;
  select name into g from groups where id = new.group_id;
  select array_agg(distinct m.user_id) into users from memberships m
   where (m.group_id = new.group_id or m.group_id in (select group_id from spark_groups where spark_id = new.id))
     and m.user_id <> all(private.host_ids(new.id))
     and not exists (select 1 from interests i where i.spark_id = new.id and i.user_id = m.user_id);   -- make_plan told them
  perform private.push_send(users, 'newevents', 'It’s a plan in ' || coalesce(g, 'your group') || ': ' || new.text,
    private.when_text(new.day_date, new.day_time, new.spot, new.schedule) || '. RSVP in Spark Hub.', '/#/idea/' || new.id, 'e:' || new.id);
  return null;
end $$;

-- B3: push_parts (otherwise the same as 20261106000000_take_part.sql): a spot on one day is timed from that day -------
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
       where c.reminded_at is null and i.kind <> 'job' and s.planned and s.cancelled_at is null and not s.demo and not coalesce(s.test, false)) x
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
revoke all on function private.push_parts() from public, anon, authenticated;

-- U5 + B2: push_daily (otherwise the same as 20261108000000_multi_day.sql) ---------------------------------------------
create or replace function private.push_daily() returns void language plpgsql security definer set search_path = public, extensions as $$
declare s record; o record; users uuid[]; today date := (now() at time zone 'America/Chicago')::date; top record; v_each boolean;
begin
  for s in select id, text, day_date, day_time, spot, lead_id, schedule from sparks
            where planned and not demo and not test and auto_remind and cancelled_at is null
              and day_date <= today + 1 and (day_date >= today or schedule is not null)
              and coalesce(private.event_last_day(day_date, schedule) >= today, true) loop
    -- Picked days count only on an Each-day event (any days left on a reply otherwise mean nothing)
    v_each := s.schedule->>'kind' = 'days' and coalesce((s.schedule->>'each')::boolean, false);
    for o in select * from private.event_days(s.day_date, s.day_time, s.schedule, today + 1) where day in (today, today + 1) loop
      select array_agg(distinct u) into users from (
        select user_id as u from rsvps
         where spark_id = s.id and status in ('going', 'maybe')
           and (not v_each or coalesce(cardinality(days), 0) + coalesce(cardinality(maybe_days), 0) = 0 or o.day = any (days) or o.day = any (maybe_days))
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

-- B5: a schedule change cleans up day picks and jobs' days ------------------------------------------------------------
create or replace function private.sparks_schedule_days() returns trigger language plpgsql security definer set search_path = public as $$
declare v_each boolean; v_lost jsonb;
begin
  if new.schedule is not distinct from old.schedule and new.day_date is not distinct from old.day_date then return null; end if;
  v_each := new.schedule->>'kind' = 'days' and coalesce((new.schedule->>'each')::boolean, false);
  -- Who loses a day they'd picked or hold a job on (before anything changes), for the notes below
  if new.day_date is not null and new.cancelled_at is null then
    select jsonb_agg(jsonb_build_object('user_id', l.user_id, 'd', l.d)) into v_lost from (
      select r.user_id, d from rsvps r, unnest(coalesce(r.days, '{}') || coalesce(r.maybe_days, '{}')) d
       where r.spark_id = new.id and not private.event_has_day(new.day_date, new.schedule, d)
      union
      select c.user_id, i.day from signup_items i join signup_claims c on c.item_id = i.id
       where i.spark_id = new.id and i.day is not null and not private.event_has_day(new.day_date, new.schedule, i.day)) l;
  end if;

  -- Replies (a cancelled event's rows can't be updated, and don't need to be)
  if new.cancelled_at is null then
    if not v_each then
      update rsvps set days = null, maybe_days = null
       where spark_id = new.id and (days is not null or maybe_days is not null);
    else
      update rsvps x set days = nullif(y.nd, '{}'), maybe_days = nullif(y.nm, '{}')
        from (select r.user_id,
                     array(select d from unnest(r.days) d where private.event_has_day(new.day_date, new.schedule, d) order by d) as nd,
                     array(select d from unnest(r.maybe_days) d where private.event_has_day(new.day_date, new.schedule, d) order by d) as nm,
                     r.days, r.maybe_days
                from rsvps r where r.spark_id = new.id and (r.days is not null or r.maybe_days is not null)) y
       where x.spark_id = new.id and x.user_id = y.user_id
         and (y.nd is distinct from y.days or y.nm is distinct from y.maybe_days);
      -- Nothing left on a reply: both arrays null, i.e. the whole event (the status stays as it was)
      update rsvps set days = null, maybe_days = null
       where spark_id = new.id and coalesce(cardinality(days), 0) + coalesce(cardinality(maybe_days), 0) = 0
         and (days is not null or maybe_days is not null);
    end if;
  end if;

  -- Jobs and spots on a day that's gone: the whole event
  update signup_items set day = null
   where spark_id = new.id and day is not null and not coalesce(private.event_has_day(new.day_date, new.schedule, day), false);

  -- Tell them (not the person making the change); notes push as usual
  insert into notes (user_id, body, created_by)
  select l.user_id,
         left(left(new.text, 120) || ': ' || string_agg(to_char(l.d, 'Dy, Mon FMDD'), ', ' order by l.d) ||
              case when count(*) > 1 then ' were' else ' was' end || ' taken off the schedule.', 320),
         auth.uid()
    from jsonb_to_recordset(coalesce(v_lost, '[]'::jsonb)) as l(user_id uuid, d date)
   where l.user_id is distinct from auth.uid()
   group by l.user_id;
  return null;
end $$;
revoke all on function private.sparks_schedule_days() from public, anon, authenticated;
drop trigger if exists sparks_schedule_days on public.sparks;
create trigger sparks_schedule_days after update of schedule, day_date on public.sparks
  for each row execute function private.sparks_schedule_days();

-- M1: the link preview also returns the schedule (a new last column, so older callers still read theirs), and its
-- photo always has something when it can (owner, 2026-10-07: shared links preview with a big photo): the event's first
-- cover photo, else its first mood photo, else its home group's photo (a stored photo or one of the site's /photos/).
-- Invite-only and cancelled events still return nothing.
drop function if exists public.event_preview(text);
create function public.event_preview(p_code text)
returns table (title text, day_date date, day_time time, spot text, photo text, schedule jsonb)
language sql stable security definer set search_path = public as $$
  select s.text, s.day_date, s.day_time, nullif(s.spot, ''),
         coalesce((select p from unnest(s.photos) with ordinality u(p, n) where p ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' order by n limit 1),
                  (select p from unnest(s.mood) with ordinality u(p, n) where p ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' order by n limit 1),
                  (select g.photo from groups g where g.id = s.group_id
                      and (g.photo ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' or g.photo ~ '^photos/[a-z0-9-]+\.(jpg|png)$'))),
         s.schedule
    from sparks s
   where s.link_code = p_code and s.visibility = 'group' and s.cancelled_at is null;
$$;
revoke all on function public.event_preview(text) from public;
grant execute on function public.event_preview(text) to anon, authenticated;
