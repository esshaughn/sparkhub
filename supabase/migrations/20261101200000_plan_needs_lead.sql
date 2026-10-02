-- An idea needs a lead and a date to become a plan (owner, 2026-10-01). It already needed a date; now make_plan() also
-- refuses while the idea is looking for a lead (sparks.wants_host). Otherwise the same as 20261101160000_lead_going.sql.
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
  update sparks set planned = true where id = p_spark and not planned;
  insert into rsvps (spark_id, user_id, status)
  select id, lead_id, 'going' from sparks where id = p_spark and lead_id is not null and cancelled_at is null
  on conflict (spark_id, user_id) do nothing;
  insert into rsvps (spark_id, user_id, status)
  select i.spark_id, i.user_id, 'going' from interests i
   where i.spark_id = p_spark and not exists (select 1 from cohosts c where c.spark_id = p_spark and c.user_id = i.user_id)
  on conflict (spark_id, user_id) do nothing;
end $$;
