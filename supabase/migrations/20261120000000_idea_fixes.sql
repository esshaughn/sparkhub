-- Ideas audit (owner, 2026-10-08)
-- 1. Keep holding adds 7 days to the hold (from today if it has lapsed), at most 30 days out. It used to set
--    today + 7, which is where a new poll's hold already sits, so on the poll's first day it changed nothing.
create or replace function public.keep_holding(p_spark uuid) returns date
language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'America/Chicago')::date; v date;
begin
  if not public.is_host(p_spark) then raise exception 'Only the lead can keep the dates held' using errcode = '42501'; end if;
  select least(greatest(coalesce(hold_until, today), today) + 7, today + 30) into v from sparks where id = p_spark;
  update sparks set hold_until = v, hold_nudged_at = null
   where id = p_spark and not planned and day_date is null and cancelled_at is null
     and exists (select 1 from date_options o where o.spark_id = p_spark);
  if not found then raise exception 'Nothing to hold' using errcode = 'P0002'; end if;
  return v;
end $$;
revoke all on function public.keep_holding(uuid) from public, anon;
grant execute on function public.keep_holding(uuid) to authenticated;

-- 2. The short description (overview) takes up to 200 characters (was 120): the idea page shows it in full
alter table public.sparks drop constraint if exists sparks_overview_check;
alter table public.sparks add constraint sparks_overview_check
  check (overview is null or (char_length(overview) between 1 and 200));
