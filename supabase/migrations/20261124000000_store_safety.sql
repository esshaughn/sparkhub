-- Store safety (Design v8-18 item 1s, owner brief 2026-10-10): what app-store review asks of an app with
-- user content. Reports and a reports inbox, blocking people, deleting your account with a code from your
-- email, and a guest taking their own sign-ups back off an event.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Reports
-- ---------------------------------------------------------------------------------------------------------
-- One row per report. No client access to the table: people report through report_content(), take it back
-- with withdraw_report(), read their own with my_safety(), and the people who look at reports read and act
-- through list_reports() / resolve_report().
--   kind    comment | event | photo | profile
--   target  the comment id, the event id, the photo's storage path, or the person's id (text: a photo is a path)
--   group_id  whose admins look at it (the event's home group); null = only the app owner (demo_admins)
--   about_lead  the person reported runs that group, so its admins don't see it: it goes straight to the app owner
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter    uuid references auth.users (id) on delete set null,
  kind        text not null check (kind in ('comment', 'event', 'photo', 'profile')),
  target      text not null check (char_length(target) between 1 and 120),
  spark_id    uuid,                                  -- no foreign key: the report outlives what it's about
  subject     uuid references auth.users (id) on delete set null,   -- who posted it (or the person reported)
  group_id    uuid references public.groups (id) on delete set null,
  about_lead  boolean not null default false,
  excerpt     text check (char_length(excerpt) <= 200),             -- what it said when reported (comment, title)
  reason      text not null check (reason in ('Spam', 'Harassment', 'Inappropriate', 'Unsafe', 'Something else')),
  note        text check (char_length(note) <= 280),
  status      text not null default 'open' check (status in ('open', 'dismissed', 'removed', 'member_removed', 'blocked')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);
create index reports_open on public.reports (group_id) where status = 'open';
create unique index reports_once on public.reports (reporter, kind, target) where status = 'open';
alter table public.reports enable row level security;
revoke all on table public.reports from anon, authenticated;

create function private.is_app_owner() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from demo_admins where user_id = auth.uid());
$$;
revoke all on function private.is_app_owner() from public, anon, authenticated;

-- Report something you can see. Returns the report's id. Reporting the same thing twice while it's open
-- keeps the first report (and returns it).
create function public.report_content(p_kind text, p_target text, p_reason text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid(); v_spark uuid; v_subject uuid; v_group uuid; v_excerpt text; v_id uuid; v_uid uuid;
begin
  if not public.is_signed_in() then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_reason is null or p_reason not in ('Spam', 'Harassment', 'Inappropriate', 'Unsafe', 'Something else') then
    raise exception 'pick a reason' using errcode = '22023';
  end if;
  if p_kind = 'comment' then
    select c.spark_id, c.created_by, left(c.body, 200) into v_spark, v_subject, v_excerpt
      from event_comments c where c.id::text = p_target;
    if v_spark is null or not public.can_see_spark(v_spark) then raise exception 'no such comment' using errcode = '22023'; end if;
  elsif p_kind = 'event' then
    select s.id, s.lead_id, left(s.text, 200) into v_spark, v_subject, v_excerpt from sparks s where s.id::text = p_target;
    if v_spark is null or not public.can_see_spark(v_spark) then raise exception 'no such event' using errcode = '22023'; end if;
  elsif p_kind = 'photo' then
    if p_target !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' then raise exception 'no such photo' using errcode = '22023'; end if;
    v_subject := split_part(p_target, '/', 1)::uuid;   -- photo paths start with the uploader's id
    select a.spark_id into v_spark from album_photos a where a.path = p_target limit 1;
    if v_spark is null then select s.id into v_spark from sparks s where p_target = any (s.photos) limit 1; end if;
    if v_spark is not null and not public.can_see_spark(v_spark) then raise exception 'no such photo' using errcode = '22023'; end if;
    if v_spark is null and not exists (select 1 from profiles p where p.avatar_path = p_target) then
      raise exception 'no such photo' using errcode = '22023';
    end if;
    if not exists (select 1 from auth.users u where u.id = v_subject) then v_subject := null; end if;
  elsif p_kind = 'profile' then
    begin v_uid := p_target::uuid; exception when others then v_uid := null; end;
    if v_uid is null or not exists (select 1 from profiles p where p.id = v_uid) then raise exception 'no such person' using errcode = '22023'; end if;
    v_subject := v_uid;
    select left(p.name, 200) into v_excerpt from profiles p where p.id = v_uid;
  else
    raise exception 'can''t report that' using errcode = '22023';
  end if;
  if v_subject = v_me then raise exception 'that''s yours' using errcode = '22023'; end if;
  select id into v_id from reports where reporter = v_me and kind = p_kind and target = p_target and status = 'open';
  if v_id is not null then return v_id; end if;
  if not exists (select 1 from private.rate_exempt where user_id = v_me) and not private.rate_ok(v_me, 'report', 20, interval '1 hour') then
    raise exception 'You''re going a bit fast. Try again in a bit.' using errcode = 'PT429';
  end if;
  if v_spark is not null then select s.group_id into v_group from sparks s where s.id = v_spark; end if;
  insert into reports (reporter, kind, target, spark_id, subject, group_id, about_lead, excerpt, reason, note)
  values (v_me, p_kind, p_target, v_spark, v_subject, v_group,
          v_group is not null and v_subject is not null and exists (select 1 from memberships m where m.group_id = v_group and m.user_id = v_subject and m.role in ('owner', 'admin')),
          v_excerpt, p_reason, nullif(left(btrim(coalesce(p_note, '')), 280), ''))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.report_content(text, text, text, text) from public, anon;
grant execute on function public.report_content(text, text, text, text) to authenticated;

-- Undo (You reported this · Undo): only your own, only while it's open
create function public.withdraw_report(p_kind text, p_target text)
returns void language sql security definer set search_path = public as $$
  delete from reports where reporter = auth.uid() and kind = p_kind and target = p_target and status = 'open';
$$;
revoke all on function public.withdraw_report(text, text) from public, anon;
grant execute on function public.withdraw_report(text, text) to authenticated;

-- Open reports to look at: one group's (its owners and admins; never reports about the group's own admins),
-- or every group's (p_group null: the app owner only). The reporter's name goes to the app owner only.
create function public.list_reports(p_group uuid default null)
returns table (id uuid, kind text, target text, spark_id uuid, title text, excerpt text, reason text, note text,
               reporter_name text, subject uuid, subject_name text, subject_member boolean, group_id uuid, group_name text,
               about_lead boolean, overdue boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_owner boolean := private.is_app_owner();
begin
  if p_group is null and not v_owner then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_group is not null and not public.is_admin(p_group) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select r.id, r.kind, r.target, r.spark_id, s.text, r.excerpt, r.reason, r.note,
         case when v_owner then coalesce(nullif(rp.name, ''), 'Someone') end,
         r.subject, coalesce(nullif(sp.name, ''), 'Someone'),
         exists (select 1 from memberships m where m.group_id = r.group_id and m.user_id = r.subject),
         r.group_id, g.name, r.about_lead, r.created_at < now() - interval '3 days', r.created_at
    from reports r
    left join sparks s on s.id = r.spark_id
    left join profiles rp on rp.id = r.reporter
    left join profiles sp on sp.id = r.subject
    left join groups g on g.id = r.group_id
   where r.status = 'open'
     and (case when p_group is null then true else r.group_id = p_group and not r.about_lead end)
   order by r.created_at;
end $$;
revoke all on function public.list_reports(uuid) from public, anon;
grant execute on function public.list_reports(uuid) to authenticated;

-- Act on a report: dismiss | remove (the content) | remove_member | block (remove from the group and block them
-- from rejoining). Group admins act on their group's reports; the app owner on any. Every open report about the
-- same thing closes with it. The person who posted removed content gets a note.
create function public.resolve_report(p_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_owner boolean := private.is_app_owner(); v_status text; v_role text; v_title text;
begin
  select * into r from reports where id = p_id and status = 'open' for update;
  if r.id is null then raise exception 'already handled' using errcode = '22023'; end if;
  if not (v_owner or (r.group_id is not null and not r.about_lead and public.is_admin(r.group_id))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_status := case p_action when 'dismiss' then 'dismissed' when 'remove' then 'removed'
                            when 'remove_member' then 'member_removed' when 'block' then 'blocked' end;
  if v_status is null then raise exception 'unknown action' using errcode = '22023'; end if;
  if p_action = 'remove' then
    select left(text, 120) into v_title from sparks where id = r.spark_id;
    if r.kind = 'comment' then
      delete from event_comments where id::text = r.target;
    elsif r.kind = 'event' then
      perform private.forget_event(r.spark_id, true);
      delete from sparks where id = r.spark_id;
    elsif r.kind = 'photo' then
      delete from album_photos where path = r.target;
      update sparks set photos = array_remove(photos, r.target) where r.target = any (photos);
      update profiles set avatar_path = null where avatar_path = r.target;
    elsif r.kind = 'profile' then
      update profiles set avatar_path = null, bio = null where id = r.subject;
    end if;
    if r.subject is not null and r.subject <> auth.uid() then
      insert into notes (user_id, body, created_by) values (r.subject, left(
        case r.kind when 'comment' then 'Your comment' || coalesce(' on ' || v_title, '') || ' was removed after a report.'
                    when 'event' then coalesce(v_title, 'Your event') || ' was removed after a report.'
                    when 'photo' then 'A photo you added was removed after a report.'
                    else 'Your profile photo and About you were removed after a report.' end
        || ' See Settings → Community rules.', 320), auth.uid());
    end if;
  elsif p_action in ('remove_member', 'block') then
    if r.group_id is null or r.subject is null then raise exception 'not in a group' using errcode = '22023'; end if;
    select role into v_role from memberships where group_id = r.group_id and user_id = r.subject;
    if v_role is not null then
      if v_owner and not public.is_admin(r.group_id) then
        if v_role = 'owner' then raise exception 'they own the group' using errcode = '42501'; end if;
        delete from memberships where group_id = r.group_id and user_id = r.subject;
        perform private.drop_group_links(r.group_id, r.subject);
      else
        perform public.remove_member(r.group_id, r.subject, false);
      end if;
    end if;
    if p_action = 'block' then
      insert into group_bans (group_id, user_id, banned_by) values (r.group_id, r.subject, auth.uid()) on conflict do nothing;
    end if;
  end if;
  update reports set status = v_status, resolved_at = now(), resolved_by = auth.uid()
   where status = 'open' and (id = p_id or (kind = r.kind and target = r.target));
end $$;
revoke all on function public.resolve_report(uuid, text) from public, anon;
grant execute on function public.resolve_report(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Blocking people
-- ---------------------------------------------------------------------------------------------------------
-- You don't see what someone you blocked posts (the app folds their comments and hides their photos), they can't
-- send you friend requests (refused quietly: it looks sent), and you stop being friends. Only block_user() and
-- unblock_user() write; you read your own rows.
create table public.user_blocks (
  blocker    uuid not null references auth.users (id) on delete cascade,
  blocked    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index user_blocks_blocked on public.user_blocks (blocked);
alter table public.user_blocks enable row level security;
revoke all on table public.user_blocks from anon, authenticated;
grant select on table public.user_blocks to authenticated;
create policy "your own blocks" on public.user_blocks for select to authenticated using (blocker = auth.uid());

create function private.blocked_either(p_x uuid, p_y uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_blocks where (blocker = p_x and blocked = p_y) or (blocker = p_y and blocked = p_x));
$$;
revoke all on function private.blocked_either(uuid, uuid) from public, anon, authenticated;

create function public.block_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_signed_in() then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_user is null or p_user = auth.uid() or not exists (select 1 from auth.users where id = p_user) then
    raise exception 'not someone else' using errcode = '22023';
  end if;
  if (select count(*) from user_blocks where blocker = auth.uid()) >= 500 then raise exception 'too many' using errcode = '54000'; end if;
  insert into user_blocks (blocker, blocked) values (auth.uid(), p_user) on conflict do nothing;
  delete from friendships where user_a = least(auth.uid(), p_user) and user_b = greatest(auth.uid(), p_user);
  delete from friend_requests where (from_id = p_user and to_id = auth.uid()) or (from_id = auth.uid() and to_id = p_user and declined_at is null);
end $$;
revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

create function public.unblock_user(p_user uuid)
returns void language sql security definer set search_path = public as $$
  delete from user_blocks where blocker = auth.uid() and blocked = p_user;
$$;
revoke all on function public.unblock_user(uuid) from public, anon;
grant execute on function public.unblock_user(uuid) to authenticated;

-- A friend request or a friendship between two people where one blocked the other doesn't happen. Quietly: the
-- sender sees "Requested", like any request that's never answered.
create function private.no_blocked_friends() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'friend_requests' then
    if private.blocked_either(new.from_id, new.to_id) then return null; end if;
  else
    if private.blocked_either(new.user_a, new.user_b) then return null; end if;
  end if;
  return new;
end $$;
create trigger friend_requests_blocked before insert on public.friend_requests for each row execute function private.no_blocked_friends();
create trigger friendships_blocked before insert on public.friendships for each row execute function private.no_blocked_friends();

-- What the app needs to fold things for you: the people you blocked (with names and photos for Settings →
-- Blocked people, even if you no longer share a group) and what you've reported that's still open.
create function public.my_safety()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'blocks', coalesce((select jsonb_agg(jsonb_build_object('id', b.blocked, 'name', coalesce(nullif(p.name, ''), 'Someone'), 'avatar', p.avatar_path) order by b.created_at desc)
                          from user_blocks b left join profiles p on p.id = b.blocked where b.blocker = auth.uid()), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('kind', r.kind, 'target', r.target))
                           from reports r where r.reporter = auth.uid() and r.status = 'open'), '[]'::jsonb));
$$;
revoke all on function public.my_safety() from public, anon;
grant execute on function public.my_safety() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Guests take their sign-ups back off an event (Remove my sign-ups): the reply, any spots or jobs, a place
--    on a waitlist, interest, and their name and contact. Anyone can do it for themselves.
-- ---------------------------------------------------------------------------------------------------------
create function public.remove_my_signups(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from signup_claims c using signup_items i where i.id = c.item_id and i.spark_id = p_spark and c.user_id = v_me;
  delete from signup_waits w using signup_items i where i.id = w.item_id and i.spark_id = p_spark and w.user_id = v_me;
  delete from rsvps where spark_id = p_spark and user_id = v_me;
  delete from interests where spark_id = p_spark and user_id = v_me;
  delete from guest_contacts where spark_id = p_spark and user_id = v_me;
end $$;
revoke all on function public.remove_my_signups(uuid) from public, anon;
grant execute on function public.remove_my_signups(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Delete your account (Design v8-18): what happens → each group you own alone goes to someone you pick, or
--    is deleted → each event you lead is passed on or cancelled → a 6-digit code from your email → done.
-- ---------------------------------------------------------------------------------------------------------
-- What there is to decide: groups you're the only owner of that have other people in them (with those people),
-- and the events you lead that haven't happened yet (ideas too).
create function public.delete_account_plan()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'groups', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'people',
        (select jsonb_agg(jsonb_build_object('id', o.user_id, 'name', coalesce(nullif(p.name, ''), 'No name yet'), 'role', o.role)
                          order by case o.role when 'admin' then 0 else 1 end, o.joined_at)
           from memberships o left join profiles p on p.id = o.user_id where o.group_id = g.id and o.user_id <> auth.uid())) order by g.name)
      from groups g join memberships m on m.group_id = g.id and m.user_id = auth.uid() and m.role = 'owner'
     where not exists (select 1 from memberships o where o.group_id = g.id and o.role = 'owner' and o.user_id <> auth.uid())
       and exists (select 1 from memberships o where o.group_id = g.id and o.user_id <> auth.uid())), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'text', s.text, 'planned', s.planned, 'day', s.day_date,
        'count', case when s.planned then (select count(*) from rsvps r where r.spark_id = s.id and r.status = 'going' and r.user_id <> auth.uid())
                      else (select count(*) from interests x where x.spark_id = s.id) end,
        'colead', exists (select 1 from cohosts c where c.spark_id = s.id)) order by s.day_date nulls last, s.created_at)
      from sparks s
     where s.lead_id = auth.uid() and s.cancelled_at is null
       and (not s.planned or s.day_date is null
            or private.event_last_day(s.day_date, s.schedule) >= (now() at time zone 'America/Chicago')::date)), '[]'::jsonb))
  where public.is_signed_in();
$$;
revoke all on function public.delete_account_plan() from public, anon;
grant execute on function public.delete_account_plan() to authenticated;

-- p_groups: [{"id": group, "to": person}] or [{"id": group, "delete": true}] for every group delete_account_plan()
-- lists; p_events: [{"id": event, "act": "pass" | "cancel"}] (an event left out is passed on). Pass on: the earliest
-- co-lead takes over, or else it becomes an idea that's looking for a lead (step_back). Cancel tells everyone going.
-- Past events go to a co-lead, or are deleted quietly. Needs a sign-in with an email code in the last 15 minutes
-- (the 6-digit code step), so a session left open somewhere can't delete the account on its own.
drop function public.delete_my_account();
create function public.delete_my_account(p_groups jsonb, p_events jsonb)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid := auth.uid(); g record; e record; v_pick jsonb; v_to uuid; v_act text; v_fresh boolean;
begin
  if v_me is null or not public.is_signed_in() then raise exception 'sign in first' using errcode = '42501'; end if;
  if private.is_app_owner() then raise exception 'an owner account can''t be deleted here' using errcode = '42501'; end if;
  select exists (select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
                  where a ->> 'method' in ('otp', 'magiclink', 'email')
                    and (a ->> 'timestamp')::bigint > extract(epoch from now()) - 900) into v_fresh;
  if not coalesce(v_fresh, false) then raise exception 'enter the code from your email first' using errcode = '42501'; end if;
  if jsonb_typeof(coalesce(p_groups, '[]')) <> 'array' or jsonb_typeof(coalesce(p_events, '[]')) <> 'array' then
    raise exception 'bad request' using errcode = '22023';
  end if;
  -- Groups you own alone with others in them: hand each on, or delete it
  for g in select gr.id, gr.name from groups gr join memberships m on m.group_id = gr.id and m.user_id = v_me and m.role = 'owner'
            where not exists (select 1 from memberships o where o.group_id = gr.id and o.role = 'owner' and o.user_id <> v_me)
              and exists (select 1 from memberships o where o.group_id = gr.id and o.user_id <> v_me) loop
    select x into v_pick from jsonb_array_elements(coalesce(p_groups, '[]')) x where x ->> 'id' = g.id::text limit 1;
    if v_pick is null then raise exception 'choose who gets %', g.name using errcode = '23514'; end if;
    if coalesce((v_pick ->> 'delete')::boolean, false) then
      delete from groups where id = g.id;
    else
      begin v_to := (v_pick ->> 'to')::uuid; exception when others then v_to := null; end;
      if v_to is null or v_to = v_me or not exists (select 1 from memberships where group_id = g.id and user_id = v_to) then
        raise exception 'choose who gets %', g.name using errcode = '23514';
      end if;
      update memberships set role = 'owner' where group_id = g.id and user_id = v_to;
      insert into notes (user_id, body, created_by)
        values (v_to, left(private.person_name(v_me, null::uuid) || ' deleted their account and made you the owner of ' || g.name || '.', 320), v_me);
    end if;
  end loop;
  -- Groups with nobody else in them
  delete from groups gr
   where exists (select 1 from memberships m where m.group_id = gr.id and m.user_id = v_me and m.role = 'owner')
     and not exists (select 1 from memberships o where o.group_id = gr.id and o.user_id <> v_me);
  -- Events you lead
  for e in select s.id, s.planned, s.day_date, s.schedule from sparks s where s.lead_id = v_me and s.cancelled_at is null loop
    select x ->> 'act' into v_act from jsonb_array_elements(coalesce(p_events, '[]')) x where x ->> 'id' = e.id::text limit 1;
    if e.planned and e.day_date is not null and private.event_last_day(e.day_date, e.schedule) < (now() at time zone 'America/Chicago')::date then
      if exists (select 1 from cohosts where spark_id = e.id) then perform public.step_back(e.id);
      else perform private.forget_event(e.id, true); delete from sparks where id = e.id; end if;
    elsif v_act = 'cancel' then
      perform public.cancel_event(e.id, null);
    else
      perform public.step_back(e.id);
    end if;
  end loop;
  update sparks set created_by = lead_id where created_by = v_me and lead_id is distinct from v_me;
  delete from offers where user_id = v_me;
  delete from auth.users where id = v_me;
end $$;
revoke all on function public.delete_my_account(jsonb, jsonb) from public, anon;
grant execute on function public.delete_my_account(jsonb, jsonb) to authenticated;
