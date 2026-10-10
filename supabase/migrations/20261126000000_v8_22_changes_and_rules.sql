-- Design v8-22: changes after posting (3a–3b) and the notification rules (owner, 2026-10-10).
--
-- 1. A time someone holds moves (part_moved): their claim keeps where it moved from (moved_from, e.g. "Fri 8:30pm",
--    and moved_by), so the event page can show "Your time moved · 8:30pm → 9:00pm" with ✓ Keep / Pick another.
--    keep_moved() clears it (silence = keep, so nothing else does). Only the holder reads it (their own claims).
-- 2. Removing a time someone holds can carry a short note from the lead into their note and push (remove_signup's
--    new p_note; the old one-argument call still works).
-- 3. Can't go reaches the lead only from someone that lead (or a co-lead) invited: no push for anyone else's Can't.
-- 4. A sign-up made through the app waits for "You're signed up!": it's inserted with tell_later, and the hosts hear
--    only when the person taps Done or closes the recap (tell_hosts_signup). Undo deletes it first, so the lead never
--    hears. Sign-ups made any other way (an ask answered, a waitlist move-up) tell the hosts as before.

alter table public.signup_claims add column if not exists moved_from text check (char_length(moved_from) <= 40);
alter table public.signup_claims add column if not exists moved_by uuid references auth.users (id) on delete set null;
alter table public.signup_claims add column if not exists tell_later boolean not null default false;

-- 1 -------------------------------------------------------------------------------------------------------------
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
  if v_old = v_new then   -- only the end time changed: nothing to keep or give up, so no card
    v_old := 'until ' || coalesce(to_char(old.end_time, lbl), 'done'); v_new := 'until ' || coalesce(to_char(new.end_time, lbl), 'done');
  else   -- the first move is the one they signed up for: a second move keeps it
    update signup_claims set moved_from = coalesce(moved_from, left(v_old, 40)), moved_by = auth.uid()
     where item_id = new.id and user_id <> auth.uid();
  end if;
  insert into notes (user_id, body, created_by, quiet)
    select u, left(v_name || ' moved: ' || v_old || ' → ' || v_new || ' (' || left(s.text, 120) || ').', 320), auth.uid(), true from unnest(users) u;
  if not (s.demo or coalesce(s.test, false)) then
    perform private.push_send(users, 'reminders', s.text, v_name || ' moved: ' || v_old || ' → ' || v_new, '/#/idea/' || s.id, 'pt:' || new.id);
  end if;
  return null;
end $$;
revoke all on function private.part_moved() from public, anon, authenticated;

create or replace function public.keep_moved(p_item uuid) returns void
language sql security definer set search_path = public as $$
  update signup_claims set moved_from = null, moved_by = null where item_id = p_item and user_id = auth.uid();
$$;
revoke all on function public.keep_moved(uuid) from public, anon;
grant execute on function public.keep_moved(uuid) to authenticated;

-- 2 -------------------------------------------------------------------------------------------------------------
drop function if exists public.remove_signup(uuid);
create function public.remove_signup(p_item uuid, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare it record; v_title text; n integer := 0; v_body text; v_note text := nullif(left(trim(coalesce(p_note, '')), 140), ''); users uuid[]; s record;
begin
  select id, spark_id, item, created_by, kind into it from signup_items where id = p_item;
  if it.id is null then raise exception 'not found'; end if;
  select id, text, demo, test into s from sparks where id = it.spark_id;
  v_title := s.text;
  if it.created_by is distinct from auth.uid() and not public.is_host(it.spark_id) then
    raise exception 'not allowed';
  end if;
  v_body := case when it.kind = 'job' then '“' || left(it.item, 80) || '” is off the list for ' || left(v_title, 120) || '.'
                 else private.part_label(p_item) || ' was removed (' || left(v_title, 120) || ').' end
            || coalesce(' “' || v_note || '”', '');
  select array_agg(distinct c.user_id) into users
    from signup_claims c join signup_items i on i.id = c.item_id
   where (i.id = p_item or i.shift_of = p_item) and c.user_id <> auth.uid();
  -- a spot's people get their push below; a job's get theirs from the note (push_note), except on a test or demo event
  insert into notes (user_id, body, created_by, quiet)
    select u, left(v_body, 320), auth.uid(), it.kind <> 'job' or s.demo or coalesce(s.test, false) from unnest(coalesce(users, '{}')) u;
  get diagnostics n = row_count;
  if it.kind <> 'job' and users is not null and not (s.demo or coalesce(s.test, false)) then
    perform private.push_send(users, 'reminders', v_title, private.part_label(p_item) || ' was removed' || coalesce(': ' || v_note, ''), '/#/idea/' || s.id, 'px:' || p_item);
  end if;
  delete from signup_items where id = p_item;
  return n;
end $$;
revoke all on function public.remove_signup(uuid, text) from public, anon;
grant execute on function public.remove_signup(uuid, text) to authenticated;

-- 3 + 4: the hosts' push for an RSVP or a sign-up --------------------------------------------------------------------
-- What a sign-up tells the hosts (was inside push_host): a spot's claim ("Mo claimed 9:00am court time", and "… is
-- full" once it is), or a job's ("Mo signed up for “Ice” at …")
create or replace function private.push_claim(p_item uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s record; hosts uuid[]; p record; n int; v_have int; v_need int; msg text; tag text;
begin
  select sp.id, sp.text, i.item, i.kind into s from signup_items i join sparks sp on sp.id = i.spark_id where i.id = p_item;
  if s.id is null then return; end if;
  hosts := private.host_ids(s.id);
  if p_user is null or p_user = any(hosts) then return; end if;
  if s.kind <> 'job' then
    select j.id, j.item, j.kind into p from signup_items i join signup_items j on j.id = coalesce(i.shift_of, i.id) where i.id = p_item;
    select count(distinct c.user_id) into n from signup_claims c join signup_items i on i.id = c.item_id
     where (i.id = p.id or i.shift_of = p.id) and c.created_at > now() - interval '1 hour' and c.user_id <> all(hosts);
    msg := case when n > 1 then n || ' people claimed ' || lower(p.item) || (case when p.kind = 'time' and right(lower(p.item), 1) <> 's' then 's' else '' end)
                else private.person_name(p_user, s.id) || ' claimed ' || private.part_label(p_item) end;
    perform private.push_send(hosts, 'hosting', s.text, msg, '/#/idea/' || s.id, 'pc:' || p.id);
    select sum(i.need), sum((select count(*) from signup_claims c where c.item_id = i.id)) into v_need, v_have
      from signup_items i where (i.id = p.id or i.shift_of = p.id) and not exists (select 1 from signup_items k where k.shift_of = i.id);
    if v_need is not null and v_have >= v_need then
      perform private.push_send(hosts, 'hosting', s.text, p.item || ' is full (' || v_have || ' of ' || v_need || ')', '/#/idea/' || s.id, 'pf:' || p.id);
    end if;
    return;
  end if;
  msg := private.person_name(p_user, s.id) || ' signed up for “' || s.item || '” at ' || s.text;
  tag := 's:' || p_item || ':' || p_user;
  if p_user = auth.uid() and not public.is_signed_in() then tag := 'g:' || s.id; end if;   -- a guest
  perform private.push_send(hosts, 'hosting', s.text, msg, '/#/idea/' || s.id, tag);
end $$;
revoke all on function private.push_claim(uuid, uuid) from public, anon, authenticated;

create or replace function private.push_host() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; who uuid; msg text; tag text; hosts uuid[];
begin
  if auth.uid() is null then return null; end if;
  if tg_table_name = 'signup_claims' then
    -- moved up from the waitlist or an ask answered for them: not a reply of theirs (spots); waiting for Done (4)
    if new.tell_later then return null; end if;
    if new.user_id is distinct from auth.uid() and (select kind from signup_items where id = new.item_id) <> 'job' then return null; end if;
    perform private.push_claim(new.item_id, new.user_id);
    return null;
  end if;
  select id, text, lead_id into s from sparks where id = new.spark_id;
  if tg_table_name = 'rsvps' then
    if tg_op = 'UPDATE' and new.status = old.status then return null; end if;
    if new.user_id is distinct from auth.uid() then return null; end if;   -- moved by make_plan, not a reply
    -- Taking a job or a spot marks you Going: the sign-up's own notification covers it
    if new.status = 'going' and exists (select 1 from signup_claims c join signup_items i on i.id = c.item_id
                                         where i.spark_id = new.spark_id and c.user_id = new.user_id
                                           and c.created_at > now() - interval '2 minutes') then return null; end if;
    if new.status = 'going' and exists (select 1 from signup_waits w join signup_items i on i.id = w.item_id
                                         where i.spark_id = new.spark_id and w.user_id = new.user_id
                                           and w.created_at > now() - interval '2 minutes') then return null; end if;
    who := new.user_id;
    msg := private.person_name(who, s.id) || case new.status when 'going' then ' is going to ' when 'maybe' then ' might come to ' else ' can’t make it to ' end || s.text;
    tag := 'rv:' || s.id || ':' || who;
    hosts := private.host_ids(s.id);
    -- Can't go (3): only the hosts who invited them hear it
    if new.status = 'no' then
      hosts := array(select h from unnest(hosts) h where exists (select 1 from event_invites e where e.spark_id = s.id and e.user_id = who and e.invited_by = h));
      if cardinality(hosts) = 0 then return null; end if;
    end if;
  elsif tg_table_name = 'interests' then
    if new.user_id is distinct from auth.uid() then return null; end if;   -- moved by clear_plan, not interest
    who := new.user_id;
    msg := private.person_name(who, s.id) || ' is interested in ' || s.text;
    tag := 'i:' || s.id || ':' || who;
  elsif tg_table_name = 'date_options' then
    who := new.created_by;
    msg := coalesce(nullif(new.who, ''), private.person_name(who, s.id)) || ' suggested ' || to_char(new.day_date, 'Dy, Mon FMDD') || ' for ' || s.text;
    tag := 'd:' || s.id;
  else
    who := new.created_by;
    msg := coalesce(nullif(new.who, ''), private.person_name(who, s.id)) || ' suggested ' || new.name || ' for ' || s.text;
    tag := 'p:' || s.id;
  end if;
  hosts := coalesce(hosts, private.host_ids(s.id));
  if who is null or who = any(private.host_ids(s.id)) then return null; end if;
  if who = auth.uid() and not public.is_signed_in() then tag := 'g:' || s.id; end if;   -- a guest
  perform private.push_send(hosts, 'hosting', s.text, msg, '/#/idea/' || s.id, tag);
  return null;
end $$;
revoke all on function private.push_host() from public, anon, authenticated;

-- Done (or ×) on "You're signed up!": the hosts hear about the sign-ups that are still there, once each. (signup_claims
-- keeps its table-wide grants, so a person could set their own tell_later again; the hour limit keeps that from
-- re-sending an old sign-up.)
create or replace function public.tell_hosts_signup(p_items uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in update signup_claims set tell_later = false
            where item_id = any(coalesce(p_items, '{}')) and user_id = auth.uid() and tell_later
              and created_at > now() - interval '1 hour'   -- a sign-up from the recap, not an old row set again
            returning item_id loop
    perform private.push_claim(r.item_id, auth.uid());
  end loop;
end $$;
revoke all on function public.tell_hosts_signup(uuid[]) from public, anon;
grant execute on function public.tell_hosts_signup(uuid[]) to authenticated;
