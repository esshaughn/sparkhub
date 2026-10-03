-- Soft holds (HANDOFF-to-CODE, after Update 16; brief SOFT-HOLDS-for-design.md, owner 2026-10-02/03) and an idea's
-- No help needed (Design 23C1).
--
-- An open date poll pencils its dates in on the Calendar until sparks.hold_until (America/Chicago date). It's set
-- when the poll's first date goes up (7 days on), moved on only by keep_holding() (the lead or a co-lead), and never
-- by a client write. The two lead reminders go out from the daily job; hold_nudged_at makes "Lock it in?" once a poll.

alter table public.sparks
  add column if not exists hold_until date,
  add column if not exists hold_nudged_at timestamptz,
  add column if not exists no_help boolean not null default false;

-- No help needed is the lead's answer, like the other editable columns (the update policy checks is_host)
grant update (no_help) on table public.sparks to authenticated;

-- Posting can't set a hold or the nudge stamp (otherwise the same as 20261102020000_float_and_ask.sql)
create or replace function public.sparks_insert_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.demo := false;
    new.created_at := now();
    new.hold_until := null;
    new.hold_nudged_at := null;
  end if;
  if new.planned then new.wants_host := false; end if;
  return new;
end $$;

-- The poll's first date starts the hold; later dates share its end (they don't restart the 7 days)
create or replace function private.start_hold() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update sparks set hold_until = (now() at time zone 'America/Chicago')::date + 7
   where id = new.spark_id and hold_until is null and not planned and day_date is null;
  return null;
end $$;
drop trigger if exists start_hold on public.date_options;
create trigger start_hold after insert on public.date_options for each row execute function private.start_hold();

-- Keep holding / Hold them again: another 7 days from today. Hosts only, on an open poll of an idea that isn't cancelled
create or replace function public.keep_holding(p_spark uuid) returns date
language plpgsql security definer set search_path = public as $$
declare v date := (now() at time zone 'America/Chicago')::date + 7;
begin
  if not public.is_host(p_spark) then raise exception 'Only the lead can keep the dates held' using errcode = '42501'; end if;
  update sparks set hold_until = v, hold_nudged_at = null
   where id = p_spark and not planned and day_date is null and cancelled_at is null
     and exists (select 1 from date_options o where o.spark_id = p_spark);
  if not found then raise exception 'Nothing to hold' using errcode = 'P0002'; end if;
  return v;
end $$;
revoke all on function public.keep_holding(uuid) from public, anon;
grant execute on function public.keep_holding(uuid) to authenticated;

-- Open polls already running get 7 days from their first date (many have lapsed; the lead can hold them again)
update public.sparks s set hold_until = (select (min(o.created_at) at time zone 'America/Chicago')::date + 7 from public.date_options o where o.spark_id = s.id)
 where not s.planned and s.day_date is null and s.hold_until is null
   and exists (select 1 from public.date_options o where o.spark_id = s.id);

-- The daily job (otherwise the same as 20261101130000_cohosts.sql) adds the lead's two hold reminders, topic hosting:
-- once a poll, when one date has 3+ votes and more than any other; and the day before the holds lapse
create or replace function private.push_daily() returns void language plpgsql security definer set search_path = public, extensions as $$
declare s record; users uuid[]; today date := (now() at time zone 'America/Chicago')::date; top record;
begin
  for s in select id, text, day_date, day_time, spot, lead_id from sparks
            where planned and not demo and not test and auto_remind and cancelled_at is null and day_date in (today, today + 1) loop
    select array_agg(distinct u) into users from (
      select user_id as u from rsvps where spark_id = s.id and status in ('going', 'maybe')
      union select c.user_id from signup_claims c join signup_items i on i.id = c.item_id where i.spark_id = s.id) x
     where u <> all(private.host_ids(s.id));
    perform private.push_send(users, 'reminders', (case when s.day_date = today then 'Today: ' else 'Tomorrow: ' end) || s.text,
      private.when_text(s.day_date, s.day_time, s.spot), '/#/idea/' || s.id, 'r:' || s.id || ':' || s.day_date || (case when s.day_date = today then ':0' else ':1' end));
  end loop;

  -- Soft holds: only ideas with a lead (not looking for one), never test or demo events
  for s in select id, text, lead_id, hold_until, hold_nudged_at from sparks
            where not planned and day_date is null and cancelled_at is null and not demo and not test and not wants_host
              and lead_id is not null and hold_until >= today loop
    if s.hold_nudged_at is null then
      select o.day_date, count(v.user_id) as n,
             count(v.user_id) > coalesce((select max(c) from (select count(v2.user_id) as c from date_options o2 left join date_votes v2 on v2.option_id = o2.id
                                                                where o2.spark_id = s.id and o2.id <> o.id group by o2.id) z), 0) as alone,
             (select count(distinct v3.user_id) from date_votes v3 join date_options o3 on o3.id = v3.option_id where o3.spark_id = s.id) as voters
        into top
        from date_options o left join date_votes v on v.option_id = o.id
       where o.spark_id = s.id and o.day_date >= today
       group by o.id, o.day_date order by count(v.user_id) desc limit 1;
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
