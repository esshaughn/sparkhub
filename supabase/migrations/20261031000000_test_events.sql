-- Test events: when posting, the host says whether an event is real or a test, so members can try
-- the app without committing to a real get-together. A test event shows the same DEMO chip as the
-- seeded demo content but is its own flag: wipe_demo() and the seed scripts (which delete
-- sparks.demo rows) never touch members' test events.
--
-- Set only when posting (insert), never changed afterwards (no update grant). Test events don't push:
-- no "New in…" / "It's a plan" alerts to the group and no day-before or morning-of reminders.
-- Replies to the host (RSVPs, interest, sign-ups) still notify as usual.

alter table public.sparks add column if not exists test boolean not null default false;

-- 1. No new-event / new-idea push for test events (sparks and spark_groups inserts)
create or replace function private.push_new_event() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; g text; home uuid; users uuid[];
begin
  if auth.uid() is null then return null; end if;
  if tg_table_name = 'sparks' then
    select new.id as id, new.text as text, new.group_id as group_id, new.lead_id as lead_id, new.planned as planned,
           new.visibility as visibility, new.day_date as day_date, new.day_time as day_time, new.spot as spot, new.test as test into s;
  else   -- spark_groups: tell that group's members who aren't in the event's home group
    select id, text, new.group_id as group_id, lead_id, planned, visibility, day_date, day_time, spot, test, group_id as home
      into s from sparks where id = new.spark_id;
    home := s.home;
  end if;
  if s.visibility <> 'group' or s.test then return null; end if;
  select name into g from groups where id = s.group_id;
  select array_agg(m.user_id) into users from memberships m
   where m.group_id = s.group_id and m.user_id <> s.lead_id
     and (home is null or not exists (select 1 from memberships h where h.group_id = home and h.user_id = m.user_id));
  if s.planned then
    perform private.push_send(users, 'newevents', 'New in ' || coalesce(g, 'your group') || ': ' || s.text,
      private.when_text(s.day_date, s.day_time, s.spot) || '. RSVP in Spark Hub.', '/#/idea/' || s.id, 'e:' || s.id);
  else
    perform private.push_send(users, 'newevents', 'New idea in ' || coalesce(g, 'your group') || ': ' || s.text,
      private.person_name(s.lead_id, s.id) || ' is floating it. Tap I’m interested if you’d come.', '/#/idea/' || s.id, 'i:' || s.id);
  end if;
  return null;
end $$;

-- 2. No "It's a plan" push when a test idea is locked in
drop trigger if exists push_made_plan on public.sparks;
create trigger push_made_plan after update of planned on public.sparks
  for each row when (new.planned and not old.planned and not new.test) execute function private.push_made_plan();

-- 3. No reminders for test events
create or replace function private.push_daily() returns void language plpgsql security definer set search_path = public, extensions as $$
declare s record; users uuid[]; today date := (now() at time zone 'America/Chicago')::date;
begin
  for s in select id, text, day_date, day_time, spot, lead_id from sparks
            where planned and not demo and not test and auto_remind and cancelled_at is null and day_date in (today, today + 1) loop
    select array_agg(distinct u) into users from (
      select user_id as u from rsvps where spark_id = s.id and status in ('going', 'maybe')
      union select c.user_id from signup_claims c join signup_items i on i.id = c.item_id where i.spark_id = s.id) x
     where u <> s.lead_id;
    perform private.push_send(users, 'reminders', (case when s.day_date = today then 'Today: ' else 'Tomorrow: ' end) || s.text,
      private.when_text(s.day_date, s.day_time, s.spot), '/#/idea/' || s.id, 'r:' || s.id || ':' || s.day_date || (case when s.day_date = today then ':0' else ':1' end));
  end loop;
  begin
    delete from push_subscriptions where endpoint in (
      select jsonb_array_elements_text(r.content::jsonb -> 'gone') from net._http_response r
       where r.created > now() - interval '2 days' and r.status_code = 200 and r.content like '{%');
  exception when others then raise warning 'push cleanup: %', sqlerrm;
  end;
end $$;
