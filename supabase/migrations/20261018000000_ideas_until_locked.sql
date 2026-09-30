-- Ideas until the host locks it in (owner, 2026-09-30).
-- * An idea is any event its host hasn't made a plan: no date yet, or a date not locked in.
-- * A plan needs a date (a time and a place may still be to be decided). The host makes it a plan
--   with make_plan() and can turn it back into an idea with clear_plan().
-- * Plans posted without a date since v6 Update 6 become ideas: their Going people become interested
--   and their other RSVPs go (ideas take no RSVPs).
-- * Making it a plan tells the groups (push), like posting a plan does. Turning it back into an idea
--   tells everyone who was going (a note, which also pushes).

-- 1. Undated plans become ideas
insert into public.interests (spark_id, user_id)
select r.spark_id, r.user_id from public.rsvps r join public.sparks s on s.id = r.spark_id
 where s.planned and s.day_date is null and r.status = 'going'
on conflict do nothing;
delete from public.rsvps r using public.sparks s
 where s.id = r.spark_id and s.planned and s.day_date is null;
update public.sparks set planned = false where planned and day_date is null;

-- 2. A plan has a date
alter table public.sparks add constraint sparks_plan_has_date check (not planned or day_date is not null);

-- 3. Make it a plan: the lead, and only with a date
create or replace function public.make_plan(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from sparks where id = p_spark and lead_id = auth.uid()) then
    raise exception 'only the lead can make it a plan' using errcode = '42501';
  end if;
  if exists (select 1 from sparks where id = p_spark and day_date is null) then
    raise exception 'pick a date first' using errcode = '23514';
  end if;
  update sparks set planned = true where id = p_spark and not planned;
  insert into rsvps (spark_id, user_id, status)
  select spark_id, user_id, 'going' from interests where spark_id = p_spark
  on conflict (spark_id, user_id) do nothing;
end $$;

-- 4. Back to an idea: the date comes off, Going turns back into interested, and everyone going hears
create or replace function public.clear_plan(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_who text;
begin
  select id, text, lead_id, planned into s from sparks where id = p_spark;
  if s.id is null or s.lead_id is distinct from auth.uid() then
    raise exception 'only the lead can clear the date' using errcode = '42501';
  end if;
  if s.planned then
    select coalesce(nullif(p.name, ''), 'The host') into v_who from profiles p where p.id = auth.uid();
    insert into notes (user_id, body, created_by)
      select r.user_id, left(left(s.text, 120) || ' is off the calendar for now. ' || coalesce(v_who, 'The host') || ' turned it back into an idea.', 320), auth.uid()
        from rsvps r where r.spark_id = p_spark and r.status = 'going' and r.user_id <> auth.uid();
  end if;
  insert into interests (spark_id, user_id)
  select spark_id, user_id from rsvps where spark_id = p_spark and status = 'going'
  on conflict do nothing;
  delete from rsvps where spark_id = p_spark;
  update sparks set planned = false, day_date = null, day_time = null, day_end = null, day = null where id = p_spark;
end $$;

revoke execute on function public.make_plan(uuid), public.clear_plan(uuid) from public, anon;
grant  execute on function public.make_plan(uuid), public.clear_plan(uuid) to authenticated;

-- 5. An idea made a plan: tell its groups' members (as a new plan would), not the lead
create function private.push_made_plan() returns trigger language plpgsql security definer set search_path = public as $$
declare g text; users uuid[];
begin
  if auth.uid() is null or new.visibility <> 'group' then return null; end if;
  select name into g from groups where id = new.group_id;
  select array_agg(distinct m.user_id) into users from memberships m
   where (m.group_id = new.group_id or m.group_id in (select group_id from spark_groups where spark_id = new.id))
     and m.user_id <> new.lead_id;
  perform private.push_send(users, 'newevents', 'It’s a plan in ' || coalesce(g, 'your group') || ': ' || new.text,
    private.when_text(new.day_date, new.day_time, new.spot) || '. RSVP in Spark Hub.', '/#/idea/' || new.id, 'e:' || new.id);
  return null;
end $$;
create trigger push_made_plan after update of planned on public.sparks
  for each row when (new.planned and not old.planned) execute function private.push_made_plan();
