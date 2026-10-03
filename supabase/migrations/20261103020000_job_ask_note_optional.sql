-- Asking someone to take a job (owner, 2026-10-03): the lead ticks up to two people and each gets their own optional
-- note, then one Send asks. So a job ask's note is optional now (20261102070000_job_asks_and_handoff.sql required one);
-- with no note the push is just the event and when.
alter table public.job_asks alter column message drop not null;
alter table public.job_asks drop constraint if exists job_asks_message_check;
alter table public.job_asks add constraint job_asks_message_check check (message is null or char_length(message) between 1 and 200);

create or replace function public.ask_for_job(p_item uuid, p_user uuid, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare
  it record; s record; v_msg text := left(nullif(btrim(coalesce(p_message, '')), ''), 200); v_name text;
  v_today date := (now() at time zone 'America/Chicago')::date;
begin
  select i.id, i.item, i.spark_id into it from signup_items i where i.id = p_item;
  if it.id is null or not public.is_host(it.spark_id) then raise exception 'only a lead can ask' using errcode = '42501'; end if;
  if exists (select 1 from signup_items where shift_of = p_item) then raise exception 'jobs with shifts can''t be asked for yet' using errcode = '22023'; end if;
  select id, text, cancelled_at, day_date, day_time, spot, visibility, demo, test into s from sparks where id = it.spark_id;
  if s.cancelled_at is not null or (s.day_date is not null and s.day_date < v_today) then
    raise exception 'this event isn''t taking sign-ups' using errcode = '22023';
  end if;
  if p_user is null or p_user = auth.uid() or p_user = any(private.host_ids(s.id)) then raise exception 'ask someone else' using errcode = '22023'; end if;
  if not exists (select 1 from auth.users u where u.id = p_user and not coalesce(u.is_anonymous, false))
     or not private.invitable(s.id, p_user) then
    raise exception 'ask a friend or someone in the event''s groups' using errcode = '22023';
  end if;
  if exists (select 1 from signup_claims where item_id = p_item and user_id = p_user) then raise exception 'they''re already on it' using errcode = '22023'; end if;
  if exists (select 1 from job_asks where item_id = p_item and user_id = p_user) then raise exception 'you already asked them' using errcode = '22023'; end if;
  if (select count(*) from job_asks a where a.item_id = p_item and a.answered_at is null
        and not exists (select 1 from signup_claims c where c.item_id = a.item_id and c.user_id = a.user_id)) >= 2 then
    raise exception 'two asks at a time' using errcode = '22023';
  end if;
  insert into job_asks (item_id, spark_id, user_id, asked_by, message) values (p_item, s.id, p_user, auth.uid(), v_msg);
  if s.visibility <> 'group' then   -- an invite-only event: the ask lets them see it, like an invite
    insert into link_access (user_id, spark_id, via) values (p_user, s.id, 'invite') on conflict (user_id, spark_id) do nothing;
  end if;
  if not (s.demo or coalesce(s.test, false)) then
    v_name := private.person_name(auth.uid(), s.id);
    perform private.push_send(array[p_user], 'friends', v_name || ' asked if you’d take ' || left(it.item, 60),
      coalesce('“' || v_msg || '” ', '') || left(s.text, 120) || ' · ' || private.when_text(s.day_date, s.day_time, s.spot), '/#/idea/' || s.id, 'ja:' || p_item);
  end if;
end $$;
revoke execute on function public.ask_for_job(uuid, uuid, text) from public, anon;
grant execute on function public.ask_for_job(uuid, uuid, text) to authenticated;
