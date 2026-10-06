-- v8-8 (Design's HANDOFF-to-CODE, round v8-8): ideas with a lead, Make it a plan!, Discussion behind sign-in.

-- 1. Make it a plan! (Q31 1e): everyone interested moves to Maybe (was Going) and gets one push,
--    "{title} is on: {date}". The rest as 20261102000000_review_fixes.sql: a host, a lead, a date that hasn't passed.
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
  if exists (select 1 from sparks where id = p_spark and day_date < (now() at time zone 'America/Chicago')::date) then
    raise exception 'that date has passed' using errcode = '23514';
  end if;
  select id, text, planned, lead_id, day_date, day_time, spot, demo, test, cancelled_at into s from sparks where id = p_spark;
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
      private.when_text(s.day_date, s.day_time, s.spot) || '. You’re down as Maybe.', '/#/idea/' || s.id, 'mp:' || s.id);
  end if;
end $$;

-- 2. No new-idea push at all: ideas only come from Float an idea now (Plan an event needs a date, v8-6), and floating
--    is quiet (owner, 2026-10-02), with Who leads it = Me too (v8-8 item 6). Otherwise as 20261102020000_float_and_ask.sql
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
  if s.visibility <> 'group' or s.test or not s.planned then return null; end if;
  select name into g from groups where id = s.group_id;
  select array_agg(m.user_id) into users from memberships m
   where m.group_id = s.group_id and m.user_id <> s.lead_id
     and (home is null or not exists (select 1 from memberships h where h.group_id = home and h.user_id = m.user_id));
  perform private.push_send(users, 'newevents', 'New in ' || coalesce(g, 'your group') || ': ' || s.text,
    private.when_text(s.day_date, s.day_time, s.spot) || '. RSVP in Spark Hub.', '/#/idea/' || s.id, 'e:' || s.id);
  return null;
end $$;

-- 3. Discussion on ideas (Q31: on from the start once there's a lead): the hosts and people interested write;
--    on a plan, people coming (Going or Maybe) as before. Signed-out visitors and guests without an account never
--    read or write it (Short links spec, owner Oct 6): they get a count from comment_count()
create or replace function public.can_comment(p_spark uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_see_spark(p_spark)
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
     and (public.is_host(p_spark)
          or exists (select 1 from rsvps r where r.spark_id = p_spark and r.user_id = auth.uid() and r.status in ('going', 'maybe'))
          or exists (select 1 from interests i join sparks s on s.id = i.spark_id
                      where i.spark_id = p_spark and i.user_id = auth.uid() and not s.planned));
$$;
revoke all on function public.can_comment(uuid) from public, anon;
grant execute on function public.can_comment(uuid) to authenticated;

drop policy "comments follow the event" on public.event_comments;
create policy "comments follow the event" on public.event_comments
  for select to authenticated
  using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false and public.can_see_spark(spark_id));

create or replace function public.comment_count(p_spark uuid) returns integer
language sql stable security definer set search_path = public as $$
  select case when public.can_see_spark(p_spark)
              then (select count(*)::int from event_comments where spark_id = p_spark)
                 + (select count(*)::int from plan_updates where spark_id = p_spark) end;
$$;
revoke all on function public.comment_count(uuid) from public;
grant execute on function public.comment_count(uuid) to anon, authenticated;
