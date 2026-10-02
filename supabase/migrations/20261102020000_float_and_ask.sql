-- Float an idea, and ask someone to lead it (owner, 2026-10-02).
-- 1. Create event can post an idea that's already looking for a lead (sparks.wants_host set on insert). A floated
--    idea is quieter than one with a lead: the group gets no "New idea" push for it.
-- 2. Only someone in one of the event's groups can take the lead. Until now anyone who could see the idea could,
--    a link holder from outside the group included, which left an event led by someone its group doesn't know.
-- 3. Ask someone to lead: the floater (or a co-lead, or an admin of its home group) asks a person from the event's
--    groups. They get one push that opens the idea, the bell shows it, and the idea's lead row tells them who asked.
--    Taking the lead (or the floater taking it back) clears the asks.

-- 1. A floated idea -------------------------------------------------------------------------------------
-- Posting can't set the hidden demo flag or backdate the post (20261003000000_hardening_2.sql), and a plan is
-- never looking for a lead: only an idea can be floated
create or replace function public.sparks_insert_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.demo := false;
    new.created_at := now();
  end if;
  if new.planned then new.wants_host := false; end if;
  return new;
end $$;

-- No new-idea push while an idea is looking for a lead. Otherwise the same as 20261031000000_test_events.sql
create or replace function private.push_new_event() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; g text; home uuid; users uuid[];
begin
  if auth.uid() is null then return null; end if;
  if tg_table_name = 'sparks' then
    select new.id as id, new.text as text, new.group_id as group_id, new.lead_id as lead_id, new.planned as planned,
           new.visibility as visibility, new.day_date as day_date, new.day_time as day_time, new.spot as spot, new.test as test,
           new.wants_host as wants_host into s;
  else   -- spark_groups: tell that group's members who aren't in the event's home group
    select id, text, new.group_id as group_id, lead_id, planned, visibility, day_date, day_time, spot, test, wants_host, group_id as home
      into s from sparks where id = new.spark_id;
    home := s.home;
  end if;
  if s.visibility <> 'group' or s.test or (s.wants_host and not s.planned) then return null; end if;
  select name into g from groups where id = s.group_id;
  select array_agg(m.user_id) into users from memberships m
   where m.group_id = s.group_id and m.user_id <> s.lead_id
     and (home is null or not exists (select 1 from memberships h where h.group_id = home and h.user_id = m.user_id));
  if s.planned then
    perform private.push_send(users, 'newevents', 'New in ' || coalesce(g, 'your group') || ': ' || s.text,
      private.when_text(s.day_date, s.day_time, s.spot) || '. RSVP in Spark Hub.', '/#/idea/' || s.id, 'e:' || s.id);
  else
    perform private.push_send(users, 'newevents', 'New idea in ' || coalesce(g, 'your group') || ': ' || s.text,
      private.person_name(s.lead_id, s.id) || ' is floating it. Tap I’m interested if you’d come.', '/#/idea/' || s.id, 'i:' || s.id);
  end if;
  return null;
end $$;

-- 3. Asks (the table comes first: take_the_lead() below clears it) ---------------------------------------
create table public.lead_asks (
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  asked_by   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (spark_id, user_id)
);
create index lead_asks_user on public.lead_asks (user_id);
alter table public.lead_asks enable row level security;
-- The person asked, whoever asked, and the idea's hosts read them; nobody writes them directly
create policy "asks you're part of" on public.lead_asks
  for select to authenticated using (user_id = auth.uid() or asked_by = auth.uid() or public.is_host(spark_id));
revoke all on table public.lead_asks from public, anon, authenticated;
grant select on table public.lead_asks to authenticated;

-- In one of the event's groups (its home group, or one it's also posted to)
create or replace function private.in_event_groups(p_spark uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
     where m.user_id = p_user
       and (m.group_id = (select group_id from sparks where id = p_spark)
            or m.group_id in (select g.group_id from spark_groups g where g.spark_id = p_spark)));
$$;
revoke all on function private.in_event_groups(uuid, uuid) from public, anon, authenticated;

create or replace function public.ask_to_lead(p_spark uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_name text;
begin
  select id, text, lead_id, group_id, visibility, wants_host, planned, cancelled_at into s from sparks where id = p_spark;
  if s.id is null or not (public.is_host(p_spark) or public.is_admin(s.group_id)) then
    raise exception 'only a lead can ask someone to lead' using errcode = '42501';
  end if;
  if not s.wants_host or s.planned or s.cancelled_at is not null then
    raise exception 'this idea isn''t looking for a lead' using errcode = '23514';
  end if;
  if p_user is null or p_user = auth.uid() or p_user = s.lead_id then
    raise exception 'ask someone else' using errcode = '22023';
  end if;
  -- An account (not a guest) in one of the event's groups: the same people who may take the lead
  if not exists (select 1 from auth.users u where u.id = p_user and not coalesce(u.is_anonymous, false))
     or not private.in_event_groups(p_spark, p_user) then
    raise exception 'leads come from the event''s groups' using errcode = '22023';
  end if;
  if exists (select 1 from lead_asks where spark_id = p_spark and user_id = p_user) then return; end if;   -- asked already: no second push
  if (select count(*) from lead_asks where spark_id = p_spark) >= 10 then
    raise exception 'up to 10 asks at a time' using errcode = '22023';
  end if;
  insert into lead_asks (spark_id, user_id, asked_by) values (p_spark, p_user, auth.uid());
  -- An invite-only idea: the ask lets them see it, like an invite
  if s.visibility <> 'group' then
    insert into link_access (user_id, spark_id, via) values (p_user, p_spark, 'invite') on conflict (user_id, spark_id) do nothing;
  end if;
  v_name := private.person_name(auth.uid(), p_spark);
  perform private.push_send(array[p_user], 'friends', v_name || ' asked if you’d lead ' || left(s.text, 120),
    'Take a look. If you’re up for it, tap I’ll lead.', '/#/idea/' || s.id, 'la:' || s.id);
end $$;
revoke execute on function public.ask_to_lead(uuid, uuid) from public, anon;
grant  execute on function public.ask_to_lead(uuid, uuid) to authenticated;

-- 2. Taking the lead: someone in the event's groups. Otherwise the same as 20261101150000_colead_wording.sql
create or replace function public.take_the_lead(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_name text;
begin
  select id, text, lead_id, wants_host, planned, cancelled_at into s from sparks where id = p_spark for update;
  if s.id is null or not public.can_see_spark(p_spark) or not public.is_signed_in() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not private.in_event_groups(p_spark, auth.uid()) then
    raise exception 'leads come from the event''s groups' using errcode = '42501';
  end if;
  if not s.wants_host or s.planned or s.cancelled_at is not null or s.lead_id = auth.uid() then
    raise exception 'this idea isn''t looking for a lead' using errcode = '23514';
  end if;
  select coalesce(nullif(p.name, ''), 'Someone') into v_name from profiles p where p.id = auth.uid();
  delete from cohosts where spark_id = p_spark and user_id = auth.uid();
  delete from lead_asks where spark_id = p_spark;
  update sparks set lead_id = auth.uid(), lead_name = coalesce(v_name, 'Someone'), wants_host = false where id = p_spark;
  if s.lead_id is not null then
    insert into interests (spark_id, user_id) values (p_spark, s.lead_id) on conflict (spark_id, user_id) do nothing;
    insert into notes (user_id, body, created_by)
      values (s.lead_id, left(coalesce(v_name, 'Someone') || ' is leading ' || left(s.text, 120) || '. Thanks for floating it!', 320), auth.uid());
  end if;
  delete from interests where spark_id = p_spark and user_id = auth.uid();   -- the new lead isn't "interested" in their own idea
end $$;

-- The floater taking it back clears the asks too
create or replace function public.set_wants_host(p_spark uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from sparks where id = p_spark and lead_id = auth.uid() and not planned and cancelled_at is null) then
    raise exception 'only the lead of an idea can do that' using errcode = '42501';
  end if;
  update sparks set wants_host = coalesce(p_on, false) where id = p_spark;
  if not coalesce(p_on, false) then delete from lead_asks where spark_id = p_spark; end if;
end $$;

-- 4. The app's one request carries the asks (otherwise the same as 20261101220000_load_all.sql) ----------
create or replace function public.load_all() returns jsonb
language sql stable security invoker set search_path = public as $$
  with
  sp  as materialized (select s.* from sparks s),
  ofr as materialized (select o.* from offers o),
  itr as materialized (select spark_id, user_id, created_at, can_help from interests),
  rsv as materialized (select spark_id, user_id, status, created_at, attended from rsvps),
  coh as materialized (select spark_id, user_id, created_at from cohosts),
  scl as materialized (select item_id, user_id, note, created_at from signup_claims),
  rct as materialized (select spark_id, user_id, kind from reactions),
  nts as materialized (select id, body, created_by, created_at from notes order by created_at desc limit 50),
  las as materialized (select spark_id, user_id, asked_by, created_at from lead_asks),
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
    union select user_id from rct
    union select created_by from nts
    union select user_id from las
    union select asked_by from las
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
    'signup_items',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, item, need, time, end_time, descr, shift_of, created_by, created_at from signup_items) t), '[]'::jsonb),
    'signup_claims',  coalesce((select jsonb_agg(to_jsonb(scl)) from scl), '[]'::jsonb),
    'plan_updates',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, body, audience, created_by, created_at from plan_updates) t), '[]'::jsonb),
    'cohosts',        coalesce((select jsonb_agg(to_jsonb(coh) order by coh.created_at) from coh), '[]'::jsonb),
    'album_photos',   coalesce((select jsonb_agg(to_jsonb(t)) from (select id, spark_id, path, created_by, created_at from album_photos) t), '[]'::jsonb),
    'plan_prep',      coalesce((select jsonb_agg(to_jsonb(t)) from (select spark_id, answers from plan_prep) t), '[]'::jsonb),
    'reactions',      coalesce((select jsonb_agg(to_jsonb(rct)) from rct), '[]'::jsonb),
    'spark_groups',   coalesce((select jsonb_agg(to_jsonb(t)) from (select spark_id, group_id from spark_groups) t), '[]'::jsonb),
    'event_drafts',   coalesce((select jsonb_agg(to_jsonb(t) order by t.updated_at desc) from (select id, data, updated_at from event_drafts) t), '[]'::jsonb),
    'notes',          coalesce((select jsonb_agg(to_jsonb(nts) order by nts.created_at desc) from nts), '[]'::jsonb),
    'lead_asks',      coalesce((select jsonb_agg(to_jsonb(las) order by las.created_at) from las), '[]'::jsonb),
    'profiles',       coalesce((select jsonb_agg(to_jsonb(t)) from (select id, name, avatar_path, place, bio from profiles where id = any (array(select id from who))) t), '[]'::jsonb),
    -- Friends, requests and invites: accounts only (a guest has none), as the app asked before
    'friend_state',   case when public.is_signed_in() then public.friend_state() end
  );
$$;

revoke execute on function public.load_all() from public, anon;
grant execute on function public.load_all() to authenticated;
