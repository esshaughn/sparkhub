-- Crews (Design v9-1 item 5b, Q52; owner 2026-10-17: the name is "crew", and lists retire in the app once crews ship).
-- A crew is a shared page for a group of friends: everyone in it sees the same members, the crew's plans (the next one
-- pinned on top), a standing calendar ("Every other Sunday") and a simple thread. Invite-only between friends: you can
-- start a crew with your friends and add your own friends to one you're in; nobody else can join or see it.
-- A crew's plans are ordinary events with sparks.crew_id set: posting one gives every member a link_access row
-- (via 'crew'), so the usual rules (who sees an event, replies, co-hosts, updates) work unchanged, and someone added
-- later gets the crew's upcoming plans the same way. Leaving takes those rows away.

-- 1. Crews and their members ----------------------------------------------------------------------------------------
create table public.crews (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 32),
  photo      text check (photo ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  -- The standing calendar: every week, every other week or once a month (the same weekday, counted from every_from)
  every      text check (every in ('week', '2weeks', 'month')),
  every_from date,
  skips      date[] not null default '{}' check (cardinality(skips) <= 24),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((every is null) = (every_from is null))
);

create table public.crew_members (
  crew_id   uuid not null references public.crews (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  added_by  uuid references auth.users (id) on delete set null,
  joined_at timestamptz not null default now(),
  read_at   timestamptz,
  primary key (crew_id, user_id)
);
create index crew_members_user on public.crew_members (user_id);

create or replace function public.is_crew_member(p_crew uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from crew_members where crew_id = p_crew and user_id = auth.uid())
$$;
revoke all on function public.is_crew_member(uuid) from public, anon;
grant execute on function public.is_crew_member(uuid) to authenticated;

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
create policy "members read their crews" on public.crews for select to authenticated using (public.is_crew_member(id));
create policy "members read who's in their crews" on public.crew_members for select to authenticated using (public.is_crew_member(crew_id));
-- No client writes: everything goes through the functions below
revoke all on table public.crews from anon, authenticated;
revoke all on table public.crew_members from anon, authenticated;
grant select on table public.crews to authenticated;
grant select on table public.crew_members to authenticated;

-- 2. The thread -----------------------------------------------------------------------------------------------------
create table public.crew_messages (
  id         uuid primary key default gen_random_uuid(),
  crew_id    uuid not null references public.crews (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index crew_messages_crew on public.crew_messages (crew_id, created_at desc);
alter table public.crew_messages enable row level security;
create policy "members read the thread" on public.crew_messages for select to authenticated using (public.is_crew_member(crew_id));
create policy "members write as themselves" on public.crew_messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_crew_member(crew_id) and public.is_signed_in());
create policy "delete your own messages" on public.crew_messages for delete to authenticated using (user_id = auth.uid());
revoke all on table public.crew_messages from anon, authenticated;
grant select, delete on table public.crew_messages to authenticated;
grant insert (crew_id, user_id, body) on table public.crew_messages to authenticated;

-- 60 messages an hour each; everyone else in the crew gets one push per crew that the next one replaces (topic
-- friends, tag cm:{crew}) and no bell line (the card's pink count is the unread mark)
create or replace function private.crew_message_push() returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_to uuid[];
begin
  if not private.rate_ok(new.user_id, 'crew_message', 60, interval '1 hour', null) then
    raise exception 'too many messages' using errcode = 'PT429';
  end if;
  new.body := btrim(new.body);
  select name into v_name from crews where id = new.crew_id;
  select array_agg(user_id) into v_to from crew_members where crew_id = new.crew_id and user_id <> new.user_id;
  perform private.push_send(v_to, 'friends', v_name, left(private.person_name(new.user_id, null) || ': ' || new.body, 200),
    '/#/crew/' || new.crew_id, 'cm:' || new.crew_id);
  -- Writing counts as reading
  update crew_members set read_at = now() where crew_id = new.crew_id and user_id = new.user_id;
  return new;
end $$;
create trigger crew_message_push before insert on public.crew_messages for each row execute function private.crew_message_push();

-- 3. A crew's plans: sparks.crew_id ---------------------------------------------------------------------------------
alter table public.sparks add column if not exists crew_id uuid references public.crews (id) on delete set null;
create index if not exists sparks_crew on public.sparks (crew_id) where crew_id is not null;
grant update (crew_id) on public.sparks to authenticated;

alter table public.link_access drop constraint if exists link_access_via_check;
alter table public.link_access add constraint link_access_via_check check (via in ('link', 'invite', 'crew'));

-- Only a member may put an event in a crew (the service role, for scripts, may too)
create or replace function private.sparks_crew_ok() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.crew_id is null or (tg_op = 'UPDATE' and new.crew_id is not distinct from old.crew_id) then return new; end if;
  if auth.uid() is not null and not public.is_crew_member(new.crew_id) then
    raise exception 'crew: only its members plan for it' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.sparks_crew_ok() from public;
create trigger sparks_crew_ok before insert or update of crew_id on public.sparks
  for each row execute function private.sparks_crew_ok();

-- Give a crew's members one of its events (via 'crew'; an existing invite or link stays as it is)
create or replace function private.crew_share(p_crew uuid, p_spark uuid, p_users uuid[])
returns void language sql security definer set search_path = public as $$
  insert into link_access (user_id, spark_id, via)
  select m.user_id, p_spark, 'crew' from crew_members m
   where m.crew_id = p_crew and (p_users is null or m.user_id = any(p_users))
  on conflict do nothing
$$;
revoke all on function private.crew_share(uuid, uuid, uuid[]) from public, anon, authenticated;

-- Posting a crew plan (or moving an event into a crew) shares it with the crew; a new plan pushes the other members
-- (topic friends; test, demo and [E2E] events stay quiet)
create or replace function private.sparks_crew_share() returns trigger language plpgsql security definer set search_path = public as $$
declare v_crew text; v_to uuid[];
begin
  if new.crew_id is null or (tg_op = 'UPDATE' and new.crew_id is not distinct from old.crew_id) then return null; end if;
  perform private.crew_share(new.crew_id, new.id, null);
  if new.demo or coalesce(new.test, false) or new.text like '[E2E]%' then return null; end if;
  select name into v_crew from crews where id = new.crew_id;
  select array_agg(user_id) into v_to from crew_members where crew_id = new.crew_id and user_id <> new.lead_id;
  perform private.push_send(v_to, 'friends', v_crew,
    private.person_name(new.lead_id, new.id) || ' planned ' || left(new.text, 120), '/#/idea/' || new.id, 'cp:' || new.id);
  return null;
end $$;
revoke all on function private.sparks_crew_share() from public;
create trigger sparks_crew_share after insert or update of crew_id on public.sparks
  for each row execute function private.sparks_crew_share();

-- 4. Starting a crew, adding friends, leaving ------------------------------------------------------------------------
-- Who can be added: an account (not a guest) who is the caller's friend, with no block either way
create or replace function private.crew_addable(p_by uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and p_user <> p_by
     and exists (select 1 from auth.users u where u.id = p_user and not coalesce(u.is_anonymous, false))
     and exists (select 1 from friendships f where f.user_a = least(p_by, p_user) and f.user_b = greatest(p_by, p_user))
     and not exists (select 1 from user_blocks b where (b.blocker = p_by and b.blocked = p_user) or (b.blocker = p_user and b.blocked = p_by))
$$;
revoke all on function private.crew_addable(uuid, uuid) from public, anon, authenticated;

-- Add friends to a crew (up to 30 people in a crew); each one gets the crew's upcoming plans, a quiet bell line and a
-- push. Returns how many were added
create or replace function private.crew_add_people(p_crew uuid, p_people uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p uuid; n int := 0; v_crew text; v_me text; s record;
begin
  select name into v_crew from crews where id = p_crew;
  v_me := private.person_name(me, null);
  foreach p in array coalesce(p_people, '{}') loop
    continue when not private.crew_addable(me, p);
    if (select count(*) from crew_members where crew_id = p_crew) >= 30 then
      raise exception 'up to 30 people in a crew' using errcode = '22023';
    end if;
    insert into crew_members (crew_id, user_id, added_by) values (p_crew, p, me) on conflict do nothing;
    continue when not found;
    n := n + 1;
    for s in select id from sparks where crew_id = p_crew and cancelled_at is null
               and (day_date is null or day_date >= (now() at time zone 'America/Chicago')::date) loop
      perform private.crew_share(p_crew, s.id, array[p]);
    end loop;
    insert into notes (user_id, body, created_by, quiet) values (p, left(v_me || ' added you to ' || v_crew || '.', 320), me, true);
    perform private.push_send(array[p], 'friends', v_crew, v_me || ' added you to the crew', '/#/crew/' || p_crew, 'ca:' || p_crew);
  end loop;
  return n;
end $$;
revoke all on function private.crew_add_people(uuid, uuid[]) from public, anon, authenticated;

-- Start a crew with some of your friends (signed in; 10 an hour). Returns its id
create or replace function public.start_crew(p_name text, p_people uuid[], p_photo text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_id uuid;
begin
  if me is null or not public.is_signed_in() then raise exception 'sign in to start a crew' using errcode = '42501'; end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'a crew needs a name' using errcode = '22023'; end if;
  if p_photo is not null and split_part(p_photo, '/', 1) <> me::text then
    raise exception 'photo: your own uploads only' using errcode = '22023';
  end if;
  if not private.rate_ok(me, 'start_crew', 10, interval '1 hour', null) then
    raise exception 'too many crews' using errcode = 'PT429';
  end if;
  insert into crews (name, photo, created_by) values (btrim(p_name), p_photo, me) returning id into v_id;
  insert into crew_members (crew_id, user_id, added_by, read_at) values (v_id, me, me, now());
  perform private.crew_add_people(v_id, p_people);
  return v_id;
end $$;
revoke all on function public.start_crew(text, uuid[], text) from public, anon;
grant execute on function public.start_crew(text, uuid[], text) to authenticated;

-- Anyone in a crew adds their own friends
create or replace function public.crew_add(p_crew uuid, p_people uuid[])
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not public.is_crew_member(p_crew) then raise exception 'only the crew adds people' using errcode = '42501'; end if;
  return private.crew_add_people(p_crew, p_people);
end $$;
revoke all on function public.crew_add(uuid, uuid[]) from public, anon;
grant execute on function public.crew_add(uuid, uuid[]) to authenticated;

-- Leave a crew (quietly). Its plans you only had through the crew go; the last one out deletes the crew
create or replace function public.crew_leave(p_crew uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  delete from crew_members where crew_id = p_crew and user_id = me;
  if not found then return; end if;
  delete from link_access l using sparks s
   where l.user_id = me and l.via = 'crew' and l.spark_id = s.id and s.crew_id = p_crew;
  if not exists (select 1 from crew_members where crew_id = p_crew) then delete from crews where id = p_crew; end if;
end $$;
revoke all on function public.crew_leave(uuid) from public, anon;
grant execute on function public.crew_leave(uuid) to authenticated;

-- 5. Changing a crew: anyone in it (friend groups are flat). Null leaves a field alone; p_every '' clears the calendar
create or replace function public.crew_edit(p_crew uuid, p_name text default null, p_photo text default null,
                                            p_every text default null, p_every_from date default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not public.is_crew_member(p_crew) then raise exception 'only the crew changes it' using errcode = '42501'; end if;
  if p_photo is not null and p_photo <> '' and split_part(p_photo, '/', 1) <> me::text then
    raise exception 'photo: your own uploads only' using errcode = '22023';
  end if;
  update crews set
    name = coalesce(nullif(btrim(p_name), ''), name),
    photo = case when p_photo is null then photo else nullif(p_photo, '') end,
    every = case when p_every is null then every else nullif(p_every, '') end,
    every_from = case when p_every is null then every_from when p_every = '' then null else coalesce(p_every_from, every_from) end,
    skips = case when p_every is null then skips else '{}' end
  where id = p_crew;
end $$;
revoke all on function public.crew_edit(uuid, text, text, text, date) from public, anon;
grant execute on function public.crew_edit(uuid, text, text, text, date) to authenticated;

-- Skip one standing date (or take the skip back); only dates from today on are kept
create or replace function public.crew_skip(p_crew uuid, p_day date, p_skip boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'America/Chicago')::date;
begin
  if not public.is_crew_member(p_crew) then raise exception 'only the crew changes it' using errcode = '42501'; end if;
  update crews set skips = array(
    select distinct d from unnest(skips || case when p_skip then array[p_day] else '{}'::date[] end) d
     where d >= v_today and (p_skip or d <> p_day) order by 1)
  where id = p_crew;
end $$;
revoke all on function public.crew_skip(uuid, date, boolean) from public, anon;
grant execute on function public.crew_skip(uuid, date, boolean) to authenticated;

-- Mark the thread read
create or replace function public.crew_read(p_crew uuid)
returns void language sql security definer set search_path = public as $$
  update crew_members set read_at = now() where crew_id = p_crew and user_id = auth.uid()
$$;
revoke all on function public.crew_read(uuid) from public, anon;
grant execute on function public.crew_read(uuid) to authenticated;

-- 6. Reading: my crews with their people (first name, photo) and my unread count; one crew's thread with names -------
create or replace function public.my_crews()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'photo', c.photo, 'every', c.every, 'every_from', c.every_from, 'skips', c.skips,
      'created_by', c.created_by, 'created_at', c.created_at,
      'people', (select jsonb_agg(jsonb_build_object('id', m.user_id, 'name', p.name, 'avatar', p.avatar_path) order by m.joined_at)
                   from crew_members m left join profiles p on p.id = m.user_id where m.crew_id = c.id),
      'unread', (select count(*) from crew_messages x
                  where x.crew_id = c.id and x.user_id <> auth.uid() and x.created_at > coalesce(me.read_at, me.joined_at)),
      'last_at', (select max(created_at) from crew_messages x where x.crew_id = c.id)
    ) order by c.created_at), '[]'::jsonb)
    from crew_members me join crews c on c.id = me.crew_id
   where me.user_id = auth.uid()
$$;
revoke all on function public.my_crews() from public, anon;
grant execute on function public.my_crews() to authenticated;

-- The last 100 messages, oldest first, with each writer's name and photo (also people who have left)
create or replace function public.crew_thread(p_crew uuid)
returns table (id uuid, user_id uuid, body text, created_at timestamptz, name text, avatar text)
language sql stable security definer set search_path = public as $$
  select * from (
    select x.id, x.user_id, x.body, x.created_at, p.name, p.avatar_path
      from crew_messages x left join profiles p on p.id = x.user_id
     where x.crew_id = p_crew and public.is_crew_member(p_crew)
     order by x.created_at desc limit 100) t
  order by created_at
$$;
revoke all on function public.crew_thread(uuid) from public, anon;
grant execute on function public.crew_thread(uuid) to authenticated;
