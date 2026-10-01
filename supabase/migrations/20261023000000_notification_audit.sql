-- Notification audit (owner, 2026-09-30)
--  1. Hosts hear about a reply only when the person replied themselves: a job sign-up's automatic Going is
--     silent (the sign-up already notified), and so are rows the system moves (make_plan / clear_plan).
--  2. Interest in an idea reaches the host's phone, like a reply.
--  3. New ideas buzz the group too ("New idea in {group}: …"), not just plans.
--  4. A morning-of reminder at 8am Austin time, besides the day-before one, for people going, maybe or helping.

-- 1 + 2: the host's replies, sign-ups, suggestions and (new) interest
create or replace function private.push_host() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; who uuid; msg text; tag text;
begin
  if auth.uid() is null then return null; end if;
  if tg_table_name = 'signup_claims' then
    select sp.id, sp.text, sp.lead_id, i.item into s from signup_items i join sparks sp on sp.id = i.spark_id where i.id = new.item_id;
  else
    select id, text, lead_id, null::text as item into s from sparks where id = new.spark_id;
  end if;
  if tg_table_name = 'rsvps' then
    if tg_op = 'UPDATE' and new.status = old.status then return null; end if;
    if new.user_id is distinct from auth.uid() then return null; end if;   -- moved by make_plan, not a reply
    -- Taking a job marks you Going: the sign-up's own notification covers it
    if new.status = 'going' and exists (select 1 from signup_claims c join signup_items i on i.id = c.item_id
                                         where i.spark_id = new.spark_id and c.user_id = new.user_id
                                           and c.created_at > now() - interval '2 minutes') then return null; end if;
    who := new.user_id;
    msg := private.person_name(who, s.id) || case new.status when 'going' then ' is going to ' when 'maybe' then ' might come to ' else ' can’t make it to ' end || s.text;
    tag := 'rv:' || s.id || ':' || who;
  elsif tg_table_name = 'interests' then
    if new.user_id is distinct from auth.uid() then return null; end if;   -- moved by clear_plan, not interest
    who := new.user_id;
    msg := private.person_name(who, s.id) || ' is interested in ' || s.text;
    tag := 'i:' || s.id || ':' || who;
  elsif tg_table_name = 'signup_claims' then
    who := new.user_id;
    msg := private.person_name(who, s.id) || ' signed up for “' || s.item || '” at ' || s.text;
    tag := 's:' || new.item_id || ':' || who;
  elsif tg_table_name = 'date_options' then
    who := new.created_by;
    msg := coalesce(nullif(new.who, ''), private.person_name(who, s.id)) || ' suggested ' || to_char(new.day_date, 'Dy, Mon FMDD') || ' for ' || s.text;
    tag := 'd:' || new.id;
  else
    who := new.created_by;
    msg := coalesce(nullif(new.who, ''), private.person_name(who, s.id)) || ' suggested ' || new.name || ' for ' || s.text;
    tag := 'p:' || new.id;
  end if;
  if who is null or who = s.lead_id then return null; end if;
  perform private.push_send(array[s.lead_id], 'hosting', s.text, msg, '/#/idea/' || s.id, tag);
  return null;
end $$;
drop trigger if exists push_host_interest on public.interests;
create trigger push_host_interest after insert on public.interests for each row execute function private.push_host();

-- 3: new events and new ideas in your group
create or replace function private.push_new_event() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; g text; home uuid; users uuid[];
begin
  if auth.uid() is null then return null; end if;
  if tg_table_name = 'sparks' then
    select new.id as id, new.text as text, new.group_id as group_id, new.lead_id as lead_id, new.planned as planned,
           new.visibility as visibility, new.day_date as day_date, new.day_time as day_time, new.spot as spot into s;
  else   -- spark_groups: tell that group's members who aren't in the event's home group
    select id, text, new.group_id as group_id, lead_id, planned, visibility, day_date, day_time, spot, group_id as home
      into s from sparks where id = new.spark_id;
    home := s.home;
  end if;
  if s.visibility <> 'group' then return null; end if;
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

-- 4: the day-before reminder, plus a morning-of one (8am Austin), for going, maybe or helping
create or replace function private.push_daily() returns void language plpgsql security definer set search_path = public, extensions as $$
declare s record; users uuid[]; today date := (now() at time zone 'America/Chicago')::date;
begin
  for s in select id, text, day_date, day_time, spot, lead_id from sparks
            where planned and not demo and auto_remind and day_date in (today, today + 1) loop
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
