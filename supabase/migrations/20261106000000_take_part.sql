-- Take part (Design v8-2, 2026-10-05): spots people claim to take part (a court time, a seat in a class, a carpool
-- place), apart from Help out's jobs. They reuse signup_items / signup_claims with a kind:
--   job   : Help out (as before)
--   time  : Claim time, the rows are shift rows (shift_of) with a start, an end and a count each
--   seat  : Claim seat, one row with a count (and an optional time)
--   other : any other fixed-count spot, like seat
-- A shift row carries its parent's kind. Spots add a waitlist (on by default; first in line moves up on its own) and
-- a most-per-person cap (null: any). Claiming a spot RSVPs you Going (the app does it, like a job).
-- Guests (anonymous, not signed in) may claim a spot or join a waitlist once they've left a name and phone for
-- that event in guest_contacts; jobs stay accounts-only. No texts yet (owner, 2026-10-05: guests, no texts).

alter table public.signup_items
  add column kind       text not null default 'job' check (kind in ('job', 'time', 'seat', 'other')),
  add column waitlist   boolean not null default true,
  add column per_person smallint check (per_person between 1 and 20);
grant update (waitlist, per_person) on table public.signup_items to authenticated;

-- Members still add only a plain "something else" job; a shift has its parent's kind
drop policy "add a sign-up" on public.signup_items;
create policy "add a sign-up" on public.signup_items for insert to authenticated
  with check (created_by = auth.uid() and public.can_see_spark(spark_id)
              and (public.is_host(spark_id)
                   or (kind = 'job' and need is null and "time" is null and end_time is null and descr is null and shift_of is null))
              and (shift_of is null or exists (select 1 from signup_items j
                                                where j.id = signup_items.shift_of and j.spark_id = signup_items.spark_id
                                                  and j.shift_of is null and j.kind = signup_items.kind)));

-- "9:00am court time" for a time row, the name for anything else
create function private.part_label(p_item uuid) returns text language sql stable security definer set search_path = public as $$
  select case when i.kind = 'time' and i."time" is not null
              then to_char(i."time", 'FMHH12:MIam') || ' ' || lower(i.item) else i.item end
    from signup_items i where i.id = p_item
$$;
revoke all on function private.part_label(uuid) from public, anon, authenticated;

-- Room and the cap: full items take no more; a spot's parent caps how many one person holds across its rows
create or replace function public.check_signup_room() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_need integer; v_have integer; p record;
begin
  if exists (select 1 from signup_items where shift_of = new.item_id) then return null; end if;
  select need into v_need from signup_items where id = new.item_id;
  if v_need is not null then
    select count(*) into v_have from signup_claims where item_id = new.item_id;
    if v_have >= v_need then raise exception 'that one''s covered' using errcode = '23514'; end if;
  end if;
  select j.id, j.kind, j.per_person, j.item into p from signup_items i join signup_items j on j.id = coalesce(i.shift_of, i.id) where i.id = new.item_id;
  if p.kind <> 'job' and p.per_person is not null
     and (select count(*) from signup_claims c join signup_items i on i.id = c.item_id
           where (i.id = p.id or i.shift_of = p.id) and c.user_id = new.user_id) >= p.per_person then
    raise exception 'per person: up to % per person for %', p.per_person, lower(p.item) using errcode = '23514';
  end if;
  return new;
end $$;

-- Guests: a spot (never a job) once they've left a name and phone for the event
create function public.guest_can_take(p_item uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from signup_items i join guest_contacts g on g.spark_id = i.spark_id and g.user_id = auth.uid()
                  where i.id = p_item and i.kind <> 'job' and nullif(btrim(coalesce(g.phone, '')), '') is not null)
$$;
revoke all on function public.guest_can_take(uuid) from public, anon;
grant execute on function public.guest_can_take(uuid) to authenticated;
drop policy if exists "signed in only" on public.signup_claims;
create policy "signed in only" on public.signup_claims as restrictive for insert to authenticated
  with check (public.is_signed_in() or public.guest_can_take(item_id));

-- The waitlist: one row per person and spot row, in order of joining. Readable like the claims (people see how many
-- are waiting and their place); you join only a full spot with its waitlist on, and leave whenever you like.
create table public.signup_waits (
  item_id    uuid not null references public.signup_items (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);
create index signup_waits_user on public.signup_waits (user_id);
alter table public.signup_waits enable row level security;
create policy "waits follow the idea" on public.signup_waits for select to authenticated
  using (exists (select 1 from signup_items i where i.id = item_id and public.can_see_spark(i.spark_id)));
create policy "join a waitlist" on public.signup_waits for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from signup_items i join signup_items j on j.id = coalesce(i.shift_of, i.id)
                           where i.id = item_id and public.can_see_spark(i.spark_id) and i.kind <> 'job' and j.waitlist
                             and not exists (select 1 from signup_items k where k.shift_of = i.id))
              and (public.is_signed_in() or public.guest_can_take(item_id)));
create policy "leave a waitlist" on public.signup_waits for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from signup_items i where i.id = item_id and public.is_host(i.spark_id)));
revoke all on table public.signup_waits from anon, authenticated;
grant select, delete on table public.signup_waits to authenticated;
grant insert (item_id, user_id) on table public.signup_waits to authenticated;   -- not created_at: no jumping the line

-- People on a waitlist: their names show to the lead and their faces to anyone who can see the event, like a claim
drop policy "profiles of people around you" on public.profiles;
create policy "profiles of people around you" on public.profiles for select to authenticated using (
  id = auth.uid() or shares_group(id) or is_friend(id)
  or exists (select 1 from sparks s where s.lead_id = profiles.id and can_see_spark_row(s.id, s.group_id, s.lead_id, s.visibility))
  or exists (select 1 from cohosts h where h.user_id = profiles.id and can_see_spark(h.spark_id))
  or exists (select 1 from interests i where i.user_id = profiles.id and can_see_spark(i.spark_id))
  or exists (select 1 from offers o where o.user_id = profiles.id and can_see_spark(o.spark_id))
  or exists (select 1 from rsvps r where r.user_id = profiles.id and can_see_spark(r.spark_id))
  or exists (select 1 from organizers g where g.user_id = profiles.id and can_see_spark(g.spark_id))
  or exists (select 1 from signup_claims c join signup_items t on t.id = c.item_id where c.user_id = profiles.id and can_see_spark(t.spark_id))
  or exists (select 1 from signup_waits w join signup_items t on t.id = w.item_id where w.user_id = profiles.id and can_see_spark(t.spark_id))
  or exists (select 1 from reactions x where x.user_id = profiles.id and can_see_spark(x.spark_id)));

-- Only a full spot, not one you hold, not a cancelled or past event, and within the cap
create function private.check_wait() returns trigger language plpgsql security definer set search_path = public as $$
declare i record; s record; p record;
begin
  select id, spark_id, need into i from signup_items where id = new.item_id;
  select cancelled_at, day_date into s from sparks where id = i.spark_id;
  if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '23514'; end if;
  if s.day_date is not null and s.day_date < (now() at time zone 'America/Chicago')::date then
    raise exception 'this event has passed' using errcode = '23514';
  end if;
  if i.need is null or (select count(*) from signup_claims where item_id = i.id) < i.need then
    raise exception 'there''s an open spot' using errcode = '23514';
  end if;
  if exists (select 1 from signup_claims where item_id = i.id and user_id = new.user_id) then
    raise exception 'you have this one' using errcode = '23514';
  end if;
  select j.id, j.per_person, j.item into p from signup_items x join signup_items j on j.id = coalesce(x.shift_of, x.id) where x.id = new.item_id;
  if p.per_person is not null
     and (select count(*) from signup_claims c join signup_items k on k.id = c.item_id where (k.id = p.id or k.shift_of = p.id) and c.user_id = new.user_id)
       + (select count(*) from signup_waits w join signup_items k on k.id = w.item_id where (k.id = p.id or k.shift_of = p.id) and w.user_id = new.user_id)
       >= p.per_person then
    raise exception 'per person: up to % per person for %', p.per_person, lower(p.item) using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.check_wait() from public, anon, authenticated;
create trigger signup_waits_check before insert on public.signup_waits for each row execute function private.check_wait();

-- A spot opens (someone gives it up, the lead removes them, or the count goes up): the first in line who still fits
-- the cap moves up, RSVPs Going, and hears about it; the hosts hear who gave it up and who moved up
create function private.fill_from_waitlist(p_item uuid) returns uuid language plpgsql security definer set search_path = public as $$
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
    insert into notes (user_id, body, created_by)
      values (w.user_id, left('You’re in: ' || v_label || ' opened up (' || left(s.text, 120) || ').', 320), auth.uid());
    if not (s.demo or coalesce(s.test, false)) then
      perform private.push_send(array[w.user_id], 'reminders', s.text, 'You’re in: ' || v_label || ' opened up', '/#/idea/' || s.id, 'pm:' || p_item || ':' || w.user_id);
    end if;
    return w.user_id;
  end loop;
  return null;
end $$;
revoke all on function private.fill_from_waitlist(uuid) from public, anon, authenticated;

create function private.part_dropped() returns trigger language plpgsql security definer set search_path = public as $$
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
  insert into notes (user_id, body, created_by)
    select u, left(v_msg || ' (' || left(s.text, 120) || ')', 320), old.user_id from unnest(private.host_ids(s.id)) u;
  perform private.push_send(private.host_ids(s.id), 'hosting', s.text, v_msg, '/#/idea/' || s.id, 'pg:' || old.item_id);
  return null;
end $$;
revoke all on function private.part_dropped() from public, anon, authenticated;
create trigger part_dropped after delete on public.signup_claims for each row execute function private.part_dropped();

-- Jobs keep claim_dropped's note; spots use part_dropped's
create or replace function private.claim_dropped() returns trigger language plpgsql security definer set search_path = public as $$
declare it record; s record;
begin
  if auth.uid() is null or auth.uid() <> old.user_id then return null; end if;      -- only when they take themselves off
  if old.created_at > now() - interval '2 minutes' then return null; end if;         -- Undo right after signing up
  select i.item, i.spark_id, i.kind into it from signup_items i where i.id = old.item_id;
  if it.spark_id is null or it.kind <> 'job' then return null; end if;               -- the job itself is being removed, or a spot
  select id, text, demo, test, cancelled_at, day_date into s from sparks where id = it.spark_id;
  if s.id is null or s.cancelled_at is not null or s.demo or coalesce(s.test, false) then return null; end if;
  if s.day_date is not null and s.day_date < (now() at time zone 'America/Chicago')::date then return null; end if;
  if old.user_id = any(private.host_ids(s.id)) then return null; end if;
  insert into notes (user_id, body, created_by)
    select u, left(private.person_name(old.user_id, s.id) || ' can’t do ' || left(it.item, 60) || ' any more (' || left(s.text, 120) || ').', 320), old.user_id
      from unnest(private.host_ids(s.id)) u;
  return null;
end $$;

-- More room (the lead raised a count): the waitlist moves up into it
create function private.part_room() returns trigger language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if new.kind = 'job' or new.need is null or new.need <= coalesce(old.need, 0) then return null; end if;
  while n < new.need - coalesce(old.need, 0) loop
    exit when private.fill_from_waitlist(new.id) is null;
    n := n + 1;
  end loop;
  return null;
end $$;
revoke all on function private.part_room() from public, anon, authenticated;
create trigger part_room after update of need on public.signup_items for each row execute function private.part_room();

-- The lead takes someone off a spot (they're told; the waitlist moves up)
create function public.remove_part_claim(p_item uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare i record; s record; v_label text;
begin
  select id, spark_id, kind into i from signup_items where id = p_item;
  if i.id is null or i.kind = 'job' or not public.is_host(i.spark_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  select id, text, demo, test into s from sparks where id = i.spark_id;
  delete from signup_claims where item_id = p_item and user_id = p_user;
  if not found then return; end if;
  if p_user <> auth.uid() then
    v_label := private.part_label(p_item);
    insert into notes (user_id, body, created_by)
      values (p_user, left('The lead took you off ' || v_label || ' (' || left(s.text, 120) || ').', 320), auth.uid());
    if not (s.demo or coalesce(s.test, false)) then
      perform private.push_send(array[p_user], 'reminders', s.text, 'You’re off ' || v_label || '. The lead made a change.', '/#/idea/' || s.id, 'pr:' || p_item || ':' || p_user);
    end if;
  end if;
end $$;
revoke all on function public.remove_part_claim(uuid, uuid) from public, anon;
grant execute on function public.remove_part_claim(uuid, uuid) to authenticated;

-- Removing a spot or a time: the people holding it hear "10:30am court time was removed"
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
  insert into notes (user_id, body, created_by) select u, left(v_body, 320), auth.uid() from unnest(coalesce(users, '{}')) u;
  get diagnostics n = row_count;
  if it.kind <> 'job' and users is not null and not (s.demo or coalesce(s.test, false)) then
    perform private.push_send(users, 'reminders', v_title, private.part_label(p_item) || ' was removed', '/#/idea/' || s.id, 'px:' || p_item);
  end if;
  delete from signup_items where id = p_item;
  return n;
end $$;

-- The hosts' push for a claim: a job as before; a spot says which ("Dee claimed 9:00am court time"), several within
-- an hour share one ("3 people claimed court times"), and a spot that fills says so ("Beginner clinic is full (8 of 8)").
-- Moving up from the waitlist isn't a claim of theirs (part_dropped tells the hosts).
create or replace function private.push_host() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; who uuid; msg text; tag text; hosts uuid[]; p record; n int; v_have int; v_need int;
begin
  if auth.uid() is null then return null; end if;
  if tg_table_name = 'signup_claims' then
    select sp.id, sp.text, sp.lead_id, i.item, i.kind into s from signup_items i join sparks sp on sp.id = i.spark_id where i.id = new.item_id;
  else
    select id, text, lead_id, null::text as item, null::text as kind into s from sparks where id = new.spark_id;
  end if;
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
  elsif tg_table_name = 'interests' then
    if new.user_id is distinct from auth.uid() then return null; end if;   -- moved by clear_plan, not interest
    who := new.user_id;
    msg := private.person_name(who, s.id) || ' is interested in ' || s.text;
    tag := 'i:' || s.id || ':' || who;
  elsif tg_table_name = 'signup_claims' and s.kind <> 'job' then
    if new.user_id is distinct from auth.uid() then return null; end if;   -- moved up from the waitlist, or an ask answered for them
    who := new.user_id;
    hosts := private.host_ids(s.id);
    if who = any(hosts) then return null; end if;
    select j.id, j.item, j.kind into p from signup_items i join signup_items j on j.id = coalesce(i.shift_of, i.id) where i.id = new.item_id;
    select count(distinct c.user_id) into n from signup_claims c join signup_items i on i.id = c.item_id
     where (i.id = p.id or i.shift_of = p.id) and c.created_at > now() - interval '1 hour' and c.user_id <> all(hosts);
    msg := case when n > 1 then n || ' people claimed ' || lower(p.item) || (case when p.kind = 'time' and right(lower(p.item), 1) <> 's' then 's' else '' end)
                else private.person_name(who, s.id) || ' claimed ' || private.part_label(new.item_id) end;
    perform private.push_send(hosts, 'hosting', s.text, msg, '/#/idea/' || s.id, 'pc:' || p.id);
    -- Full now: every row of it
    select sum(i.need), sum((select count(*) from signup_claims c where c.item_id = i.id)) into v_need, v_have
      from signup_items i where (i.id = p.id or i.shift_of = p.id) and not exists (select 1 from signup_items k where k.shift_of = i.id);
    if v_need is not null and v_have >= v_need then
      perform private.push_send(hosts, 'hosting', s.text, p.item || ' is full (' || v_have || ' of ' || v_need || ')', '/#/idea/' || s.id, 'pf:' || p.id);
    end if;
    return null;
  elsif tg_table_name = 'signup_claims' then
    who := new.user_id;
    msg := private.person_name(who, s.id) || ' signed up for “' || s.item || '” at ' || s.text;
    tag := 's:' || new.item_id || ':' || who;
  elsif tg_table_name = 'date_options' then
    who := new.created_by;
    msg := coalesce(nullif(new.who, ''), private.person_name(who, s.id)) || ' suggested ' || to_char(new.day_date, 'Dy, Mon FMDD') || ' for ' || s.text;
    tag := 'd:' || s.id;
  else
    who := new.created_by;
    msg := coalesce(nullif(new.who, ''), private.person_name(who, s.id)) || ' suggested ' || new.name || ' for ' || s.text;
    tag := 'p:' || s.id;
  end if;
  hosts := private.host_ids(s.id);
  if who is null or who = any(hosts) then return null; end if;
  if who = auth.uid() and not public.is_signed_in() then tag := 'g:' || s.id; end if;   -- a guest
  perform private.push_send(hosts, 'hosting', s.text, msg, '/#/idea/' || s.id, tag);
  return null;
end $$;

-- A reminder before your spot: 2 hours before it, or at 7pm the evening before for a time before noon. Push only
-- (guests would get a text; there's no texting yet). reminded_at marks it sent.
alter table public.signup_claims add column reminded_at timestamptz;
create function private.push_parts() returns void language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_now timestamp := now() at time zone 'America/Chicago';
begin
  for r in
    select c.item_id, c.user_id, s.id as spark_id, s.text, s.day_date, coalesce(i."time", s.day_time) as t, i.kind, i.item
      from signup_claims c join signup_items i on i.id = c.item_id join sparks s on s.id = i.spark_id
     where c.reminded_at is null and i.kind <> 'job' and s.planned and s.cancelled_at is null and not s.demo and not coalesce(s.test, false)
       and s.day_date between (v_now::date) and (v_now::date + 1) and coalesce(i."time", s.day_time) is not null
  loop
    if (r.day_date + r.t) <= v_now then continue; end if;
    if (r.t < time '12:00' and v_now >= (r.day_date - 1) + time '19:00')
       or (r.t >= time '12:00' and v_now >= (r.day_date + r.t) - interval '2 hours') then
      perform private.push_send(array[r.user_id], 'reminders', r.text,
        'Your ' || (case when r.kind = 'time' then lower(r.item) else r.item end) || ' is at ' || to_char(r.t, 'FMHH12:MIam') ||
        (case when r.day_date = v_now::date then ' today' else ' tomorrow' end), '/#/idea/' || r.spark_id, 'pt:' || r.item_id || ':' || r.user_id);
      update signup_claims set reminded_at = now() where item_id = r.item_id and user_id = r.user_id;
    end if;
  end loop;
end $$;
revoke all on function private.push_parts() from public, anon, authenticated;
do $$ begin
  perform cron.schedule('push-parts', '*/15 * * * *', 'select private.push_parts()');
exception when others then raise warning 'push-parts schedule: %', sqlerrm;   -- no pg_cron (the local checks)
end $$;

-- One request loads the app: the new columns and the waitlist
create or replace function public.load_all() returns jsonb
language sql stable security invoker set search_path = public as $$
  with
  sp  as materialized (select s.* from sparks s),
  ofr as materialized (select o.* from offers o),
  itr as materialized (select spark_id, user_id, created_at, can_help from interests),
  rsv as materialized (select spark_id, user_id, status, created_at, attended from rsvps),
  coh as materialized (select spark_id, user_id, created_at from cohosts),
  scl as materialized (select item_id, user_id, note, created_at from signup_claims),
  swt as materialized (select item_id, user_id, created_at from signup_waits),
  rct as materialized (select spark_id, user_id, kind from reactions),
  nts as materialized (select id, body, created_by, created_at from notes order by created_at desc limit 50),
  las as materialized (select spark_id, user_id, asked_by, created_at, message from lead_asks),
  inv as materialized (select spark_id, user_id, invited_by, created_at, nudged_at from event_invites),
  jas as materialized (select item_id, spark_id, user_id, asked_by, message, answer, created_at, answered_at from job_asks),
  lof as materialized (select spark_id, user_id, offered_by, message, created_at from lead_offers),
  -- Everyone on screen: their names and photos come along (the profiles rules still decide which). They are
  -- looked up as a list of ids (= any(array)), so the profiles rules run for those rows only, not the table.
  who as (
    select auth.uid() as id
    union select lead_id from sp
    union select user_id from ofr
    union select user_id from itr
    union select user_id from rsv
    union select user_id from coh
    union select user_id from scl
    union select user_id from swt
    union select user_id from rct
    union select created_by from nts
    union select user_id from las
    union select asked_by from las
    union select user_id from inv
    union select user_id from jas
    union select asked_by from jas
    union select user_id from lof
  )
  select jsonb_build_object(
    'memberships',    coalesce((select jsonb_agg(to_jsonb(t)) from (select group_id, role, last_seen_at, pinned from memberships) t), '[]'::jsonb),
    'groups',         coalesce((select jsonb_agg(to_jsonb(t)) from (select id, name, photo, photo_pos, demo from groups) t), '[]'::jsonb),
    'sparks',         coalesce((select jsonb_agg(to_jsonb(sp) order by sp.created_at desc) from sp), '[]'::jsonb),
    'offers',         coalesce((select jsonb_agg(to_jsonb(ofr) order by ofr.created_at) from ofr), '[]'::jsonb),
    'interests',      coalesce((select jsonb_agg(to_jsonb(itr)) from itr), '[]'::jsonb),
    'guest_contacts', coalesce((select jsonb_agg(to_jsonb(t)) from (select spark_id, user_id, name, phone from guest_contacts) t), '[]'::jsonb),
    'rsvps',          coalesce((select jsonb_agg(to_jsonb(rsv)) from rsv), '[]'::jsonb),
    'date_options',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, day_date, day_time, who, created_by, created_at from date_options) t), '[]'::jsonb),
    'date_votes',     coalesce((select jsonb_agg(to_jsonb(t)) from (select option_id, user_id from date_votes) t), '[]'::jsonb),
    'spot_options',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, name, address, lat, lon, who, created_by, created_at from spot_options) t), '[]'::jsonb),
    'spot_votes',     coalesce((select jsonb_agg(to_jsonb(t)) from (select option_id, user_id from spot_votes) t), '[]'::jsonb),
    'signup_items',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, item, need, time, end_time, descr, shift_of, kind, waitlist, per_person, created_by, created_at from signup_items) t), '[]'::jsonb),
    'signup_claims',  coalesce((select jsonb_agg(to_jsonb(scl)) from scl), '[]'::jsonb),
    'signup_waits',   coalesce((select jsonb_agg(to_jsonb(swt) order by swt.created_at) from swt), '[]'::jsonb),
    'plan_updates',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, body, audience, created_by, created_at from plan_updates) t), '[]'::jsonb),
    'cohosts',        coalesce((select jsonb_agg(to_jsonb(coh) order by coh.created_at) from coh), '[]'::jsonb),
    'album_photos',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, path, created_by, created_at from album_photos) t), '[]'::jsonb),
    'plan_prep',      coalesce((select jsonb_agg(to_jsonb(t)) from (select spark_id, answers from plan_prep) t), '[]'::jsonb),
    'reactions',      coalesce((select jsonb_agg(to_jsonb(rct)) from rct), '[]'::jsonb),
    'spark_groups',   coalesce((select jsonb_agg(to_jsonb(t)) from (select spark_id, group_id from spark_groups) t), '[]'::jsonb),
    'event_drafts',   coalesce((select jsonb_agg(to_jsonb(t) order by t.updated_at desc) from (select id, data, updated_at from event_drafts) t), '[]'::jsonb),
    'notes',          coalesce((select jsonb_agg(to_jsonb(nts) order by nts.created_at desc) from nts), '[]'::jsonb),
    'lead_asks',      coalesce((select jsonb_agg(to_jsonb(las) order by las.created_at) from las), '[]'::jsonb),
    'event_invites',  coalesce((select jsonb_agg(to_jsonb(inv) order by inv.created_at) from inv), '[]'::jsonb),
    'job_asks',       coalesce((select jsonb_agg(to_jsonb(jas) order by jas.created_at) from jas), '[]'::jsonb),
    'lead_offers',    coalesce((select jsonb_agg(to_jsonb(lof)) from lof), '[]'::jsonb),
    'profiles',       coalesce((select jsonb_agg(to_jsonb(t)) from (select id, name, avatar_path, place, bio from profiles where id = any (array(select id from who))) t), '[]'::jsonb),
    -- Friends, requests and invites: accounts only (a guest has none), as the app asked before
    'friend_state',   case when public.is_signed_in() then public.friend_state() end
  );
$$;
