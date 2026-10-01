-- Friends (v6 Update 13, owner's answers 2026-09-30).
-- * Mutual: a request from a member profile (people who share a group) and an Accept, or your
--   friend link (/add/CODE): opening it and saying yes makes you friends straight away (sharing
--   the link was the owner's yes).
-- * Declining is quiet: the request stays, marked declined, so the sender still sees "Requested"
--   and can't ask again. If the person who declined sends a request later, that makes them friends.
-- * Removing a friend is quiet too, and clears any requests between the two.
-- * Being friends shows nothing extra except names and photos (profiles policy). It's a shortcut
--   for inviting: invite_friends() lets the lead, a group admin, or (when the lead allows it,
--   sparks.guest_invites) anyone going invite friends to an event. An invite works like the
--   event's link (link_access), so friends outside the group can see it and RSVP.
-- Clients read everything through friend_state() and write only through the functions below.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.friendships (
  user_a     uuid not null references auth.users (id) on delete cascade,
  user_b     uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_b on public.friendships (user_b);

create table public.friend_requests (
  from_id     uuid not null references auth.users (id) on delete cascade,
  to_id       uuid not null references auth.users (id) on delete cascade,
  group_id    uuid references public.groups (id) on delete set null,   -- a group they share ("Wants to be friends · Woodcliff")
  created_at  timestamptz not null default now(),
  declined_at timestamptz,
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index friend_requests_to on public.friend_requests (to_id);

create table public.friend_codes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  code       text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);

create table public.event_invites (
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,   -- who was invited
  invited_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (spark_id, user_id)
);
create index event_invites_user on public.event_invites (user_id);

alter table public.friendships enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friend_codes enable row level security;
alter table public.event_invites enable row level security;
revoke all on table public.friendships, public.friend_requests, public.friend_codes, public.event_invites from anon, authenticated;
-- No policies on friendships, friend_requests or friend_codes: friend_state() is the only way in.
-- Invites: the person invited and whoever invited them can read the row.
create policy "your invites" on public.event_invites
  for select to authenticated using (user_id = auth.uid() or invited_by = auth.uid());
grant select on table public.event_invites to authenticated;

-- The lead decides whether guests can invite their friends (on by default)
alter table public.sparks add column guest_invites boolean not null default true;
grant update (guest_invites) on table public.sparks to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.is_friend(p_other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships
                  where user_a = least(auth.uid(), p_other) and user_b = greatest(auth.uid(), p_other));
$$;
revoke execute on function public.is_friend(uuid) from public, anon;
grant execute on function public.is_friend(uuid) to authenticated;

create function private.make_friends(p_x uuid, p_y uuid)
returns void language sql security definer set search_path = public as $$
  insert into friendships (user_a, user_b) values (least(p_x, p_y), greatest(p_x, p_y)) on conflict do nothing;
  delete from friend_requests where (from_id = p_x and to_id = p_y) or (from_id = p_y and to_id = p_x);
$$;

create function private.new_friend_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v text;
begin
  loop
    v := '';
    for i in 1..6 loop v := v || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    exit when not exists (select 1 from friend_codes where code = v);
  end loop;
  return v;
end $$;

-- Friends' names and photos are readable (link friends may share no group). Same policy as
-- 20261005000000_profiles_share_group.sql plus the friend line.
drop policy if exists "profiles of people around you" on public.profiles;
create policy "profiles of people around you" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.shares_group(profiles.id)
    or public.is_friend(profiles.id)
    or exists (select 1 from public.sparks s where s.lead_id = profiles.id
                 and public.can_see_spark_row(s.id, s.group_id, s.lead_id, s.visibility))
    or exists (select 1 from public.interests i where i.user_id = profiles.id and public.can_see_spark(i.spark_id))
    or exists (select 1 from public.offers o where o.user_id = profiles.id and public.can_see_spark(o.spark_id))
    or exists (select 1 from public.rsvps r where r.user_id = profiles.id and public.can_see_spark(r.spark_id))
    or exists (select 1 from public.organizers g where g.user_id = profiles.id and public.can_see_spark(g.spark_id))
    or exists (select 1 from public.signup_claims c join public.signup_items t on t.id = c.item_id
                where c.user_id = profiles.id and public.can_see_spark(t.spark_id))
    or exists (select 1 from public.reactions x where x.user_id = profiles.id and public.can_see_spark(x.spark_id))
  );

-- ---------------------------------------------------------------------------
-- Reading: everything the Friends tab and the bell need, in one call
-- ---------------------------------------------------------------------------

create function public.friend_state()
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  fr as (
    select case when f.user_a = me.id then f.user_b else f.user_a end as id, f.created_at
      from friendships f, me where me.id in (f.user_a, f.user_b)
  )
  select jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', fr.id, 'name', coalesce(nullif(p.name, ''), 'No name yet'), 'avatar', p.avatar_path, 'since', fr.created_at,
               'groups', coalesce((select jsonb_agg(g.name order by g.name)
                                     from groups g
                                     join memberships a on a.group_id = g.id and a.user_id = (select id from me)
                                     join memberships b on b.group_id = g.id and b.user_id = fr.id), '[]'::jsonb))
             order by lower(coalesce(p.name, '')))
        from fr left join profiles p on p.id = fr.id), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.from_id, 'name', coalesce(nullif(p.name, ''), 'Someone'), 'avatar', p.avatar_path,
               'group', g.name, 'at', r.created_at) order by r.created_at desc)
        from friend_requests r left join profiles p on p.id = r.from_id left join groups g on g.id = r.group_id
       where r.to_id = (select id from me) and r.declined_at is null), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(r.to_id) from friend_requests r where r.from_id = (select id from me)), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('spark', i.spark_id, 'by', i.invited_by, 'at', i.created_at) order by i.created_at desc)
        from event_invites i where i.user_id = (select id from me) and i.created_at > now() - interval '60 days'), '[]'::jsonb)
  );
$$;
revoke execute on function public.friend_state() from public, anon;
grant execute on function public.friend_state() to authenticated;

-- ---------------------------------------------------------------------------
-- Requests (from a member profile: you have to share a group)
-- ---------------------------------------------------------------------------

create function public.send_friend_request(p_to uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_group uuid;
begin
  if not public.is_signed_in() then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_to is null or p_to = v_me then raise exception 'not someone else' using errcode = '22023'; end if;
  if public.is_friend(p_to) then return 'friends'; end if;
  -- They asked you first (even if you declined it then): that's both of you saying yes
  if exists (select 1 from friend_requests where from_id = p_to and to_id = v_me) then
    perform private.make_friends(v_me, p_to);
    return 'friends';
  end if;
  if exists (select 1 from friend_requests where from_id = v_me and to_id = p_to) then return 'requested'; end if;
  select a.group_id into v_group from memberships a join memberships b on b.group_id = a.group_id and b.user_id = p_to
   where a.user_id = v_me order by a.joined_at limit 1;
  if v_group is null then raise exception 'you don''t share a group' using errcode = '42501'; end if;
  if (select count(*) from friend_requests where from_id = v_me and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'That''s a lot of requests at once. Try again in a bit.' using errcode = '54000';
  end if;
  insert into friend_requests (from_id, to_id, group_id) values (v_me, p_to, v_group);
  return 'requested';
end $$;
revoke execute on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

create function public.answer_friend_request(p_from uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from friend_requests where from_id = p_from and to_id = auth.uid()) then return; end if;
  if p_accept then perform private.make_friends(auth.uid(), p_from);
  else update friend_requests set declined_at = now() where from_id = p_from and to_id = auth.uid();
  end if;
end $$;
revoke execute on function public.answer_friend_request(uuid, boolean) from public, anon;
grant execute on function public.answer_friend_request(uuid, boolean) to authenticated;

create function public.remove_friend(p_other uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from friendships where user_a = least(auth.uid(), p_other) and user_b = greatest(auth.uid(), p_other);
  delete from friend_requests where (from_id = auth.uid() and to_id = p_other) or (from_id = p_other and to_id = auth.uid());
end $$;
revoke execute on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Friend links (/add/CODE)
-- ---------------------------------------------------------------------------

-- Your code, made the first time you ask; p_new gives you a new one (the old link stops working)
create function public.my_friend_code(p_new boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if not public.is_signed_in() then raise exception 'sign in first' using errcode = '42501'; end if;
  select code into v from friend_codes where user_id = auth.uid();
  if v is null or p_new then
    v := private.new_friend_code();
    insert into friend_codes (user_id, code) values (auth.uid(), v)
    on conflict (user_id) do update set code = excluded.code, created_at = now();
  end if;
  return v;
end $$;
revoke execute on function public.my_friend_code(boolean) from public, anon;
grant execute on function public.my_friend_code(boolean) to authenticated;

-- Whose link this is (the landing and link previews): the name and photo only
create function public.friend_link_preview(p_code text)
returns table (name text, avatar_path text)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(p.name, ''), 'Someone'), p.avatar_path
    from friend_codes c left join profiles p on p.id = c.user_id
   where c.code = upper(p_code) and char_length(p_code) = 6;
$$;
revoke execute on function public.friend_link_preview(text) from public;
grant execute on function public.friend_link_preview(text) to anon, authenticated;

-- Yes on someone's link: friends straight away. Returns 'friends' · 'already' · 'self' · 'bad', and their id
create function public.add_friend_by_code(p_code text)
returns table (result text, friend_id uuid)
language plpgsql security definer set search_path = public as $$
declare v_other uuid;
begin
  if not public.is_signed_in() then raise exception 'sign in first' using errcode = '42501'; end if;
  select user_id into v_other from friend_codes where code = upper(p_code) and char_length(p_code) = 6;
  if v_other is null then return query select 'bad'::text, null::uuid; return; end if;
  if v_other = auth.uid() then return query select 'self'::text, v_other; return; end if;
  if public.is_friend(v_other) then return query select 'already'::text, v_other; return; end if;
  perform private.make_friends(auth.uid(), v_other);
  return query select 'friends'::text, v_other;
end $$;
revoke execute on function public.add_friend_by_code(text) from public, anon;
grant execute on function public.add_friend_by_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Members of a group you're in (the Members sheet for everyone; admins still use group_members(),
-- which adds emails). Names, photos, roles and join dates only.
-- ---------------------------------------------------------------------------

create function public.group_people(p_group uuid)
returns table (user_id uuid, name text, avatar_path text, role text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, coalesce(nullif(p.name, ''), 'No name yet'), p.avatar_path, m.role, m.joined_at
    from memberships m left join profiles p on p.id = m.user_id
   where m.group_id = p_group and public.is_member(p_group)
   order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, lower(coalesce(p.name, ''));
$$;
revoke execute on function public.group_people(uuid) from public, anon;
grant execute on function public.group_people(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Inviting friends to an event
-- ---------------------------------------------------------------------------

-- Returns { invited: [ids], going: [ids], already: [ids] }: people already going or already
-- invited are skipped quietly (no second notification)
create function public.invite_friends(p_spark uuid, p_people uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid(); s record; v_ok boolean; p uuid;
  v_invited uuid[] := '{}'; v_going uuid[] := '{}'; v_already uuid[] := '{}';
  v_name text;
begin
  if not public.is_signed_in() then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_people is null or cardinality(p_people) = 0 then return jsonb_build_object('invited', '[]'::jsonb, 'going', '[]'::jsonb, 'already', '[]'::jsonb); end if;
  if cardinality(p_people) > 30 then raise exception 'too many at once' using errcode = '22023'; end if;
  select id, text, lead_id, group_id, planned, guest_invites, cancelled_at, day_date, day_time, spot into s from sparks where id = p_spark;
  if s.id is null or not public.can_see_spark(p_spark) then raise exception 'no such event' using errcode = '22023'; end if;
  if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '22023'; end if;
  v_ok := s.lead_id = v_me
       or public.is_admin(s.group_id)
       or (s.guest_invites and exists (select 1 from rsvps r where r.spark_id = p_spark and r.user_id = v_me and r.status = 'going'));
  if not v_ok then raise exception 'the lead hasn''t turned on guest invites' using errcode = '42501'; end if;
  foreach p in array coalesce((select array_agg(distinct x) from unnest(p_people) x where x is not null), '{}') loop
    if p = v_me or not public.is_friend(p) then continue; end if;
    if p = s.lead_id or exists (select 1 from rsvps r where r.spark_id = p_spark and r.user_id = p and r.status = 'going') then
      v_going := v_going || p;
    elsif exists (select 1 from event_invites i where i.spark_id = p_spark and i.user_id = p) then
      v_already := v_already || p;
    else
      insert into event_invites (spark_id, user_id, invited_by) values (p_spark, p, v_me);
      insert into link_access (user_id, spark_id) values (p, p_spark) on conflict do nothing;
      v_invited := v_invited || p;
    end if;
  end loop;
  if cardinality(v_invited) > 0 then
    v_name := private.person_name(v_me, p_spark);
    perform private.push_send(v_invited, 'friends', v_name || ' invited you to ' || s.text,
      private.when_text(s.day_date, s.day_time, s.spot) || '. RSVP in Spark Hub.', '/#/idea/' || s.id, 'fi:' || s.id);
  end if;
  return jsonb_build_object('invited', to_jsonb(v_invited), 'going', to_jsonb(v_going), 'already', to_jsonb(v_already));
end $$;
revoke execute on function public.invite_friends(uuid, uuid[]) from public, anon;
grant execute on function public.invite_friends(uuid, uuid[]) to authenticated;
