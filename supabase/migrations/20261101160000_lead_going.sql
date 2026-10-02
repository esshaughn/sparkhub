-- The lead is Going to their own plan (owner, 2026-10-01). It used to be that a lead couldn't RSVP and wasn't counted.
-- Now the lead is marked Going when an event becomes a plan (posted with a date, or Make it a plan) and can change it
-- like anyone (Maybe, Can't). Co-leads reply for themselves. When a plan goes back to being an idea, its leads don't
-- turn into "interested" in their own idea. push_host already skips a lead's own reply (who = any(hosts)).

-- 1. Posted as a plan: the lead is Going
create or replace function private.lead_going() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.planned and new.lead_id is not null and new.cancelled_at is null then
    insert into rsvps (spark_id, user_id, status) values (new.id, new.lead_id, 'going')
    on conflict (spark_id, user_id) do nothing;
  end if;
  return null;
end $$;
revoke all on function private.lead_going() from public, anon, authenticated;
create trigger lead_going after insert on public.sparks for each row execute function private.lead_going();

-- 2. Make it a plan: the lead too (as before, interested people become Going; co-leads reply themselves)
create or replace function public.make_plan(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_host(p_spark) then
    raise exception 'only a host can make it a plan' using errcode = '42501';
  end if;
  if exists (select 1 from sparks where id = p_spark and day_date is null) then
    raise exception 'pick a date first' using errcode = '23514';
  end if;
  update sparks set planned = true where id = p_spark and not planned;
  insert into rsvps (spark_id, user_id, status)
  select id, lead_id, 'going' from sparks where id = p_spark and lead_id is not null and cancelled_at is null
  on conflict (spark_id, user_id) do nothing;
  insert into rsvps (spark_id, user_id, status)
  select i.spark_id, i.user_id, 'going' from interests i
   where i.spark_id = p_spark and not exists (select 1 from cohosts c where c.spark_id = p_spark and c.user_id = i.user_id)
  on conflict (spark_id, user_id) do nothing;
end $$;

-- 3. Back to an idea: Going becomes interested, except the leads (the lead and co-leads)
create or replace function public.clear_plan(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_who text;
begin
  select id, text, lead_id, planned into s from sparks where id = p_spark;
  if s.id is null or not public.is_host(p_spark) then
    raise exception 'only a host can clear the date' using errcode = '42501';
  end if;
  if s.planned then
    select coalesce(nullif(p.name, ''), 'The lead') into v_who from profiles p where p.id = auth.uid();
    insert into notes (user_id, body, created_by)
      select u, left(left(s.text, 120) || ' is off the calendar for now. ' || coalesce(v_who, 'The lead') || ' turned it back into an idea.', 320), auth.uid()
        from (select r.user_id as u from rsvps r where r.spark_id = p_spark and r.status = 'going'
              union select unnest(private.host_ids(p_spark))) x
       where u <> auth.uid();
  end if;
  insert into interests (spark_id, user_id)
  select spark_id, user_id from rsvps
   where spark_id = p_spark and status = 'going' and user_id <> all(private.host_ids(p_spark))
  on conflict do nothing;
  delete from rsvps where spark_id = p_spark;
  update sparks set planned = false, day_date = null, day_time = null, day_end = null, day = null where id = p_spark;
end $$;

-- 4. Plans still to come: their lead is Going (unless they already replied)
insert into rsvps (spark_id, user_id, status)
select s.id, s.lead_id, 'going' from sparks s
 where s.planned and s.lead_id is not null and s.cancelled_at is null
   and s.day_date >= (now() at time zone 'America/Chicago')::date
on conflict (spark_id, user_id) do nothing;
