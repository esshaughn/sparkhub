-- Co-hosts (social-science review, 2026-10-01: co-hosting was the lever that both spread hosting and increased
-- the number of events). The lead or a home-group admin adds co-hosts from the event's groups; a co-host can do
-- what the lead does (edit, plan, sign-ups, updates, guest list, check-ins, invites), except delete or cancel the
-- event and hand off the lead (set_wants_host stays lead-only). Co-hosts get the host notifications.
-- Function bodies below are the current definitions with the lead check widened to public.is_host().

-- 1. The table and the helper ---------------------------------------------------------------------------
create table public.cohosts (
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  added_by   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (spark_id, user_id)
);
alter table public.cohosts enable row level security;
create policy "cohosts follow the idea" on public.cohosts for select to authenticated using (public.can_see_spark(spark_id));
revoke all on table public.cohosts from anon, authenticated;
grant select on table public.cohosts to authenticated;   -- writes only through add_cohost() / remove_cohost()

create or replace function public.is_host(p_spark uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from sparks where id = p_spark and lead_id = auth.uid())
      or exists (select 1 from cohosts where spark_id = p_spark and user_id = auth.uid());
$$;
revoke execute on function public.is_host(uuid) from public, anon;
grant execute on function public.is_host(uuid) to authenticated;

-- The lead and co-hosts of an event
create or replace function private.host_ids(p_spark uuid)
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(u), '{}') from (
    select lead_id as u from sparks where id = p_spark and lead_id is not null
    union select user_id from cohosts where spark_id = p_spark) x;
$$;

-- Mood photos may sit in any host's folder (each host adds their own uploads). Public: the sparks policy calls it
create or replace function public.host_photo_re(p_spark uuid)
returns text language sql stable security definer set search_path = public as $$
  select '^(' || array_to_string(private.host_ids(p_spark), '|') || ')/[0-9a-f-]{36}\.jpg$';
$$;
revoke execute on function public.host_photo_re(uuid) from public, anon;
grant execute on function public.host_photo_re(uuid) to authenticated;

-- 2. Adding and removing co-hosts ------------------------------------------------------------------------
create or replace function public.add_cohost(p_spark uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_name text;
begin
  select id, text, lead_id, group_id, cancelled_at into s from sparks where id = p_spark;
  if s.id is null or not (public.is_host(p_spark) or public.is_admin(s.group_id)) then
    raise exception 'only a host can add co-hosts' using errcode = '42501';
  end if;
  if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '22023'; end if;
  if p_user is null or p_user = s.lead_id then raise exception 'they already lead it' using errcode = '22023'; end if;
  -- An account (not a guest) in one of the event's groups
  if not exists (select 1 from auth.users u where u.id = p_user and not coalesce(u.is_anonymous, false))
     or not exists (select 1 from memberships m where m.user_id = p_user
                     and (m.group_id = s.group_id or m.group_id in (select g.group_id from spark_groups g where g.spark_id = p_spark))) then
    raise exception 'co-hosts come from the event''s groups' using errcode = '22023';
  end if;
  if (select count(*) from cohosts where spark_id = p_spark) >= 5 then raise exception 'up to 5 co-hosts' using errcode = '22023'; end if;
  insert into cohosts (spark_id, user_id, added_by) values (p_spark, p_user, auth.uid()) on conflict do nothing;
  if found then
    v_name := private.person_name(auth.uid(), p_spark);
    insert into notes (user_id, body, created_by)
      values (p_user, left(v_name || ' made you a co-host of ' || left(s.text, 120) || '.', 320), auth.uid());
  end if;
end $$;

-- The lead or an admin removes a co-host; a co-host can step down
create or replace function public.remove_cohost(p_spark uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select id, lead_id, group_id into s from sparks where id = p_spark;
  if s.id is null or not (p_user = auth.uid() or s.lead_id = auth.uid() or public.is_admin(s.group_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from cohosts where spark_id = p_spark and user_id = p_user;
end $$;

revoke execute on function public.add_cohost(uuid, uuid), public.remove_cohost(uuid, uuid) from public, anon;
grant  execute on function public.add_cohost(uuid, uuid), public.remove_cohost(uuid, uuid) to authenticated;

-- 3. Seeing an event: co-hosts see invite-only events like the lead ---------------------------------------
create or replace function public.can_see_spark_row(p_id uuid, p_group uuid, p_lead uuid, p_visibility text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from link_access l where l.spark_id = p_id and l.user_id = auth.uid())
      or exists (select 1 from cohosts c where c.spark_id = p_id and c.user_id = auth.uid())
      or exists (select 1 from memberships m
                  where m.user_id = auth.uid()
                    and (m.group_id = p_group
                         or m.group_id in (select g.group_id from spark_groups g where g.spark_id = p_id))
                    and (p_visibility = 'group' or p_lead = auth.uid() or public.is_admin(m.group_id)
                         or exists (select 1 from rsvps r where r.spark_id = p_id and r.user_id = auth.uid())));
$$;

-- 4. Policies: "the lead" becomes "a host" ----------------------------------------------------------------
drop policy "the lead edits their spark" on public.sparks;
create policy "a host edits the spark" on public.sparks for update to authenticated
  using (lead_id = auth.uid() or public.is_host(id))
  with check ((lead_id = auth.uid() or public.is_host(id)) and all_match(mood, public.host_photo_re(id)));

drop policy "the lead removes album photos" on public.album_photos;
create policy "a host removes album photos" on public.album_photos for delete to authenticated
  using (public.is_host(spark_id));

drop policy "take back your date, or the lead removes it" on public.date_options;
create policy "take back your date, or a host removes it" on public.date_options for delete to authenticated
  using (created_by = auth.uid() or public.is_host(spark_id));

drop policy "take back your spot, or the lead removes it" on public.spot_options;
create policy "take back your spot, or a host removes it" on public.spot_options for delete to authenticated
  using (created_by = auth.uid() or public.is_host(spark_id));

drop policy "you or the lead see guest contacts" on public.guest_contacts;
create policy "you or a host see guest contacts" on public.guest_contacts for select to authenticated
  using (user_id = auth.uid() or public.is_host(spark_id));

drop policy "only the lead sees their prep" on public.plan_prep;
drop policy "the lead updates their prep" on public.plan_prep;
drop policy "the lead writes their prep" on public.plan_prep;
create policy "hosts see the prep" on public.plan_prep for select to authenticated using (public.is_host(spark_id));
create policy "hosts update the prep" on public.plan_prep for update to authenticated using (public.is_host(spark_id));
create policy "hosts write the prep" on public.plan_prep for insert to authenticated with check (public.is_host(spark_id));

drop policy "the lead posts updates" on public.plan_updates;
create policy "a host posts updates" on public.plan_updates for insert to authenticated
  with check (created_by = auth.uid() and public.is_host(spark_id));

drop policy "add a sign-up" on public.signup_items;
create policy "add a sign-up" on public.signup_items for insert to authenticated
  with check (created_by = auth.uid() and public.can_see_spark(spark_id)
              and (public.is_host(spark_id)
                   or (need is null and "time" is null and end_time is null and descr is null and shift_of is null))
              and (shift_of is null or exists (select 1 from signup_items j
                                                where j.id = signup_items.shift_of and j.spark_id = signup_items.spark_id and j.shift_of is null)));

drop policy "the lead edits sign-ups" on public.signup_items;
create policy "a host edits sign-ups" on public.signup_items for update to authenticated
  using (public.is_host(spark_id)) with check (public.is_host(spark_id));

drop policy "the lead or its author removes a sign-up" on public.signup_items;
create policy "a host or its author removes a sign-up" on public.signup_items for delete to authenticated
  using (created_by = auth.uid() or public.is_host(spark_id));

drop policy "the lead posts to their groups" on public.spark_groups;
create policy "a host posts to their groups" on public.spark_groups for insert to authenticated
  with check (public.is_host(spark_id)
              and exists (select 1 from sparks s where s.id = spark_groups.spark_id and s.group_id <> spark_groups.group_id)
              and exists (select 1 from memberships m where m.group_id = spark_groups.group_id and m.user_id = auth.uid()));

drop policy "the lead takes a group off" on public.spark_groups;
create policy "a host takes a group off" on public.spark_groups for delete to authenticated
  using (public.is_host(spark_id));

-- Co-hosts' profiles are readable like the lead's
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
  or exists (select 1 from reactions x where x.user_id = profiles.id and can_see_spark(x.spark_id)));

-- 5. Functions: the same bodies with the host check widened ------------------------------------------------
create or replace function public.add_offer(p_spark uuid, p_kind text, p_body text, p_who text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_status text := 'accepted';
begin
  if not public.is_signed_in() then raise exception 'sign in first' using errcode = '42501'; end if;
  if not public.can_see_spark(p_spark) then raise exception 'no such spark'; end if;
  if p_kind in ('spot', 'day') and not public.is_host(p_spark) then v_status := 'pending'; end if;
  if p_kind = 'day' and p_body !~ '^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$' then raise exception 'a date looks like 2026-10-12T07:00'; end if;

  insert into offers (spark_id, user_id, who, kind, body, status)
  values (p_spark, auth.uid(), left(trim(p_who), 40), p_kind, left(trim(p_body), 300), v_status);

  if v_status = 'accepted' and p_kind = 'spot' then update sparks set spot = left(trim(p_body), 80) where id = p_spark; end if;
  if v_status = 'accepted' and p_kind = 'day'  then perform public.apply_day(p_spark, p_body); end if;
  return v_status;
end $$;

create or replace function public.make_plan(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_host(p_spark) then
    raise exception 'only a host can make it a plan' using errcode = '42501';
  end if;
  if exists (select 1 from sparks where id = p_spark and day_date is null) then
    raise exception 'pick a date first' using errcode = '23514';
  end if;
  update sparks set planned = true where id = p_spark and not planned;
  insert into rsvps (spark_id, user_id, status)
  select i.spark_id, i.user_id, 'going' from interests i
   where i.spark_id = p_spark and not exists (select 1 from cohosts c where c.spark_id = p_spark and c.user_id = i.user_id)
  on conflict (spark_id, user_id) do nothing;
end $$;

create or replace function public.clear_plan(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_who text;
begin
  select id, text, lead_id, planned into s from sparks where id = p_spark;
  if s.id is null or not public.is_host(p_spark) then
    raise exception 'only a host can clear the date' using errcode = '42501';
  end if;
  if s.planned then
    select coalesce(nullif(p.name, ''), 'The lead') into v_who from profiles p where p.id = auth.uid();
    insert into notes (user_id, body, created_by)
      select u, left(left(s.text, 120) || ' is off the calendar for now. ' || coalesce(v_who, 'The lead') || ' turned it back into an idea.', 320), auth.uid()
        from (select r.user_id as u from rsvps r where r.spark_id = p_spark and r.status = 'going'
              union select unnest(private.host_ids(p_spark))) x
       where u <> auth.uid();
  end if;
  insert into interests (spark_id, user_id)
  select spark_id, user_id from rsvps where spark_id = p_spark and status = 'going'
  on conflict do nothing;
  delete from rsvps where spark_id = p_spark;
  update sparks set planned = false, day_date = null, day_time = null, day_end = null, day = null where id = p_spark;
end $$;

-- Cancel and delete stay with the lead and admins; the other hosts now hear about it
create or replace function public.cancel_event(p_spark uuid, p_reason text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare s record; v_who text; v_body text; v_reason text := left(nullif(btrim(p_reason), ''), 160); n integer := 0;
begin
  select id, text, lead_id, group_id, planned, cancelled_at into s from sparks where id = p_spark;
  if s.id is null then raise exception 'not found'; end if;
  if s.lead_id is distinct from auth.uid() and not public.is_admin(s.group_id) then raise exception 'not allowed'; end if;
  if s.cancelled_at is not null then return 0; end if;
  update sparks set cancelled_at = now(), cancel_reason = v_reason where id = p_spark;
  select coalesce(nullif(split_part(trim(p.name), ' ', 1), ''), 'The lead') into v_who from profiles p where p.id = auth.uid();
  v_body := left(s.text, 120) || ' is cancelled. ' ||
    case when v_reason is null then coalesce(v_who, 'The lead') || ' called it off.' else coalesce(v_who, 'The lead') || ': “' || v_reason || '”' end;
  insert into notes (user_id, body, created_by)
    select u, left(v_body, 320), auth.uid()
      from (select r.user_id as u from rsvps r where r.spark_id = p_spark and r.status in ('going', 'maybe')
            union select c.user_id from signup_claims c join signup_items i on i.id = c.item_id where i.spark_id = p_spark
            union select x.user_id from interests x where x.spark_id = p_spark and not s.planned
            union select unnest(private.host_ids(p_spark))) people
     where u <> auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.delete_event(p_spark uuid, p_quiet boolean default false, p_reason text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare s record; v_who text; v_body text; n integer := 0;
begin
  select id, text, lead_id, group_id, planned into s from sparks where id = p_spark;
  if s.id is null then raise exception 'not found'; end if;
  if s.lead_id is distinct from auth.uid() and not public.is_admin(s.group_id) then
    raise exception 'not allowed';
  end if;
  if not coalesce(p_quiet, false) then
    select coalesce(nullif(split_part(trim(p.name), ' ', 1), ''), 'The lead') into v_who from profiles p where p.id = auth.uid();
    v_body := left(s.text, 120) || ' is cancelled. ' ||
      case when nullif(btrim(p_reason), '') is null then coalesce(v_who, 'The lead') || ' called it off.'
           else coalesce(v_who, 'The lead') || ': “' || left(btrim(p_reason), 160) || '”' end;
    insert into notes (user_id, body, created_by)
      select u, left(v_body, 320), auth.uid()
        from (select r.user_id as u from rsvps r where r.spark_id = p_spark and r.status in ('going', 'maybe')
              union select c.user_id from signup_claims c join signup_items i on i.id = c.item_id where i.spark_id = p_spark
              union select x.user_id from interests x where x.spark_id = p_spark and not s.planned
              union select unnest(private.host_ids(p_spark))) people
       where u <> auth.uid();
    get diagnostics n = row_count;
  end if;
  delete from sparks where id = p_spark;
  return n;
end $$;

create or replace function public.mark_attended(p_spark uuid, p_user uuid, p_came boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select id, lead_id, group_id, planned, day_date into s from sparks where id = p_spark;
  if s.id is null or not (public.is_host(p_spark) or public.is_admin(s.group_id)) then
    raise exception 'only the host can check people in' using errcode = '42501';
  end if;
  if not s.planned or s.day_date is null or s.day_date > (now() at time zone 'America/Chicago')::date then
    raise exception 'you can check people in once the day comes' using errcode = '23514';
  end if;
  update rsvps set attended = p_came where spark_id = p_spark and user_id = p_user;
  if not found then raise exception 'they didn''t RSVP' using errcode = '23514'; end if;
end $$;

create or replace function public.remove_signup(p_item uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare it record; v_title text; n integer := 0;
begin
  select id, spark_id, item, created_by into it from signup_items where id = p_item;
  if it.id is null then raise exception 'not found'; end if;
  select text into v_title from sparks where id = it.spark_id;
  if it.created_by is distinct from auth.uid() and not public.is_host(it.spark_id) then
    raise exception 'not allowed';
  end if;
  insert into notes (user_id, body, created_by)
    select distinct c.user_id, left('“' || left(it.item, 80) || '” is off the list for ' || left(v_title, 120) || '.', 320), auth.uid()
      from signup_claims c join signup_items i on i.id = c.item_id
     where (i.id = p_item or i.shift_of = p_item) and c.user_id <> auth.uid();
  get diagnostics n = row_count;
  delete from signup_items where id = p_item;
  return n;
end $$;

create or replace function public.resolve_offer(p_offer uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare o offers%rowtype;
begin
  select * into o from offers where id = p_offer for update;
  if not found or o.status <> 'pending' then raise exception 'that offer is no longer waiting'; end if;
  if not public.is_host(o.spark_id) then
    raise exception 'only a host can decide';
  end if;
  if p_accept then
    update offers set status = 'accepted' where id = p_offer;
    if o.kind = 'spot' then update sparks set spot = left(o.body, 80) where id = o.spark_id; end if;
    if o.kind = 'day'  then perform public.apply_day(o.spark_id, o.body); end if;
  else
    update offers set status = 'declined' where id = p_offer;
  end if;
end $$;

create or replace function public.set_home_group(p_spark uuid, p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_old uuid;
begin
  select group_id into v_old from sparks where id = p_spark and public.is_host(p_spark);
  if v_old is null then raise exception 'not allowed'; end if;
  if v_old = p_group then return; end if;
  if not exists (select 1 from spark_groups where spark_id = p_spark and group_id = p_group)
     or not exists (select 1 from memberships where group_id = p_group and user_id = auth.uid()) then
    raise exception 'not allowed';
  end if;
  delete from spark_groups where spark_id = p_spark and group_id = p_group;
  update sparks set group_id = p_group where id = p_spark;
  insert into spark_groups (spark_id, group_id) values (p_spark, v_old) on conflict do nothing;
end $$;

create or replace function public.set_idea_cover(p_spark uuid, p_photo text, p_pos jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not public.is_host(p_spark) then
    raise exception 'only a host can change the cover' using errcode = '42501';
  end if;
  if p_photo !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$') then
    raise exception 'photo must be your own upload' using errcode = '22023';
  end if;
  select photos[1] into v_old from sparks where id = p_spark;
  update sparks
     set photos = case when cardinality(photos) = 0 then array[p_photo] else array[p_photo] || photos[2:] end,
         cover_pos = p_pos
   where id = p_spark;
  return v_old;
end $$;

create or replace function public.invite_friends(p_spark uuid, p_people uuid[])
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
  v_ok := public.is_host(p_spark)
       or public.is_admin(s.group_id)
       or (s.guest_invites and exists (select 1 from rsvps r where r.spark_id = p_spark and r.user_id = v_me and r.status = 'going'));
  if not v_ok then raise exception 'the lead hasn''t turned on guest invites' using errcode = '42501'; end if;
  foreach p in array coalesce((select array_agg(distinct x) from unnest(p_people) x where x is not null), '{}') loop
    if p = v_me or not public.is_friend(p) then continue; end if;
    if p = any(private.host_ids(p_spark)) or exists (select 1 from rsvps r where r.spark_id = p_spark and r.user_id = p and r.status = 'going') then
      v_going := v_going || p;
    elsif exists (select 1 from event_invites i where i.spark_id = p_spark and i.user_id = p) then
      v_already := v_already || p;
    else
      insert into event_invites (spark_id, user_id, invited_by) values (p_spark, p, v_me);
      insert into link_access (user_id, spark_id, via) values (p, p_spark, 'invite')
        on conflict (user_id, spark_id) do update set via = 'invite';
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

-- A co-host can take the lead of an idea looking for a host (and stops being a co-host)
create or replace function public.take_the_lead(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_name text;
begin
  select id, text, lead_id, wants_host, planned, cancelled_at into s from sparks where id = p_spark for update;
  if s.id is null or not public.can_see_spark(p_spark) or not public.is_signed_in() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not s.wants_host or s.planned or s.cancelled_at is not null or s.lead_id = auth.uid() then
    raise exception 'this idea isn''t looking for a host' using errcode = '23514';
  end if;
  select coalesce(nullif(p.name, ''), 'Someone') into v_name from profiles p where p.id = auth.uid();
  delete from cohosts where spark_id = p_spark and user_id = auth.uid();
  update sparks set lead_id = auth.uid(), lead_name = coalesce(v_name, 'Someone'), wants_host = false where id = p_spark;
  if s.lead_id is not null then
    insert into interests (spark_id, user_id) values (p_spark, s.lead_id) on conflict (spark_id, user_id) do nothing;
    insert into notes (user_id, body, created_by)
      values (s.lead_id, left(coalesce(v_name, 'Someone') || ' is hosting ' || left(s.text, 120) || '. Thanks for floating it!', 320), auth.uid());
  end if;
  delete from interests where spark_id = p_spark and user_id = auth.uid();   -- the new lead isn't "interested" in their own idea
end $$;

-- 6. Notifications: every host hears what the lead hears; hosts aren't told about their own event -------------
create or replace function private.push_host() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; who uuid; msg text; tag text; hosts uuid[];
begin
  if auth.uid() is null then return null; end if;
  if tg_table_name = 'signup_claims' then
    select sp.id, sp.text, sp.lead_id, i.item into s from signup_items i join sparks sp on sp.id = i.spark_id where i.id = new.item_id;
  else
    select id, text, lead_id, null::text as item into s from sparks where id = new.spark_id;
  end if;
  if tg_table_name = 'rsvps' then
    if tg_op = 'UPDATE' and new.status = old.status then return null; end if;
    if new.user_id is distinct from auth.uid() then return null; end if;   -- moved by make_plan, not a reply
    -- Taking a job marks you Going: the sign-up's own notification covers it
    if new.status = 'going' and exists (select 1 from signup_claims c join signup_items i on i.id = c.item_id
                                         where i.spark_id = new.spark_id and c.user_id = new.user_id
                                           and c.created_at > now() - interval '2 minutes') then return null; end if;
    who := new.user_id;
    msg := private.person_name(who, s.id) || case new.status when 'going' then ' is going to ' when 'maybe' then ' might come to ' else ' can’t make it to ' end || s.text;
    tag := 'rv:' || s.id || ':' || who;
  elsif tg_table_name = 'interests' then
    if new.user_id is distinct from auth.uid() then return null; end if;   -- moved by clear_plan, not interest
    who := new.user_id;
    msg := private.person_name(who, s.id) || ' is interested in ' || s.text;
    tag := 'i:' || s.id || ':' || who;
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

create or replace function private.push_made_plan() returns trigger language plpgsql security definer set search_path = public as $$
declare g text; users uuid[];
begin
  if auth.uid() is null or new.visibility <> 'group' then return null; end if;
  select name into g from groups where id = new.group_id;
  select array_agg(distinct m.user_id) into users from memberships m
   where (m.group_id = new.group_id or m.group_id in (select group_id from spark_groups where spark_id = new.id))
     and m.user_id <> all(private.host_ids(new.id));
  perform private.push_send(users, 'newevents', 'It’s a plan in ' || coalesce(g, 'your group') || ': ' || new.text,
    private.when_text(new.day_date, new.day_time, new.spot) || '. RSVP in Spark Hub.', '/#/idea/' || new.id, 'e:' || new.id);
  return null;
end $$;

create or replace function private.push_daily() returns void language plpgsql security definer set search_path = public, extensions as $$
declare s record; users uuid[]; today date := (now() at time zone 'America/Chicago')::date;
begin
  for s in select id, text, day_date, day_time, spot, lead_id from sparks
            where planned and not demo and not test and auto_remind and cancelled_at is null and day_date in (today, today + 1) loop
    select array_agg(distinct u) into users from (
      select user_id as u from rsvps where spark_id = s.id and status in ('going', 'maybe')
      union select c.user_id from signup_claims c join signup_items i on i.id = c.item_id where i.spark_id = s.id) x
     where u <> all(private.host_ids(s.id));
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

-- Who a host's update reaches: co-hosts can see invite-only events, like the lead
create or replace function private.update_recipients(p_spark uuid, p_audience text, p_by uuid)
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct u) filter (where u is not null and u is distinct from p_by), '{}')
    from (
      -- Not replied yet: members who can see the event
      select m.user_id as u
        from sparks s
        join memberships m on m.group_id = s.group_id
                           or m.group_id in (select g.group_id from spark_groups g where g.spark_id = s.id)
       where s.id = p_spark and p_audience = 'noreply'
         and (s.visibility = 'group' or m.user_id = s.lead_id or m.role in ('owner', 'admin')
              or exists (select 1 from cohosts c where c.spark_id = s.id and c.user_id = m.user_id)
              or exists (select 1 from link_access l where l.spark_id = s.id and l.user_id = m.user_id))
         and not exists (select 1 from rsvps r where r.spark_id = s.id and r.user_id = m.user_id)
      union
      select r.user_id from rsvps r
       where r.spark_id = p_spark and p_audience in ('going', 'maybe') and r.status = p_audience
      union
      select r.user_id from rsvps r where r.spark_id = p_spark and p_audience = 'all'
      union
      select c.user_id from signup_claims c join signup_items i on i.id = c.item_id
       where i.spark_id = p_spark and p_audience = 'all'
    ) x;
$$;
