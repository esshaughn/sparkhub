-- 1. Cancelled events stay up (owner, 2026-09-30): cancel_event() marks the event cancelled (with the host's reason)
--    and tells everyone in it; it stays visible, marked CANCELLED, closed to replies and sign-ups, with no
--    reminders, until the host deletes it (delete_event(…, p_quiet => true) takes anything down quietly).
-- 2. The owner can remove an account entirely from the New accounts list (remove_account()).

alter table public.sparks add column if not exists cancelled_at timestamptz;
alter table public.sparks add column if not exists cancel_reason text check (char_length(cancel_reason) <= 160);
-- (no update grant: only cancel_event() sets them)

create or replace function public.cancel_event(p_spark uuid, p_reason text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare s record; v_who text; v_body text; v_reason text := left(nullif(btrim(p_reason), ''), 160); n integer := 0;
begin
  select id, text, lead_id, group_id, planned, cancelled_at into s from sparks where id = p_spark;
  if s.id is null then raise exception 'not found'; end if;
  if s.lead_id is distinct from auth.uid() and not public.is_admin(s.group_id) then raise exception 'not allowed'; end if;
  if s.cancelled_at is not null then return 0; end if;
  update sparks set cancelled_at = now(), cancel_reason = v_reason where id = p_spark;
  select coalesce(nullif(split_part(trim(p.name), ' ', 1), ''), 'The host') into v_who from profiles p where p.id = auth.uid();
  v_body := left(s.text, 120) || ' is cancelled. ' ||
    case when v_reason is null then coalesce(v_who, 'The host') || ' called it off.' else coalesce(v_who, 'The host') || ': “' || v_reason || '”' end;
  insert into notes (user_id, body, created_by)
    select u, left(v_body, 320), auth.uid()
      from (select r.user_id as u from rsvps r where r.spark_id = p_spark and r.status in ('going', 'maybe')
            union select c.user_id from signup_claims c join signup_items i on i.id = c.item_id where i.spark_id = p_spark
            union select x.user_id from interests x where x.spark_id = p_spark and not s.planned) people
     where u <> auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.cancel_event(uuid, text) from public, anon;
grant execute on function public.cancel_event(uuid, text) to authenticated;

-- A cancelled event takes no new replies, sign-ups or interest
create or replace function public.refuse_if_cancelled() returns trigger language plpgsql security definer set search_path = public as $$
declare v_spark uuid;
begin
  if tg_table_name = 'signup_claims' then select spark_id into v_spark from signup_items where id = new.item_id;
  else v_spark := new.spark_id; end if;
  if exists (select 1 from sparks where id = v_spark and cancelled_at is not null) then
    raise exception 'this event is cancelled' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists rsvps_not_cancelled on public.rsvps;
create trigger rsvps_not_cancelled before insert or update on public.rsvps for each row execute function public.refuse_if_cancelled();
drop trigger if exists claims_not_cancelled on public.signup_claims;
create trigger claims_not_cancelled before insert on public.signup_claims for each row execute function public.refuse_if_cancelled();
drop trigger if exists interests_not_cancelled on public.interests;
create trigger interests_not_cancelled before insert on public.interests for each row execute function public.refuse_if_cancelled();

-- No reminders for cancelled events
create or replace function private.push_daily() returns void language plpgsql security definer set search_path = public, extensions as $$
declare s record; users uuid[]; today date := (now() at time zone 'America/Chicago')::date;
begin
  for s in select id, text, day_date, day_time, spot, lead_id from sparks
            where planned and not demo and auto_remind and cancelled_at is null and day_date in (today, today + 1) loop
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

-- 2. Remove an account (owner only; not yourself or another admin; not a group's only owner).
-- Their events go too (quietly); everything else of theirs goes with the account (cascades).
create or replace function public.remove_account(p_user uuid)
returns text language plpgsql security definer set search_path = public, auth as $$
declare v_group text;
begin
  if not exists (select 1 from demo_admins where user_id = auth.uid()) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user = auth.uid() or exists (select 1 from demo_admins where user_id = p_user) then raise exception 'can''t remove an admin account'; end if;
  select g.name into v_group from groups g join memberships m on m.group_id = g.id and m.user_id = p_user and m.role = 'owner'
   where not exists (select 1 from memberships o where o.group_id = g.id and o.role = 'owner' and o.user_id <> p_user) limit 1;
  if v_group is not null then raise exception 'only owner of %', v_group using errcode = 'P0002'; end if;
  delete from sparks where lead_id = p_user;
  update sparks set created_by = lead_id where created_by = p_user;
  delete from offers where user_id = p_user;
  delete from auth.users where id = p_user;
  return 'removed';
end $$;
revoke all on function public.remove_account(uuid) from public, anon;
grant execute on function public.remove_account(uuid) to authenticated;
