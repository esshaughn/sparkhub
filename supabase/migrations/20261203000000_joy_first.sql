-- After the event, joy first (Design v9-1 item 6, Q57; owner 2026-10-16).
-- Someone who went (or a host) shares what gave them joy on the past event: chips, a moment, I'd come again, and
-- thanks for people by name (step 1); then, if they want, what they could do next time and what would give them more
-- joy (step 2). Joy, moments, thanks, "I'd come again" and "I could" are public on the event; wishes are counted and
-- grouped for everyone from day 2, never shown by name. A lead's step 2 stays private: it goes into next_time_notes,
-- which co-leads can now read too. Three scheduled pushes: a photo nudge ~40 minutes in, "How was it?" the morning
-- after, and one last nudge on day 2 for whoever did nothing yet. A thanked person gets one push per event.

-- Every word in a chip list is short (the app's chips, or 40 characters typed by the person)
create or replace function public.short_words(p text[], p_max integer)
returns boolean language sql immutable as $$
  select coalesce(bool_and(char_length(w) between 1 and p_max), true) from unnest(p) w
$$;
grant execute on function public.short_words(text[], integer) to authenticated;

-- Who can share: anyone Going (or checked in) and the hosts, on a planned, uncancelled event that has started
-- (its first day is today or earlier, Central time)
create or replace function public.joy_can(p_spark uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sparks s
     where s.id = p_spark and s.planned and s.cancelled_at is null and s.day_date is not null
       and s.day_date <= (now() at time zone 'America/Chicago')::date
       and (public.is_host(s.id) or exists (select 1 from rsvps r where r.spark_id = s.id and r.user_id = auth.uid()
                                                and (r.status = 'going' or r.attended)))
  )
$$;
revoke all on function public.joy_can(uuid) from public, anon;
grant execute on function public.joy_can(uuid) to authenticated;

-- 1. Step 1 (and the public part of step 2): one row per person per event
create table public.event_joy (
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  joy        text[] not null default '{}' check (cardinality(joy) <= 8 and public.short_words(joy, 40)),
  line       text check (char_length(line) <= 140),
  again      boolean not null default false,
  could      text[] not null default '{}' check (cardinality(could) <= 6 and public.short_words(could, 40)),
  step2      text check (step2 in ('done', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (spark_id, user_id)
);
create index event_joy_user on public.event_joy (user_id);
alter table public.event_joy enable row level security;
create policy "anyone who can see the event reads its joy" on public.event_joy for select to authenticated
  using (public.can_see_spark(spark_id));
create policy "share your own joy" on public.event_joy for insert to authenticated
  with check (user_id = auth.uid() and public.joy_can(spark_id));
create policy "change your own joy" on public.event_joy for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.joy_can(spark_id));
create policy "delete your own joy" on public.event_joy for delete to authenticated
  using (user_id = auth.uid());
revoke all on table public.event_joy from anon, authenticated;
grant select, delete on table public.event_joy to authenticated;
grant insert (spark_id, user_id, joy, line, again, could, step2) on table public.event_joy to authenticated;
grant update (joy, line, again, could, step2, updated_at) on table public.event_joy to authenticated;

-- 2. What would give you more joy (step 2): read by its writer and the event's hosts; everyone else gets only the
-- grouped counts from joy_more_counts(), from day 2
create table public.event_joy_more (
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  more       text[] not null default '{}' check (cardinality(more) <= 6 and public.short_words(more, 40)),
  wish       text check (char_length(wish) <= 140),
  updated_at timestamptz not null default now(),
  primary key (spark_id, user_id)
);
alter table public.event_joy_more enable row level security;
create policy "your own wishes, and the hosts" on public.event_joy_more for select to authenticated
  using (user_id = auth.uid() or public.is_host(spark_id));
create policy "add your own wishes" on public.event_joy_more for insert to authenticated
  with check (user_id = auth.uid() and public.joy_can(spark_id));
create policy "change your own wishes" on public.event_joy_more for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.joy_can(spark_id));
create policy "delete your own wishes" on public.event_joy_more for delete to authenticated
  using (user_id = auth.uid());
revoke all on table public.event_joy_more from anon, authenticated;
grant select, delete on table public.event_joy_more to authenticated;
grant insert (spark_id, user_id, more, wish) on table public.event_joy_more to authenticated;
grant update (more, wish, updated_at) on table public.event_joy_more to authenticated;

-- MORE JOY NEXT TIME: each wish chip and how many picked it, no names, no lines; nothing before day 2 (the event's last
-- day + 2, Central time), and only for someone who can see the event. The lead's own step 2 isn't here (next_time_notes)
create or replace function public.joy_more_counts(p_spark uuid)
returns table (wish text, n integer) language sql stable security definer set search_path = public as $$
  select w, count(*)::int
    from sparks s join event_joy_more m on m.spark_id = s.id, unnest(m.more) w
   where s.id = p_spark and public.can_see_spark(s.id)
     and private.event_last_day(s.day_date, s.schedule) + 2 <= (now() at time zone 'America/Chicago')::date
   group by w order by 2 desc, 1
$$;
revoke all on function public.joy_more_counts(uuid) from public, anon;
grant execute on function public.joy_more_counts(uuid) to authenticated;

-- 3. Thanks, person to person: public on the event (THANKS GIVEN); the person thanked must be one of the event's people
-- (a host, someone who went or who held a job or spot), not yourself
create table public.event_thanks (
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  from_user  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  to_user    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (spark_id, from_user, to_user),
  check (from_user <> to_user)
);
create index event_thanks_to on public.event_thanks (to_user, created_at desc);
alter table public.event_thanks enable row level security;

create or replace function public.joy_person(p_spark uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user = any(private.host_ids(p_spark))
      or exists (select 1 from rsvps r where r.spark_id = p_spark and r.user_id = p_user and (r.status = 'going' or r.attended))
      or exists (select 1 from signup_claims c join signup_items i on i.id = c.item_id where i.spark_id = p_spark and c.user_id = p_user)
$$;
revoke all on function public.joy_person(uuid, uuid) from public, anon;
grant execute on function public.joy_person(uuid, uuid) to authenticated;

create policy "anyone who can see the event reads its thanks" on public.event_thanks for select to authenticated
  using (public.can_see_spark(spark_id));
create policy "thank someone who was there" on public.event_thanks for insert to authenticated
  with check (from_user = auth.uid() and public.joy_can(spark_id) and public.joy_person(spark_id, to_user));
create policy "take back your own thanks" on public.event_thanks for delete to authenticated
  using (from_user = auth.uid());
revoke all on table public.event_thanks from anon, authenticated;
grant select, delete on table public.event_thanks to authenticated;
grant insert (spark_id, from_user, to_user) on table public.event_thanks to authenticated;

-- The person thanked gets one push per event (the first thanks); the bell groups the rest. Topic thanks; test and demo
-- events stay quiet. Rate: 40 thanks an hour per person
create or replace function private.push_thanks() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; v_who text; v_for text;
begin
  if not private.rate_ok(new.from_user, 'thanks', 40, interval '1 hour', null) then
    raise exception 'too many thanks' using errcode = 'PT429';
  end if;
  if exists (select 1 from event_thanks t where t.spark_id = new.spark_id and t.to_user = new.to_user and t.from_user <> new.from_user) then return new; end if;
  select id, text, demo, test into s from sparks where id = new.spark_id;
  if s.demo or coalesce(s.test, false) or s.text like '[E2E]%' then return new; end if;
  v_who := private.person_name(new.from_user, s.id);
  select i.item into v_for from signup_claims c join signup_items i on i.id = c.item_id
   where i.spark_id = s.id and c.user_id = new.to_user order by c.created_at limit 1;
  perform private.push_send(array[new.to_user], 'thanks', left(s.text, 120),
    v_who || ' thanked you' || coalesce(' for ' || v_for, case when new.to_user = any(private.host_ids(s.id)) then ' for leading' else '' end) || ' 🙏',
    '/#/idea/' || s.id, 'th:' || s.id);
  return new;
end $$;
create trigger push_thanks before insert on public.event_thanks for each row execute function private.push_thanks();

-- 4. The lead's step 2 stays in next_time_notes: up to 12 picks (I could… and more joy), and co-leads read each other's
alter table public.next_time_notes drop constraint if exists next_time_notes_picks_check;
alter table public.next_time_notes add constraint next_time_notes_picks_check check (cardinality(picks) <= 12);
create policy "co-leads read the event's notes" on public.next_time_notes for select to authenticated
  using (public.is_host(spark_id));

-- 5. The scheduled pushes (every 15 minutes, once each per event and day; Central time). None for guests (anonymous
-- accounts), cancelled, test, demo or [E2E] events
create table private.joy_pushes (
  spark_id uuid not null,
  kind     text not null,
  day      date not null,
  sent_at  timestamptz not null default now(),
  primary key (spark_id, kind, day)
);
revoke all on table private.joy_pushes from public, anon, authenticated;

create or replace function private.push_joy() returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_now timestamp := now() at time zone 'America/Chicago'; v_today date := (now() at time zone 'America/Chicago')::date;
  s record; d record; went uuid[]; hosts uuid[]; v_lead text; v_last date;
begin
  for s in select id, text, day_date, day_time, schedule, lead_id from sparks
            where planned and cancelled_at is null and not demo and not coalesce(test, false) and text not like '[E2E]%'
              and day_date is not null and day_date <= v_today and day_date >= v_today - 40 loop
    hosts := private.host_ids(s.id);
    v_last := private.event_last_day(s.day_date, s.schedule);
    -- ~40 minutes in, on each day it happens: everyone Going (accounts only)
    for d in select e.day, e.day_time from private.event_days(s.day_date, s.day_time, s.schedule, v_today) e
              where e.day = v_today and e.day_time is not null loop
      if v_now >= d.day + d.day_time + interval '40 minutes' and v_now < d.day + d.day_time + interval '4 hours'
         and not exists (select 1 from private.joy_pushes where spark_id = s.id and kind = 'photo' and day = v_today) then
        insert into private.joy_pushes (spark_id, kind, day) values (s.id, 'photo', v_today);
        select array_agg(r.user_id) into went from rsvps r join auth.users u on u.id = r.user_id
         where r.spark_id = s.id and r.status = 'going' and not coalesce(u.is_anonymous, false);
        perform private.push_send(went, 'joyphoto', '📸 ' || left(s.text, 100) || ' is happening', 'Snap a photo for the album.', '/#/idea/' || s.id || '/photo', 'jp:' || s.id);
      end if;
    end loop;
    if v_last is null or v_last >= v_today then continue; end if;
    v_lead := private.person_name(s.lead_id, s.id);
    select array_agg(distinct r.user_id) into went from rsvps r join auth.users u on u.id = r.user_id
     where r.spark_id = s.id and (r.status = 'going' or r.attended) and not coalesce(u.is_anonymous, false) and r.user_id <> all(hosts);
    -- The morning after, ~9:30am: who went, and the hosts
    if v_last = v_today - 1 and v_now >= v_today + time '09:30'
       and not exists (select 1 from private.joy_pushes where spark_id = s.id and kind = 'after' and day = v_today) then
      insert into private.joy_pushes (spark_id, kind, day) values (s.id, 'after', v_today);
      perform private.push_send(went, 'joyask', 'How was ' || left(s.text, 100) || '?', 'What gave you joy? Thank ' || v_lead || ' and the helpers.', '/#/idea/' || s.id || '/joy', 'ja:' || s.id);
      perform private.push_send(hosts, 'joyask', 'Thank your helpers for ' || left(s.text, 100), 'Add photos and share what gave you joy.', '/#/idea/' || s.id || '/joy', 'ja:' || s.id);
    end if;
    -- Day 2, 10am: only who went and did nothing yet (no joy, no thanks)
    if v_last = v_today - 2 and v_now >= v_today + time '10:00'
       and not exists (select 1 from private.joy_pushes where spark_id = s.id and kind = 'day2' and day = v_today) then
      insert into private.joy_pushes (spark_id, kind, day) values (s.id, 'day2', v_today);
      select array_agg(x) into went from unnest(went) x
       where not exists (select 1 from event_joy j where j.spark_id = s.id and j.user_id = x)
         and not exists (select 1 from event_thanks t where t.spark_id = s.id and t.from_user = x);
      perform private.push_send(went, 'joyask', 'Still time to thank ' || v_lead, 'Add your photos from ' || left(s.text, 100) || '.', '/#/idea/' || s.id || '/joy', 'ja:' || s.id);
    end if;
  end loop;
  delete from private.joy_pushes where day < v_today - 60;
end $$;
revoke all on function private.push_joy() from public, anon, authenticated;
do $$ begin
  perform cron.schedule('push-joy', '*/15 * * * *', 'select private.push_joy()');
exception when others then raise warning 'push-joy schedule: %', sqlerrm;   -- no pg_cron (the local checks)
end $$;
