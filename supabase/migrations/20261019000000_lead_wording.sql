-- "Lead" everywhere (owner, 2026-09-30): the notes sent when an event is taken down or turned back
-- into an idea fall back to "The lead" (was "The host") when the caller has no name. Otherwise unchanged.

create or replace function public.delete_event(p_spark uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare s record; v_who text; n integer := 0;
begin
  select id, text, lead_id, group_id, planned into s from sparks where id = p_spark;
  if s.id is null then raise exception 'not found'; end if;
  if s.lead_id is distinct from auth.uid() and not public.is_admin(s.group_id) then
    raise exception 'not allowed';
  end if;
  if s.planned then
    select coalesce(nullif(p.name, ''), 'The lead') into v_who from profiles p where p.id = auth.uid();
    insert into notes (user_id, body, created_by)
      select r.user_id, left(left(s.text, 120) || ' is off. ' || coalesce(v_who, 'The lead') || ' took it down.', 320), auth.uid()
        from rsvps r where r.spark_id = p_spark and r.status = 'going' and r.user_id <> auth.uid();
    get diagnostics n = row_count;
  end if;
  delete from sparks where id = p_spark;
  return n;
end $$;

create or replace function public.clear_plan(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_who text;
begin
  select id, text, lead_id, planned into s from sparks where id = p_spark;
  if s.id is null or s.lead_id is distinct from auth.uid() then
    raise exception 'only the lead can clear the date' using errcode = '42501';
  end if;
  if s.planned then
    select coalesce(nullif(p.name, ''), 'The lead') into v_who from profiles p where p.id = auth.uid();
    insert into notes (user_id, body, created_by)
      select r.user_id, left(left(s.text, 120) || ' is off the calendar for now. ' || coalesce(v_who, 'The lead') || ' turned it back into an idea.', 320), auth.uid()
        from rsvps r where r.spark_id = p_spark and r.status = 'going' and r.user_id <> auth.uid();
  end if;
  insert into interests (spark_id, user_id)
  select spark_id, user_id from rsvps where spark_id = p_spark and status = 'going'
  on conflict do nothing;
  delete from rsvps where spark_id = p_spark;
  update sparks set planned = false, day_date = null, day_time = null, day_end = null, day = null where id = p_spark;
end $$;
