-- Jobs audit (owner, 2026-10-07), items B1, B2 and B4.
--
-- B1 + B2: one push, not two. These functions write a bell note and send their own push (which opens the event), and
-- push_note pushed the note again ("Spark Hub: …" plus "{Event}: …"). Their notes are quiet now (bell only), so the
-- direct push is the only one; on a test or demo event the direct push was already skipped, so nothing buzzes at all
-- (before, the note still pushed). remove_signup: a job's people still hear through push_note, except on test or demo
-- events. Otherwise each function is the same as before (fill_from_waitlist, part_dropped, remove_part_claim,
-- remove_signup: 20261106000000_take_part.sql; nudge_invitee: 20261115000000_multi_day_fixes.sql).
--
-- M3 (end of file): holders hear when a host moves the time of what they hold, and get its reminder again.
--
-- M1: hosts take someone off a job too (remove_part_claim refused jobs, and nobody could delete another person's claim).
-- The note and push name whoever did it ("Sam took you off …"), not always "the lead".
--
-- B4: saying I'm in to a job ask when the job filled up in the meantime failed outright (check_signup_room refused the
-- claim), leaving a dead "I'm in" on the card. Now the ask is closed with answer 'full' and the call returns 'full'
-- (else 'in' or 'cant'), so the app can say "It filled up before you answered". The return type changes (void → text),
-- so the function is dropped and made again. Can't this time on a test or demo event writes a quiet note.

-- private.fill_from_waitlist
create or replace function private.fill_from_waitlist(p_item uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare i record; w record; s record; v_label text;
begin
  select id, spark_id, need, kind into i from signup_items where id = p_item;
  if i.id is null or i.kind = 'job' or i.need is null then return null; end if;
  select id, text, planned, cancelled_at, demo, test into s from sparks where id = i.spark_id;
  if s.cancelled_at is not null then return null; end if;
  for w in select user_id from signup_waits where item_id = p_item order by created_at loop
    exit when (select count(*) from signup_claims where item_id = p_item) >= i.need;
    begin
      insert into signup_claims (item_id, user_id) values (p_item, w.user_id);
    exception when sqlstate '23514' then continue;   -- over their cap now: the next in line
    end;
    delete from signup_waits where item_id = p_item and user_id = w.user_id;
    if s.planned then
      insert into rsvps (spark_id, user_id, status) values (s.id, w.user_id, 'going')
        on conflict (spark_id, user_id) do update set status = 'going';
    end if;
    v_label := private.part_label(p_item);
    insert into notes (user_id, body, created_by, quiet)
      values (w.user_id, left('You’re in: ' || v_label || ' opened up (' || left(s.text, 120) || ').', 320), auth.uid(), true);
    if not (s.demo or coalesce(s.test, false)) then
      perform private.push_send(array[w.user_id], 'reminders', s.text, 'You’re in: ' || v_label || ' opened up', '/#/idea/' || s.id, 'pm:' || p_item || ':' || w.user_id);
    end if;
    return w.user_id;
  end loop;
  return null;
end $$;

-- private.part_dropped
create or replace function private.part_dropped() returns trigger language plpgsql security definer set search_path = public as $$
declare i record; s record; v_up uuid; v_msg text;
begin
  select id, spark_id, kind, shift_of into i from signup_items where id = old.item_id;
  if i.id is null or i.kind = 'job' then return null; end if;   -- a job, or the spot itself is being removed
  v_up := private.fill_from_waitlist(old.item_id);
  -- The hosts hear when someone gives one up (not the lead's own removals, not an Undo right after claiming)
  if auth.uid() is distinct from old.user_id or old.created_at > now() - interval '2 minutes' then return null; end if;
  select id, text, demo, test into s from sparks where id = i.spark_id;
  if old.user_id = any(private.host_ids(s.id)) or s.demo or coalesce(s.test, false) then return null; end if;
  v_msg := private.person_name(old.user_id, s.id) || ' gave up ' ||
           (case when i.kind = 'time' then (select to_char("time", 'FMHH12:MIam') from signup_items where id = i.id) else private.part_label(i.id) end) || '.' ||
           coalesce(' ' || private.person_name(v_up, s.id) || ' moved up.', '');
  insert into notes (user_id, body, created_by, quiet)
    select u, left(v_msg || ' (' || left(s.text, 120) || ')', 320), old.user_id, true from unnest(private.host_ids(s.id)) u;
  perform private.push_send(private.host_ids(s.id), 'hosting', s.text, v_msg, '/#/idea/' || s.id, 'pg:' || old.item_id);
  return null;
end $$;

-- public.remove_part_claim
create or replace function public.remove_part_claim(p_item uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare i record; s record; v_label text;
begin
  select id, spark_id, kind, item, shift_of, "time" into i from signup_items where id = p_item;
  if i.id is null or not public.is_host(i.spark_id) then raise exception 'not allowed' using errcode = '42501'; end if;   -- jobs too (jobs audit M1)
  select id, text, demo, test into s from sparks where id = i.spark_id;
  delete from signup_claims where item_id = p_item and user_id = p_user;
  if not found then return; end if;
  if p_user <> auth.uid() then
    -- a job's shift reads "Parking help, 5:30pm"; whoever did it is named (a co-host too, not always "the lead")
    v_label := case when i.kind = 'job' then coalesce((select item from signup_items where id = i.shift_of) || coalesce(', ' || to_char(i."time", 'FMHH12:MIam'), ''), i.item)
                    else private.part_label(p_item) end;
    insert into notes (user_id, body, created_by, quiet)
      values (p_user, left(private.person_name(auth.uid(), s.id) || ' took you off ' || v_label || ' (' || left(s.text, 120) || ').', 320), auth.uid(), true);
    if not (s.demo or coalesce(s.test, false)) then
      perform private.push_send(array[p_user], 'reminders', s.text, 'You’re off ' || v_label || '. ' || private.person_name(auth.uid(), s.id) || ' made a change.', '/#/idea/' || s.id, 'pr:' || p_item || ':' || p_user);
    end if;
  end if;
end $$;

-- public.remove_signup
create or replace function public.remove_signup(p_item uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare it record; v_title text; n integer := 0; v_body text; users uuid[]; s record;
begin
  select id, spark_id, item, created_by, kind into it from signup_items where id = p_item;
  if it.id is null then raise exception 'not found'; end if;
  select id, text, demo, test into s from sparks where id = it.spark_id;
  v_title := s.text;
  if it.created_by is distinct from auth.uid() and not public.is_host(it.spark_id) then
    raise exception 'not allowed';
  end if;
  v_body := case when it.kind = 'job' then '“' || left(it.item, 80) || '” is off the list for ' || left(v_title, 120) || '.'
                 else private.part_label(p_item) || ' was removed (' || left(v_title, 120) || ').' end;
  select array_agg(distinct c.user_id) into users
    from signup_claims c join signup_items i on i.id = c.item_id
   where (i.id = p_item or i.shift_of = p_item) and c.user_id <> auth.uid();
  -- a spot's people get their push below; a job's get theirs from the note (push_note), except on a test or demo event
  insert into notes (user_id, body, created_by, quiet)
    select u, left(v_body, 320), auth.uid(), it.kind <> 'job' or s.demo or coalesce(s.test, false) from unnest(coalesce(users, '{}')) u;
  get diagnostics n = row_count;
  if it.kind <> 'job' and users is not null and not (s.demo or coalesce(s.test, false)) then
    perform private.push_send(users, 'reminders', v_title, private.part_label(p_item) || ' was removed', '/#/idea/' || s.id, 'px:' || p_item);
  end if;
  delete from signup_items where id = p_item;
  return n;
end $$;

-- public.nudge_invitee
create or replace function public.nudge_invitee(p_spark uuid, p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  s record; v_at timestamptz; v_today date := (now() at time zone 'America/Chicago')::date; v_body text;
begin
  if not public.is_signed_in() or not public.is_host(p_spark) then raise exception 'only a lead can nudge' using errcode = '42501'; end if;
  select id, text, planned, cancelled_at, day_date, schedule, demo, test into s from sparks where id = p_spark;
  if s.id is null or not s.planned or s.cancelled_at is not null then raise exception 'this event isn''t taking replies' using errcode = '22023'; end if;
  if private.event_last_day(s.day_date, s.schedule) < v_today then raise exception 'that event has passed' using errcode = '22023'; end if;
  select nudged_at into v_at from event_invites where spark_id = p_spark and user_id = p_user for update;
  if not found then raise exception 'they weren''t invited' using errcode = '22023'; end if;
  if exists (select 1 from rsvps where spark_id = p_spark and user_id = p_user) then raise exception 'they already replied' using errcode = '22023'; end if;
  if v_at is not null and (v_at at time zone 'America/Chicago')::date = v_today then return false; end if;
  update event_invites set nudged_at = now() where spark_id = p_spark and user_id = p_user;
  -- Test and demo events stay quiet (as every other note and push)
  if s.demo or coalesce(s.test, false) then return true; end if;
  v_body := left(private.person_name(auth.uid(), p_spark) || ' is hoping you can make ' || left(s.text, 160) || '. Going, Maybe or Can’t?', 320);
  insert into notes (user_id, body, created_by, quiet) values (p_user, v_body, auth.uid(), true);
  perform private.push_send(array[p_user], 'friends', s.text, v_body, '/#/idea/' || s.id, 'nu:' || s.id);
  return true;
end $$;

-- answer_job_ask (B4; otherwise as 20261102070000_job_asks_and_handoff.sql)
alter table public.job_asks drop constraint if exists job_asks_answer_check;
alter table public.job_asks add constraint job_asks_answer_check check (answer in ('in', 'cant', 'full'));

drop function if exists public.answer_job_ask(uuid, boolean);
create function public.answer_job_ask(p_item uuid, p_in boolean)
returns text language plpgsql security definer set search_path = public as $$
declare a record; it record; s record;
begin
  select * into a from job_asks where item_id = p_item and user_id = auth.uid() for update;
  if a.item_id is null then raise exception 'nobody asked you' using errcode = '22023'; end if;
  if a.answered_at is not null then return a.answer; end if;
  select id, item into it from signup_items where id = p_item;
  select id, text, planned, cancelled_at, demo, test into s from sparks where id = a.spark_id;
  if p_in then
    if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '22023'; end if;
    begin
      insert into signup_claims (item_id, user_id) values (p_item, auth.uid()) on conflict (item_id, user_id) do nothing;
    exception when sqlstate '23514' then   -- it filled up (or they're at a spot's per-person limit): close the ask
      update job_asks set answer = 'full', answered_at = now() where item_id = p_item and user_id = auth.uid();
      return 'full';
    end;
    if s.planned then
      insert into rsvps (spark_id, user_id, status) values (s.id, auth.uid(), 'going')
        on conflict (spark_id, user_id) do update set status = 'going';
    end if;
  else
    insert into notes (user_id, body, created_by, quiet)
      values (a.asked_by, left(private.person_name(auth.uid(), s.id) || ' can’t take ' || left(it.item, 60) || ' this time (' || left(s.text, 120) || ').', 320),
              auth.uid(), s.demo or coalesce(s.test, false));
  end if;
  update job_asks set answer = case when p_in then 'in' else 'cant' end, answered_at = now() where item_id = p_item and user_id = auth.uid();
  return case when p_in then 'in' else 'cant' end;
end $$;
revoke execute on function public.answer_job_ask(uuid, boolean) from public, anon;
grant execute on function public.answer_job_ask(uuid, boolean) to authenticated;

-- M3: a host moves a spot's or a job's time (or its day): the people holding it hear "Court time moved: 9:00am → 9:30am"
-- (a bell line and one push) and get their spot reminder again at the new time (reminded_at cleared). Not for the
-- person making the change, a cancelled event, or a new row; test and demo events keep the bell line only.
create or replace function private.part_moved() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; v_name text; v_old text; v_new text; users uuid[];
  lbl constant text := 'FMHH12:MIam';
begin
  if auth.uid() is null then return null; end if;
  select id, text, cancelled_at, demo, test into s from sparks where id = new.spark_id;
  if s.id is null or s.cancelled_at is not null then return null; end if;
  users := array(select distinct c.user_id from signup_claims c where c.item_id = new.id and c.user_id <> auth.uid());
  update signup_claims set reminded_at = null where item_id = new.id;
  if cardinality(users) = 0 then return null; end if;
  -- a day taken off the event clears its jobs' day; sparks_schedule_days already told those people
  if new.day is null and old.day is not null and old."time" is not distinct from new."time" and old.end_time is not distinct from new.end_time then return null; end if;
  v_name := coalesce((select item from signup_items where id = new.shift_of), new.item);
  v_old := concat_ws(' ', to_char(old.day, 'Dy'), coalesce(to_char(old."time", lbl), case when old.day is null then 'no set time' end));
  v_new := concat_ws(' ', to_char(new.day, 'Dy'), coalesce(to_char(new."time", lbl), case when new.day is null then 'no set time' end));
  if v_old = v_new then   -- only the end time changed
    v_old := 'until ' || coalesce(to_char(old.end_time, lbl), 'done'); v_new := 'until ' || coalesce(to_char(new.end_time, lbl), 'done');
  end if;
  insert into notes (user_id, body, created_by, quiet)
    select u, left(v_name || ' moved: ' || v_old || ' → ' || v_new || ' (' || left(s.text, 120) || ').', 320), auth.uid(), true from unnest(users) u;
  if not (s.demo or coalesce(s.test, false)) then
    perform private.push_send(users, 'reminders', s.text, v_name || ' moved: ' || v_old || ' → ' || v_new, '/#/idea/' || s.id, 'pt:' || new.id);
  end if;
  return null;
end $$;
revoke all on function private.part_moved() from public, anon, authenticated;
drop trigger if exists part_moved on public.signup_items;
create trigger part_moved after update of "time", end_time, day on public.signup_items for each row
  when (old."time" is distinct from new."time" or old.end_time is distinct from new.end_time or old.day is distinct from new.day)
  execute function private.part_moved();
