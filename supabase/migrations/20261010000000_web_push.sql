-- Web push (2026-09-29): phone notifications for the installed home-screen app and browsers.
-- * push_subscriptions: one row per device (its endpoint), owned by the signed-in person on it.
-- * Triggers work out who to tell (the same rules as the in-app feed, and each person's topics
--   in notif_state) and hand the device list to /api/push (Vercel), which signs and sends them.
--   The function's address and shared secret live in private.push_config, set per database by
--   hand (never in git); with no row there, nothing is sent.
-- * A daily job at 13:00 UTC (8am in Austin) sends day-before reminders and clears dead devices.
-- Rows the service role writes (the demo seed scripts) never push.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table public.push_subscriptions (
  endpoint   text primary key check (char_length(endpoint) between 10 and 1000 and endpoint like 'https://%'),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  p256dh     text not null check (char_length(p256dh) between 20 and 200),
  auth       text not null check (char_length(auth) between 10 and 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "your own devices" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "forget your own devices" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());
revoke all on table public.push_subscriptions from anon;
grant select, delete on table public.push_subscriptions to authenticated;

-- Save this device for you (it moves over if someone else signed in on it before)
create function public.save_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_signed_in() then raise exception 'sign in first'; end if;
  delete from push_subscriptions where endpoint = p_endpoint;
  insert into push_subscriptions (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth);
end $$;
revoke all on function public.save_push(text, text, text) from public, anon;
grant execute on function public.save_push(text, text, text) to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.push_config (
  id     int primary key default 1 check (id = 1),
  url    text not null,
  secret text not null
);

-- Send one message to these people's devices (skipping anyone who turned the topic off)
create function private.push_send(p_users uuid[], p_topic text, p_title text, p_body text, p_url text, p_tag text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare c record; subs jsonb;
begin
  select url, secret into c from private.push_config where id = 1;
  if c.url is null or p_users is null or cardinality(p_users) = 0 then return; end if;
  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)))
    into subs
    from push_subscriptions s
   where s.user_id = any(p_users)
     and not exists (select 1 from notif_state n where n.user_id = s.user_id and n.topics ->> p_topic = 'false');
  if subs is null then return; end if;
  perform net.http_post(
    url := c.url,
    body := jsonb_build_object('subs', subs, 'title', left(coalesce(p_title, 'Spark Hub'), 120), 'body', left(coalesce(p_body, ''), 240), 'url', p_url, 'tag', p_tag),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', c.secret),
    timeout_milliseconds := 8000);
exception when others then
  raise warning 'push_send: %', sqlerrm;   -- a push must never break the write that caused it
end $$;

create function private.person_name(p_user uuid, p_spark uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(split_part(trim(name), ' ', 1), '') from profiles where id = p_user),
    (select nullif(split_part(trim(name), ' ', 1), '') from guest_contacts where user_id = p_user and spark_id = p_spark),
    'Someone');
$$;

create function private.when_text(p_date date, p_time time, p_spot text)
returns text language sql stable as $$
  select concat_ws(' · ',
    case when p_date is null then 'Date to be decided'
         else to_char(p_date, 'Dy, Mon FMDD') || coalesce(' at ' || to_char(p_date + p_time, 'FMHH12:MIam'), '') end,
    p_spot);
$$;

-- 1. A new event in your group (or posted to one more of your groups)
create function private.push_new_event() returns trigger language plpgsql security definer set search_path = public as $$
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
  if not s.planned or s.visibility <> 'group' then return null; end if;
  select name into g from groups where id = s.group_id;
  select array_agg(m.user_id) into users from memberships m
   where m.group_id = s.group_id and m.user_id <> s.lead_id
     and (home is null or not exists (select 1 from memberships h where h.group_id = home and h.user_id = m.user_id));
  perform private.push_send(users, 'newevents', 'New in ' || coalesce(g, 'your group') || ': ' || s.text,
    private.when_text(s.day_date, s.day_time, s.spot) || '. RSVP in Spark Hub.', '/#/idea/' || s.id, 'e:' || s.id);
  return null;
end $$;
create trigger push_new_event after insert on public.sparks for each row execute function private.push_new_event();
create trigger push_new_event_group after insert on public.spark_groups for each row execute function private.push_new_event();

-- 2. An update from the host (the same audiences as the in-app feed)
create function private.push_update() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; users uuid[];
begin
  if auth.uid() is null then return null; end if;
  select id, text, group_id into s from sparks where id = new.spark_id;
  if new.audience = 'noreply' then
    select array_agg(distinct m.user_id) into users from memberships m
     where (m.group_id = s.group_id or m.group_id in (select group_id from spark_groups where spark_id = s.id))
       and not exists (select 1 from rsvps r where r.spark_id = s.id and r.user_id = m.user_id);
  elsif new.audience in ('going', 'maybe') then
    select array_agg(r.user_id) into users from rsvps r where r.spark_id = s.id and r.status = new.audience;
  else
    select array_agg(distinct u) into users from (
      select user_id as u from rsvps where spark_id = s.id
      union select c.user_id from signup_claims c join signup_items i on i.id = c.item_id where i.spark_id = s.id) x;
  end if;
  users := array_remove(users, new.created_by);
  perform private.push_send(users, 'updates', s.text, new.body, '/#/idea/' || s.id, 'u:' || new.id);
  return null;
end $$;
create trigger push_update after insert on public.plan_updates for each row execute function private.push_update();

-- 3. A note (an event taken down, a job removed)
create function private.push_note() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform private.push_send(array[new.user_id], 'updates', 'Spark Hub', new.body, '/#/notifications', 'n:' || new.id);
  return null;
end $$;
create trigger push_note after insert on public.notes for each row execute function private.push_note();

-- 4. For hosts: replies, sign-ups and suggestions
create function private.push_host() returns trigger language plpgsql security definer set search_path = public as $$
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
    who := new.user_id;
    msg := private.person_name(who, s.id) || case new.status when 'going' then ' is going to ' when 'maybe' then ' might come to ' else ' can’t make it to ' end || s.text;
    tag := 'rv:' || s.id || ':' || who;
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
create trigger push_host_rsvp after insert or update of status on public.rsvps for each row execute function private.push_host();
create trigger push_host_claim after insert on public.signup_claims for each row execute function private.push_host();
create trigger push_host_date after insert on public.date_options for each row execute function private.push_host();
create trigger push_host_spot after insert on public.spot_options for each row execute function private.push_host();

-- 5. Daily: day-before reminders (not for demo events), then forget devices the push services
--    said are gone (/api/push lists them in its reply, which pg_net keeps for a while)
create function private.push_daily() returns void language plpgsql security definer set search_path = public, extensions as $$
declare s record; users uuid[];
begin
  for s in select id, text, day_date, day_time, spot, lead_id from sparks
            where planned and not demo and auto_remind
              and day_date = (now() at time zone 'America/Chicago')::date + 1 loop
    select array_agg(user_id) into users from rsvps where spark_id = s.id and status in ('going', 'maybe') and user_id <> s.lead_id;
    perform private.push_send(users, 'reminders', 'Tomorrow: ' || s.text, private.when_text(s.day_date, s.day_time, s.spot), '/#/idea/' || s.id, 'r:' || s.id);
  end loop;
  begin
    delete from push_subscriptions where endpoint in (
      select jsonb_array_elements_text(r.content::jsonb -> 'gone') from net._http_response r
       where r.created > now() - interval '2 days' and r.status_code = 200 and r.content like '{%');
  exception when others then raise warning 'push cleanup: %', sqlerrm;
  end;
end $$;

select cron.unschedule('push-daily') where exists (select 1 from cron.job where jobname = 'push-daily');
select cron.schedule('push-daily', '0 13 * * *', 'select private.push_daily()');
