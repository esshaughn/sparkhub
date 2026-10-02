-- Review fixes that need the database (owner, 2026-10-02):
--  1. A Maybe is treated like Going when a plan goes back to being an idea (clear_plan, step_back): they become
--     interested and get the note. They used to disappear with no word. Can't replies just go, as before.
--  2. make_plan() refuses a date that has passed (an idea whose lead stepped back keeps its date; nobody picking it up
--     in time used to leave "Make it a plan!" on a past date). Otherwise the same as 20261101200000_plan_needs_lead.sql.
--  3. Taking yourself off a job tells the leads: a note, which pushes like every note ("We'll let {lead} know" on the
--     You're off it banner sent nothing). Not on test or demo events (they stay silent), not when the claim is under
--     2 minutes old (Undo right after signing up), not when someone else removes it (remove_signup() already notes
--     the people signed up), and not when a lead takes themselves off their own event.

-- 1a. Turn it back into an idea: Going and Maybe become interested and get the note
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
        from (select r.user_id as u from rsvps r where r.spark_id = p_spark and r.status in ('going', 'maybe')
              union select unnest(private.host_ids(p_spark))) x
       where u <> auth.uid();
  end if;
  insert into interests (spark_id, user_id)
  select spark_id, user_id from rsvps
   where spark_id = p_spark and status in ('going', 'maybe') and user_id <> all(private.host_ids(p_spark))
  on conflict do nothing;
  delete from rsvps where spark_id = p_spark;
  update sparks set planned = false, day_date = null, day_time = null, day_end = null, day = null where id = p_spark;
end $$;

-- 1b. Step back with no co-lead: the same for Going and Maybe
create or replace function public.step_back(p_spark uuid)
returns text language plpgsql security definer set search_path = public as $$
declare s record; v_new uuid; v_me text;
begin
  select id, text, lead_id, planned, cancelled_at into s from sparks where id = p_spark for update;
  if s.id is null or s.lead_id is distinct from auth.uid() then
    raise exception 'only the lead can step back' using errcode = '42501';
  end if;
  if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '22023'; end if;
  v_me := private.person_name(auth.uid(), p_spark);
  select user_id into v_new from cohosts where spark_id = p_spark order by created_at, user_id limit 1;
  if v_new is not null then
    delete from cohosts where spark_id = p_spark and user_id = v_new;
    update sparks set lead_id = v_new, lead_name = coalesce((select nullif(name, '') from profiles where id = v_new), 'Someone')
     where id = p_spark;
    insert into notes (user_id, body, created_by)
      values (v_new, left(v_me || ' stepped back, so you’re leading ' || left(s.text, 120) || ' now.', 320), auth.uid());
    return 'handed';
  end if;
  if s.planned then
    insert into notes (user_id, body, created_by)
      select r.user_id, left(left(s.text, 120) || ' is an idea again: ' || v_me || ' stepped back as lead. Anyone can take it on.', 320), auth.uid()
        from rsvps r where r.spark_id = p_spark and r.status in ('going', 'maybe') and r.user_id <> auth.uid();
    insert into interests (spark_id, user_id)
    select spark_id, user_id from rsvps where spark_id = p_spark and status in ('going', 'maybe')
    on conflict do nothing;
    delete from rsvps where spark_id = p_spark;
  end if;
  update sparks set planned = false, wants_host = true where id = p_spark;
  return 'idea';
end $$;

-- 2. Make it a plan: a lead, a date, and the date hasn't passed
create or replace function public.make_plan(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
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
  update sparks set planned = true where id = p_spark and not planned;
  insert into rsvps (spark_id, user_id, status)
  select id, lead_id, 'going' from sparks where id = p_spark and lead_id is not null and cancelled_at is null
  on conflict (spark_id, user_id) do nothing;
  insert into rsvps (spark_id, user_id, status)
  select i.spark_id, i.user_id, 'going' from interests i
   where i.spark_id = p_spark and not exists (select 1 from cohosts c where c.spark_id = p_spark and c.user_id = i.user_id)
  on conflict (spark_id, user_id) do nothing;
end $$;

-- 3. Taking yourself off a job tells the leads
create function private.claim_dropped() returns trigger language plpgsql security definer set search_path = public as $$
declare it record; s record;
begin
  if auth.uid() is null or auth.uid() <> old.user_id then return null; end if;      -- only when they take themselves off
  if old.created_at > now() - interval '2 minutes' then return null; end if;         -- Undo right after signing up
  select i.item, i.spark_id into it from signup_items i where i.id = old.item_id;
  if it.spark_id is null then return null; end if;                                    -- the job itself is being removed
  select id, text, demo, test, cancelled_at, day_date into s from sparks where id = it.spark_id;
  if s.id is null or s.cancelled_at is not null or s.demo or coalesce(s.test, false) then return null; end if;
  if s.day_date is not null and s.day_date < (now() at time zone 'America/Chicago')::date then return null; end if;
  if old.user_id = any(private.host_ids(s.id)) then return null; end if;
  insert into notes (user_id, body, created_by)
    select u, left(private.person_name(old.user_id, s.id) || ' can’t do ' || left(it.item, 60) || ' any more (' || left(s.text, 120) || ').', 320), old.user_id
      from unnest(private.host_ids(s.id)) u;
  return null;
end $$;
revoke all on function private.claim_dropped() from public, anon, authenticated;
create trigger claim_dropped after delete on public.signup_claims for each row execute function private.claim_dropped();
