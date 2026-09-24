-- Spark Hub: one app, many groups (design handoff "Spark Torrez - Full Site 3").
--
-- * groups + memberships (admin / member), join codes, "new ideas" badges
-- * every idea belongs to a group; members see their groups' ideas, and anyone
--   holding an idea's link can open that one idea (link_access, via open_idea())
-- * profiles (name + photo) readable by everyone signed in
-- * guests take part with a name + phone (guest_contacts, visible to the lead only)
-- * ideas gain a mood board (mood), a real date (day_date / day_time)
-- * removed: date voting and RSVPs (date_options, rsvps, locked_date_id)
--
-- Existing ideas move into a "Torrez Fitness" group (code TORREZ), and every
-- existing signed-in (non-anonymous) account becomes a member. Admins are set
-- separately (see CLAUDE.md), because the right account differs per database.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- A signed-in account, not an anonymous visitor session
create function public.is_signed_in()
returns boolean language sql stable as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false;
$$;

-- ---------------------------------------------------------------------------
-- Groups and memberships
-- ---------------------------------------------------------------------------

create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 40),
  code       text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  -- a bundled site image ('photos/x.jpg') or an uploaded one ('<uid>/<uuid>.jpg')
  photo      text check (photo ~ '^(photos/[a-z0-9-]+\.(jpg|png)|[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg)$'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  group_id     uuid not null references public.groups (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('admin', 'member')),
  last_seen_at timestamptz not null default now(),
  joined_at    timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index on public.memberships (user_id);

create function public.is_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where group_id = p_group and user_id = auth.uid());
$$;

create function public.is_admin(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where group_id = p_group and user_id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Ideas belong to a group
-- ---------------------------------------------------------------------------

alter table public.sparks add column group_id uuid references public.groups (id) on delete cascade;

insert into public.groups (name, code, photo) values ('Torrez Fitness', 'TORREZ', 'photos/torrez-trail.jpg');
update public.sparks set group_id = (select id from public.groups where code = 'TORREZ');
alter table public.sparks alter column group_id set not null;
create index on public.sparks (group_id);

insert into public.memberships (group_id, user_id)
select (select id from public.groups where code = 'TORREZ'), u.id
  from auth.users u
 where not u.is_anonymous
on conflict do nothing;

-- Mood board (up to 3 photos) and a real date for the idea
alter table public.sparks
  add column mood text[] not null default '{}'
  constraint sparks_mood_check check (cardinality(mood) <= 3 and public.all_match(mood, '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'));
alter table public.sparks add column day_date date;
alter table public.sparks add column day_time time;

-- ---------------------------------------------------------------------------
-- Idea links: holding an idea's link lets you open that one idea
-- ---------------------------------------------------------------------------

create table public.link_access (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, spark_id)
);
alter table public.link_access enable row level security;
create policy "see your own links" on public.link_access
  for select to authenticated using (user_id = auth.uid());

create function public.can_see_spark(p_spark uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sparks s
     where s.id = p_spark
       and (exists (select 1 from memberships m where m.group_id = s.group_id and m.user_id = auth.uid())
            or exists (select 1 from link_access l where l.spark_id = s.id and l.user_id = auth.uid()))
  );
$$;

-- Called when someone opens an idea's link. The id is the secret; returns false for an unknown idea.
create function public.open_idea(p_spark uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from sparks where id = p_spark) then return false; end if;
  insert into link_access (user_id, spark_id) values (auth.uid(), p_spark) on conflict do nothing;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security: groups, memberships, sparks
-- ---------------------------------------------------------------------------

alter table public.groups      enable row level security;
alter table public.memberships enable row level security;

-- Group names and photos: members, and anyone holding a link to one of its ideas.
-- The join code is not a readable column (group_code() is admin-only).
create policy "see your groups" on public.groups
  for select to authenticated
  using (
    public.is_member(id)
    or exists (select 1 from link_access l join sparks s on s.id = l.spark_id
                where l.user_id = auth.uid() and s.group_id = groups.id)
  );
revoke all on table public.groups from anon, authenticated;
grant select (id, name, photo, created_by, created_at) on table public.groups to authenticated;

-- Memberships: your own rows. You may update only when you last looked.
create policy "see your memberships" on public.memberships
  for select to authenticated using (user_id = auth.uid());
create policy "mark your group seen" on public.memberships
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on table public.memberships from anon, authenticated;
grant select on table public.memberships to authenticated;
grant update (last_seen_at) on table public.memberships to authenticated;

drop policy "sparks are readable" on public.sparks;
create policy "members and link holders see an idea" on public.sparks
  for select to authenticated
  using (
    public.is_member(group_id)
    or exists (select 1 from link_access l where l.spark_id = sparks.id and l.user_id = auth.uid())
  );

drop policy "post a spark as yourself" on public.sparks;
create policy "post a spark as yourself" on public.sparks
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and lead_id = auth.uid()
    and public.is_signed_in()
    and public.is_member(group_id)
    and public.all_match(photos, '^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$')
    and public.all_match(mood,   '^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$')
  );

drop policy "the lead edits their spark" on public.sparks;
create policy "the lead edits their spark" on public.sparks
  for update to authenticated
  using (lead_id = auth.uid())
  with check (lead_id = auth.uid() and public.all_match(mood, '^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$'));

-- Leads edit these columns directly (the rest go through functions)
revoke update on table public.sparks from authenticated;
grant  update (text, hopes, spot, spot_open, day, day_date, day_time, spot_address, spot_lat, spot_lon, vision, mood)
    on table public.sparks to authenticated;

-- A new location clears the old address, unless the same update sets a new one
create or replace function public.clear_stale_spot_place() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.spot is distinct from old.spot and new.spot_address is not distinct from old.spot_address then
    new.spot_address := null;
    new.spot_lat := null;
    new.spot_lon := null;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Interests and offers follow the idea's visibility
-- ---------------------------------------------------------------------------

drop policy "interests are readable" on public.interests;
create policy "interests follow the idea" on public.interests
  for select to authenticated using (public.can_see_spark(spark_id));
drop policy "mark yourself interested" on public.interests;
create policy "mark yourself interested" on public.interests
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_spark(spark_id));

drop policy "offers are readable" on public.offers;
create policy "offers follow the idea" on public.offers
  for select to authenticated using (public.can_see_spark(spark_id));

-- A date & time offer's body is 'YYYY-MM-DDTHH:MM' (or just the date)
create function public.apply_day(p_spark uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_body ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then
    update sparks set day_date = left(p_body, 10)::date, day_time = substr(p_body, 12, 5)::time where id = p_spark;
  elsif p_body ~ '^\d{4}-\d{2}-\d{2}$' then
    update sparks set day_date = p_body::date, day_time = null where id = p_spark;
  else
    raise exception 'a date looks like 2026-10-12T07:00';
  end if;
end $$;
revoke execute on function public.apply_day(uuid, text) from public, anon, authenticated;

drop function public.add_offer(uuid, text, text, text);
create function public.add_offer(p_spark uuid, p_kind text, p_body text, p_who text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_lead uuid;
  v_status text := 'accepted';
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.can_see_spark(p_spark) then raise exception 'no such spark'; end if;
  select lead_id into v_lead from sparks where id = p_spark;
  if p_kind in ('spot', 'day') and v_lead is distinct from auth.uid() then v_status := 'pending'; end if;
  if p_kind = 'day' and p_body !~ '^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$' then raise exception 'a date looks like 2026-10-12T07:00'; end if;

  insert into offers (spark_id, user_id, who, kind, body, status)
  values (p_spark, auth.uid(), left(trim(p_who), 40), p_kind, left(trim(p_body), 300), v_status);

  if v_status = 'accepted' and p_kind = 'spot' then update sparks set spot = left(trim(p_body), 80) where id = p_spark; end if;
  if v_status = 'accepted' and p_kind = 'day'  then perform public.apply_day(p_spark, p_body); end if;
  return v_status;
end $$;

create or replace function public.resolve_offer(p_offer uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare o offers%rowtype;
begin
  select * into o from offers where id = p_offer for update;
  if not found or o.status <> 'pending' then raise exception 'that offer is no longer waiting'; end if;
  if not exists (select 1 from sparks where id = o.spark_id and lead_id = auth.uid()) then
    raise exception 'only the lead can decide';
  end if;
  if p_accept then
    update offers set status = 'accepted' where id = p_offer;
    if o.kind = 'spot' then update sparks set spot = left(o.body, 80) where id = o.spark_id; end if;
    if o.kind = 'day'  then perform public.apply_day(o.spark_id, o.body); end if;
  else
    update offers set status = 'declined' where id = p_offer;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles: name and photo, shown next to what you post
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name        text check (char_length(name) between 1 and 40),
  avatar_path text check (avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles are readable" on public.profiles
  for select to authenticated using (true);
create policy "create your profile" on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and (avatar_path is null or avatar_path like auth.uid()::text || '/%'));
create policy "edit your profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and (avatar_path is null or avatar_path like auth.uid()::text || '/%'));

-- Existing names (from sign-in metadata) seed the profiles
insert into public.profiles (id, name)
select u.id, left(coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'name'), 40)
  from auth.users u
 where coalesce(u.raw_user_meta_data ->> 'display_name', u.raw_user_meta_data ->> 'name', '') <> ''
on conflict do nothing;

create or replace function public.rename_me(p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text := left(trim(p_name), 40);
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if char_length(v_name) < 1 then raise exception 'name required'; end if;
  insert into profiles (id, name) values (auth.uid(), v_name)
  on conflict (id) do update set name = excluded.name, updated_at = now();
  update sparks set author_name = v_name where created_by = auth.uid();
  update sparks set lead_name   = v_name where lead_id    = auth.uid();
  update offers set who         = v_name where user_id    = auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- Guests: name + phone for an idea's lead to reach you
-- ---------------------------------------------------------------------------

create table public.guest_contacts (
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  phone      text not null check (phone ~ '^[0-9 ()+.-]{10,20}$' and char_length(regexp_replace(phone, '\D', '', 'g')) >= 10),
  created_at timestamptz not null default now(),
  primary key (spark_id, user_id)
);
alter table public.guest_contacts enable row level security;
create policy "you or the lead see guest contacts" on public.guest_contacts
  for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from sparks s where s.id = guest_contacts.spark_id and s.lead_id = auth.uid()));
create policy "leave your own contact" on public.guest_contacts
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_spark(spark_id));
create policy "change your own contact" on public.guest_contacts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Group actions
-- ---------------------------------------------------------------------------

-- Codes use A–Z and 2–9 without I, O, 0 and 1, so they're easy to read aloud
create function public.new_group_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v text;
begin
  loop
    v := '';
    for i in 1..6 loop v := v || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    exit when not exists (select 1 from groups where code = v);
  end loop;
  return v;
end $$;

create function public.create_group(p_name text)
returns table (id uuid, code text) language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text; v_name text := left(trim(regexp_replace(p_name, '\s+', ' ', 'g')), 40);
begin
  if not public.is_signed_in() then raise exception 'sign in to start a group'; end if;
  if char_length(v_name) < 2 then raise exception 'a group needs a name'; end if;
  if (select count(*) from groups g where g.created_by = auth.uid() and g.created_at > now() - interval '1 day') >= 10 then
    raise exception 'that''s a lot of new groups for one day';
  end if;
  v_code := public.new_group_code();
  insert into groups (name, code, created_by) values (v_name, v_code, auth.uid()) returning groups.id into v_id;
  insert into memberships (group_id, user_id, role) values (v_id, auth.uid(), 'admin');
  return query select v_id, v_code;
end $$;

-- Returns the group's id, or null if the code matches nothing
create function public.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_signed_in() then raise exception 'sign in to join a group'; end if;
  select g.id into v_id from groups g where g.code = upper(trim(p_code));
  if v_id is null then return null; end if;
  insert into memberships (group_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
  return v_id;
end $$;

create function public.group_code(p_group uuid)
returns text language sql stable security definer set search_path = public as $$
  select code from groups where id = p_group and public.is_admin(p_group);
$$;

create function public.member_count(p_group uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when public.is_admin(p_group) then (select count(*)::int from memberships where group_id = p_group) end;
$$;

-- ---------------------------------------------------------------------------
-- Signing in on a new phone moves that phone's anonymous activity across
-- ---------------------------------------------------------------------------

create or replace function public.complete_merge(p_token uuid)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare v_from uuid; v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not signed in'; end if;
  delete from merge_tokens
   where token = p_token and created_at > now() - interval '30 minutes'
  returning from_user into v_from;
  if v_from is null or v_from = v_me then return false; end if;
  if not exists (select 1 from auth.users where id = v_from and is_anonymous) then return false; end if;

  update sparks set created_by = v_me where created_by = v_from;
  update sparks set lead_id    = v_me where lead_id    = v_from;
  update offers set user_id    = v_me where user_id    = v_from;
  update interests i set user_id = v_me
   where i.user_id = v_from
     and not exists (select 1 from interests x where x.spark_id = i.spark_id and x.user_id = v_me);
  delete from interests where user_id = v_from;
  update guest_contacts c set user_id = v_me
   where c.user_id = v_from
     and not exists (select 1 from guest_contacts x where x.spark_id = c.spark_id and x.user_id = v_me);
  delete from guest_contacts where user_id = v_from;
  insert into link_access (user_id, spark_id)
  select v_me, spark_id from link_access where user_id = v_from
  on conflict do nothing;
  delete from link_access where user_id = v_from;
  insert into profiles (id, name)
  select v_me, name from profiles where id = v_from and name is not null
  on conflict (id) do nothing;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Removed: date voting and RSVPs
-- ---------------------------------------------------------------------------

drop trigger sparks_locked_date_check on public.sparks;
drop function public.sparks_check_locked_date();
alter table public.sparks drop column locked_date_id;
drop function public.remove_date_option(uuid);
drop function public.rsvp_counts();
drop table public.rsvps;
drop table public.date_options;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.is_member(uuid)           from public, anon;
revoke execute on function public.is_admin(uuid)            from public, anon;
revoke execute on function public.can_see_spark(uuid)       from public, anon;
revoke execute on function public.open_idea(uuid)           from public, anon;
revoke execute on function public.add_offer(uuid, text, text, text) from public, anon;
revoke execute on function public.new_group_code()          from public, anon, authenticated;
revoke execute on function public.create_group(text)        from public, anon;
revoke execute on function public.join_group(text)          from public, anon;
revoke execute on function public.group_code(uuid)          from public, anon;
revoke execute on function public.member_count(uuid)        from public, anon;
grant  execute on function public.is_member(uuid)           to authenticated;
grant  execute on function public.is_admin(uuid)            to authenticated;
grant  execute on function public.can_see_spark(uuid)       to authenticated;
grant  execute on function public.open_idea(uuid)           to authenticated;
grant  execute on function public.add_offer(uuid, text, text, text) to authenticated;
grant  execute on function public.create_group(text)        to authenticated;
grant  execute on function public.join_group(text)          to authenticated;
grant  execute on function public.group_code(uuid)          to authenticated;
grant  execute on function public.member_count(uuid)        to authenticated;
