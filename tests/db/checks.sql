-- Rules the app relies on, checked as made-up people (run with tests/db/run.sh, never against TEST or live).
-- Each block raises an error, and the run stops, the moment something is allowed that shouldn't be.
\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- Helpers ----------------------------------------------------------------------------------------------
create schema t;
grant usage on schema t to authenticated, anon;
create table t.ids (name text primary key, id uuid not null);
grant select on t.ids to authenticated, anon;
create function t.id(p text) returns uuid language sql stable as $$ select id from t.ids where name = p $$;
-- A person: a signed-in (confirmed email) account, or an anonymous visitor
create function t.person(p_name text, p_anon boolean default false) returns uuid language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, is_anonymous, email_confirmed_at, created_at, raw_user_meta_data)
  values (v, case when p_anon then null else p_name || '@example.com' end, p_anon, case when p_anon then null else now() end, now() - interval '1 day', '{}');
  insert into t.ids values (p_name, v);
  return v;
end $$;
-- Act as someone (then `set role authenticated`, and `reset role` to go back to the superuser)
create function t.login(p_name text) returns void language plpgsql as $$
declare v uuid := t.id(p_name); a boolean;
begin
  select is_anonymous into a from auth.users where id = v;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated', 'is_anonymous', a)::text, false);
  perform set_config('request.jwt.claim.sub', v::text, false);
end $$;
-- Run a statement; refused = an error, or an UPDATE/DELETE that touched nothing
create function t.refused(p_sql text) returns boolean language plpgsql as $$
declare n int;
begin
  execute p_sql; get diagnostics n = row_count;
  return n = 0;
exception when others then return true;
end $$;
create function t.must_refuse(p_label text, p_sql text) returns void language plpgsql as $$
begin
  if not t.refused(p_sql) then raise exception 'ALLOWED, should be refused: %', p_label; end if;
  raise notice 'ok  refused: %', p_label;
end $$;
create function t.must_allow(p_label text, p_sql text) returns void language plpgsql as $$
declare n int;
begin
  execute p_sql; get diagnostics n = row_count;
  if n = 0 then raise exception 'touched nothing, should be allowed: %', p_label; end if;
  raise notice 'ok  allowed: %', p_label;
exception when raise_exception then raise;
          when others then raise exception 'REFUSED, should be allowed: % (%)', p_label, sqlerrm;
end $$;
-- Refused by a rate limit specifically (SQLSTATE PT429), not by some other rule
create function t.must_rate_limit(p_label text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ALLOWED, should hit the rate limit: %', p_label;
exception when sqlstate 'PT429' then raise notice 'ok  rate-limited: %', p_label;
end $$;
create function t.check(p_label text, p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FAILED: %', p_label; end if;
  raise notice 'ok  %', p_label;
end $$;
grant execute on all functions in schema t to authenticated, anon;

-- People and a group ---------------------------------------------------------------------------------
select t.person('host'), t.person('member'), t.person('admin'), t.person('linked'), t.person('replied'),
       t.person('outsider'), t.person('guest', true);
insert into groups (id, name, code, created_by) values (gen_random_uuid(), 'Check group', 'CHECK2', t.id('host'));
insert into t.ids select 'g', id from groups where code = 'CHECK2';
insert into memberships (group_id, user_id, role) values
  (t.id('g'), t.id('host'), 'owner'), (t.id('g'), t.id('member'), 'member'), (t.id('g'), t.id('admin'), 'admin'),
  (t.id('g'), t.id('linked'), 'member'), (t.id('g'), t.id('replied'), 'member');
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date)
values (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Invite-only plan', 'invite', true, current_date + 7);
insert into t.ids select 'invite_plan', id from sparks where text = 'Invite-only plan';
insert into link_access (user_id, spark_id) values (t.id('linked'), t.id('invite_plan'));
insert into rsvps (spark_id, user_id, status) values (t.id('invite_plan'), t.id('replied'), 'going');

-- Host updates go only to people who can see the event --------------------------------------------------
select t.check('update to "hasn''t replied" on an invite-only plan: the admin and the link holder only',
  (select array_agg(x order by x) from unnest(private.update_recipients(t.id('invite_plan'), 'noreply', t.id('host'))) x)
  = (select array_agg(x order by x) from unnest(array[t.id('admin'), t.id('linked')]) x));
update sparks set visibility = 'group' where id = t.id('invite_plan');
select t.check('update to "hasn''t replied" on a group plan: every member who hasn''t replied',
  (select array_agg(x order by x) from unnest(private.update_recipients(t.id('invite_plan'), 'noreply', t.id('host'))) x)
  = (select array_agg(x order by x) from unnest(array[t.id('member'), t.id('admin'), t.id('linked')]) x));
update sparks set visibility = 'invite' where id = t.id('invite_plan');
select t.check('update to everyone going: the one who replied',
  private.update_recipients(t.id('invite_plan'), 'going', t.id('host')) = array[t.id('replied')]);
-- Going and Maybe (20261104000000_event_updates.sql): a maybe gets it, a Can't doesn't
insert into rsvps (spark_id, user_id, status) values (t.id('invite_plan'), t.id('member'), 'maybe'), (t.id('invite_plan'), t.id('linked'), 'no');
select t.check('update to going and maybe: going and maybe, not Can''t',
  (select array_agg(x order by x) from unnest(private.update_recipients(t.id('invite_plan'), 'coming', t.id('host'))) x)
  = (select array_agg(x order by x) from unnest(array[t.id('replied'), t.id('member')]) x));
delete from rsvps where spark_id = t.id('invite_plan') and user_id in (t.id('member'), t.id('linked'));

-- Photo uploads: own folder only, accounts only, 50 a day --------------------------------------------
select t.login('member'); set role authenticated;
select t.must_refuse('upload into someone else''s folder',
  format('insert into storage.objects (bucket_id, name) values (''spark-photos'', %L)', t.id('host') || '/a.jpg'));
reset role;
select t.login('guest'); set role authenticated;
select t.must_refuse('a guest uploading a photo',
  format('insert into storage.objects (bucket_id, name) values (''spark-photos'', %L)', t.id('guest') || '/' || gen_random_uuid() || '.jpg'));
reset role;
select t.login('member'); set role authenticated;
do $$ begin
  for i in 1..50 loop
    insert into storage.objects (bucket_id, name) values ('spark-photos', t.id('member') || '/' || gen_random_uuid() || '.jpg');
  end loop;
end $$;
select t.must_refuse('a member''s 51st photo in a day',
  format('insert into storage.objects (bucket_id, name) values (''spark-photos'', %L)', t.id('member') || '/' || gen_random_uuid() || '.jpg'));
reset role;
update storage.objects set created_at = now() - interval '25 hours' where name like t.id('member') || '/%';
select t.login('member'); set role authenticated;
select t.must_allow('a new photo once yesterday''s have aged out',
  format('insert into storage.objects (bucket_id, name) values (''spark-photos'', %L)', t.id('member') || '/' || gen_random_uuid() || '.jpg'));
reset role;
select t.check('the photo size limit is 2 MB', (select file_size_limit from storage.buckets where id = 'spark-photos') = 2097152);

-- Push devices: only push-service addresses, someone else's only with its keys, 10 each -----------------
select t.login('member'); set role authenticated;
select t.must_refuse('saving a made-up push address',
  $$select public.save_push('https://evil.example.com/hook', repeat('k', 40), repeat('a', 20))$$);
select t.must_allow('saving a Google push address',
  $$select public.save_push('https://fcm.googleapis.com/fcm/send/member-1', repeat('k', 40), repeat('a', 20))$$);
select t.must_allow('saving an Apple push address',
  $$select public.save_push('https://web.push.apple.com/member-2', repeat('k', 40), repeat('a', 20))$$);
reset role;
select t.login('outsider'); set role authenticated;
select t.must_refuse('taking over someone else''s device without its keys',
  $$select public.save_push('https://fcm.googleapis.com/fcm/send/member-1', repeat('x', 40), repeat('y', 20))$$);
select t.must_allow('the same device (same keys) signed in as someone new',
  $$select public.save_push('https://web.push.apple.com/member-2', repeat('k', 40), repeat('a', 20))$$);
reset role;
select t.check('the device moved over', (select user_id from push_subscriptions where endpoint = 'https://web.push.apple.com/member-2') = t.id('outsider'));
select t.login('member'); set role authenticated;
do $$ begin
  for i in 3..14 loop
    perform public.save_push('https://fcm.googleapis.com/fcm/send/member-' || i, repeat('k', 40), repeat('a', 20));
  end loop;
end $$;
reset role;
select t.check('at most 10 devices each', (select count(*) from push_subscriptions where user_id = t.id('member')) = 10);
select t.login('member'); set role authenticated;
do $$ begin
  for i in 15..30 loop
    perform public.save_push('https://fcm.googleapis.com/fcm/send/member-' || i, repeat('k', 40), repeat('a', 20));
  end loop;
  raise exception 'should have hit the hourly limit';
exception when sqlstate 'PT429' then raise notice 'ok  refused: more than 20 device saves an hour';
end $$;
reset role;
select t.login('guest'); set role authenticated;
select t.must_refuse('a visitor saving a device',
  $$select public.save_push('https://fcm.googleapis.com/fcm/send/guest-1', repeat('k', 40), repeat('a', 20))$$);
reset role;

-- Rate limits ------------------------------------------------------------------------------------------
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text)
values (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Group idea');
insert into t.ids select 'idea', id from sparks where text = 'Group idea';
insert into sparks (group_id, author_name, lead_name, lead_id, created_by, text)
select t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Idea ' || i from generate_series(1, 21) i;
select t.login('member'); set role authenticated;
do $$ begin
  for i in 1..10 loop
    insert into spot_options (spark_id, name, who) values (t.id('idea'), 'Spot ' || i, 'Mem');
  end loop;
end $$;
select t.must_rate_limit('an 11th location suggestion on one event in an hour',
  format($$insert into spot_options (spark_id, name, who) values (%L, 'Spot 11', 'Mem')$$, t.id('idea')));
select t.must_allow('a location suggestion on another event',
  format($$insert into spot_options (spark_id, name, who) values ((select id from sparks where text = 'Idea 1'), 'Spot', 'Mem')$$));
do $$ begin
  for i in 1..10 loop
    insert into date_options (spark_id, day_date, who) values (t.id('idea'), current_date + i, 'Mem');
  end loop;
end $$;
select t.must_rate_limit('an 11th date suggestion on one event in an hour',
  format($$insert into date_options (spark_id, day_date, who) values (%L, current_date + 30, 'Mem')$$, t.id('idea')));
do $$ begin
  insert into interests (spark_id, user_id) select id, t.id('member') from sparks where text like 'Idea %' order by text limit 20;
end $$;
select t.must_rate_limit('a 21st "interested" in an hour',
  format($$insert into interests (spark_id, user_id) values (%L, %L)$$, t.id('idea'), t.id('member')));
do $$ begin
  for i in 1..10 loop
    insert into sparks (group_id, author_name, lead_name, lead_id, created_by, text)
    values (t.id('g'), 'Mem', 'Mem', t.id('member'), t.id('member'), 'Member idea ' || i);
  end loop;
end $$;
select t.must_rate_limit('an 11th new event in an hour',
  format($$insert into sparks (group_id, author_name, lead_name, lead_id, created_by, text) values (%L, 'Mem', 'Mem', %L, %L, 'One too many')$$, t.id('g'), t.id('member'), t.id('member')));
reset role;
select t.login('host'); set role authenticated;
do $$ begin
  for i in 1..10 loop
    insert into plan_updates (spark_id, body, audience) values (t.id('invite_plan'), 'Update ' || i, 'all');
  end loop;
end $$;
select t.must_rate_limit('an 11th host update on one event in an hour',
  format($$insert into plan_updates (spark_id, body, audience) values (%L, 'Update 11', 'all')$$, t.id('invite_plan')));
reset role;
-- Rows a function writes for other people don't count: clearing the date moves 25 people to interested
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, planned, day_date)
values (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Big plan', true, current_date + 3);
insert into t.ids select 'big', id from sparks where text = 'Big plan';
do $$ declare u uuid; begin
  for i in 1..25 loop
    u := t.person('crowd' || i);
    insert into memberships (group_id, user_id) values (t.id('g'), u);
    insert into rsvps (spark_id, user_id, status) values (t.id('big'), u, 'going');
  end loop;
end $$;
select t.login('host'); set role authenticated;
select t.must_allow('clearing the date with 25 people going', format('select public.clear_plan(%L)', t.id('big')));
reset role;
select t.check('all 25 moved to interested', (select count(*) from interests where spark_id = t.id('big')) = 25);
-- Exempt accounts (the e2e leads on TEST) skip the limits
insert into private.rate_exempt values (t.id('member'));
select t.login('member'); set role authenticated;
select t.must_allow('an exempt account posting past the limit',
  format($$insert into sparks (group_id, author_name, lead_name, lead_id, created_by, text) values (%L, 'Mem', 'Mem', %L, %L, 'Exempt')$$, t.id('g'), t.id('member'), t.id('member')));
reset role;
delete from private.rate_exempt;

-- Groups: removal ends link access; blocks; new invite codes ----------------------------------------------
-- 'linked' opened the invite-only plan's link; 'member' got a friend's invite to it
insert into link_access (user_id, spark_id, via) values (t.id('member'), t.id('invite_plan'), 'invite');
select t.login('linked'); set role authenticated;
select t.check('a member who opened an invite-only event''s link sees it', exists (select 1 from sparks where id = t.id('invite_plan')));
reset role;
select t.login('host'); set role authenticated;
select t.must_refuse('removing yourself', format('select public.remove_member(%L, %L)', t.id('g'), t.id('host')));
select t.must_allow('the owner removing a member and blocking them', format('select public.remove_member(%L, %L, true)', t.id('g'), t.id('linked')));
select t.must_allow('the owner removing a member', format('select public.remove_member(%L, %L)', t.id('g'), t.id('member')));
reset role;
select t.login('linked'); set role authenticated;
select t.check('removed: the event they had the link to is gone', not exists (select 1 from sparks where id = t.id('invite_plan')));
select t.check('blocked: joining with the code fails', public.join_group('CHECK2') is null);
reset role;
select t.login('member'); set role authenticated;
select t.check('removed, but a friend''s invite still stands', exists (select 1 from sparks where id = t.id('invite_plan')));
select t.check('removed without a block: can rejoin', public.join_group('CHECK2') = t.id('g'));
reset role;
select t.login('admin'); set role authenticated;
select t.must_refuse('an admin changing the invite code', format('select public.rotate_group_code(%L)', t.id('g')));
select t.check('an admin sees who''s blocked', (select count(*) from public.group_blocked(t.id('g'))) = 1);
reset role;
select t.login('outsider'); set role authenticated;
select t.check('an outsider sees no blocks', (select count(*) from public.group_blocked(t.id('g'))) = 0);
select t.must_refuse('an outsider lifting a block', format('select public.unblock_member(%L, %L)', t.id('g'), t.id('linked')));
select t.must_refuse('reading the block list directly', 'select * from group_bans');
reset role;
select t.login('host'); set role authenticated;
select t.check('the owner gets a new code', public.rotate_group_code(t.id('g')) <> 'CHECK2');
reset role;
select t.login('outsider'); set role authenticated;
select t.check('the old code stops working', public.join_group('CHECK2') is null);
reset role;
select t.login('admin'); set role authenticated;
select t.must_allow('an admin lifting a block', format('select public.unblock_member(%L, %L)', t.id('g'), t.id('linked')));
reset role;
select set_config('t.code', (select code from groups where id = t.id('g')), false);
select t.login('linked'); set role authenticated;
select t.check('unblocked: joining with the new code works', public.join_group(current_setting('t.code')) = t.id('g'));
select public.leave_group(t.id('g'));
reset role;
insert into link_access (user_id, spark_id, via) values (t.id('replied'), t.id('invite_plan'), 'link');
select t.login('replied'); set role authenticated;
select public.leave_group(t.id('g'));
select t.check('leaving a group drops the links to its events', not exists (select 1 from link_access where spark_id = t.id('invite_plan')));
reset role;

-- Demo roster by group id; demo groups' names are reserved ----------------------------------------------
insert into groups (id, name, code, created_by, demo) values (gen_random_uuid(), 'Demo Street', 'DEMO22', t.id('host'), true);
insert into t.ids select 'demo_g', id from groups where code = 'DEMO22';
select t.login('outsider'); set role authenticated;
select t.must_refuse('starting a group with a demo group''s name', $$select public.create_group('demo street')$$);
select t.must_refuse('renaming your group to a demo group''s name', format($$select public.rename_group(%L, 'Demo Street')$$, (select id from public.create_group('Copycat'))));
reset role;
insert into demo_roster (email, group_id, role) values ('newtester@example.org', t.id('demo_g'), 'admin');
insert into groups (name, code, created_by) values ('Demo Street', 'FAKE22', t.id('outsider'));   -- a look-alike from before the rule
do $$ declare u uuid := gen_random_uuid(); begin
  insert into auth.users (id, email, email_confirmed_at, created_at, raw_user_meta_data) values (u, 'newtester@example.org', now(), now(), '{}');
  perform public.apply_demo_world(u, 'newtester@example.org');
  perform t.check('a roster tester gets their role in the roster''s group',
    (select role from memberships where user_id = u and group_id = t.id('demo_g')) = 'admin');
  perform t.check('and nothing in a same-named group', (select count(*) from memberships where user_id = u) = 1);
end $$;

-- Plans: the lead can't flip "planned" directly (only make_plan / clear_plan) ------------------------------
select t.login('host'); set role authenticated;
select t.must_refuse('the lead updating planned directly', format('update sparks set planned = false where id = %L', t.id('invite_plan')));
select t.must_allow('the lead still edits the title', format($$update sparks set text = 'Invite-only plan!' where id = %L$$, t.id('invite_plan')));
reset role;

-- Friends: a declined request survives the sender removing and re-adding ----------------------------------
select t.login('admin'); set role authenticated;
select t.check('a friend request goes out', public.send_friend_request(t.id('host')) = 'requested');
reset role;
select t.login('host'); set role authenticated;
select public.answer_friend_request(t.id('admin'), false);
reset role;
select t.login('admin'); set role authenticated;
select public.remove_friend(t.id('host'));
select public.send_friend_request(t.id('host'));
reset role;
select t.check('the declined request is still there, still declined, and no new one',
  (select count(*) from friend_requests where from_id = t.id('admin') and to_id = t.id('host') and declined_at is not null) = 1
  and (select count(*) from friend_requests where from_id = t.id('admin') and to_id = t.id('host')) = 1);
select t.login('admin'); set role authenticated;
select t.check('a pending request of your own is withdrawn by remove_friend',
  public.send_friend_request(t.id('member')) = 'requested');
select public.remove_friend(t.id('member'));
reset role;
select t.check('withdrawn', not exists (select 1 from friend_requests where from_id = t.id('admin') and to_id = t.id('member')));

-- Guests: see the event they were sent, RSVP with a name, nothing else ----------------------------------
insert into link_access (user_id, spark_id) values (t.id('guest'), t.id('invite_plan')), (t.id('guest'), t.id('idea'));
insert into signup_items (id, spark_id, item, need) values (gen_random_uuid(), t.id('invite_plan'), 'Chairs', 3);
select t.login('guest'); set role authenticated;
select t.check('a guest sees the event they were sent', exists (select 1 from sparks where id = t.id('invite_plan')));
select t.must_refuse('a guest RSVPing before leaving a name',
  format($$insert into rsvps (spark_id, user_id, status) values (%L, %L, 'going')$$, t.id('invite_plan'), t.id('guest')));
select t.must_allow('a guest leaving just a name (no phone)',
  format($$insert into guest_contacts (spark_id, user_id, name) values (%L, %L, 'Gus')$$, t.id('invite_plan'), t.id('guest')));
select t.must_allow('then RSVPing', format($$insert into rsvps (spark_id, user_id, status) values (%L, %L, 'going')$$, t.id('invite_plan'), t.id('guest')));
select t.must_allow('and changing it', format($$update rsvps set status = 'maybe' where spark_id = %L and user_id = %L$$, t.id('invite_plan'), t.id('guest')));
select t.must_refuse('a guest showing interest', format($$insert into interests (spark_id, user_id) values (%L, %L)$$, t.id('idea'), t.id('guest')));
select t.must_refuse('a guest suggesting a place', format($$insert into spot_options (spark_id, name, who) values (%L, 'Park', 'Gus')$$, t.id('idea')));
select t.must_refuse('a guest suggesting a date', format($$insert into date_options (spark_id, day_date, who) values (%L, current_date + 5, 'Gus')$$, t.id('idea')));
select t.must_refuse('a guest taking a job', format($$insert into signup_claims (item_id, user_id) values ((select id from signup_items where item = 'Chairs'), %L)$$, t.id('guest')));
select t.must_refuse('a guest adding a job', format($$insert into signup_items (spark_id, item) values (%L, 'Ice')$$, t.id('invite_plan')));
-- a guest's contact is a phone or an email (20261122000000_guest_email.sql); only then can they take a job
select t.must_refuse('a guest leaving junk as their contact', format($$update guest_contacts set phone = 'call me' where spark_id = %L and user_id = %L$$, t.id('invite_plan'), t.id('guest')));
select t.must_refuse('a guest leaving a too-short number', format($$update guest_contacts set phone = '512-555' where spark_id = %L and user_id = %L$$, t.id('invite_plan'), t.id('guest')));
select t.must_allow('a guest leaving an email', format($$update guest_contacts set phone = 'gus@example.com' where spark_id = %L and user_id = %L$$, t.id('invite_plan'), t.id('guest')));
select t.must_allow('a guest with an email taking a job', format($$insert into signup_claims (item_id, user_id) values ((select id from signup_items where item = 'Chairs'), %L)$$, t.id('guest')));
select t.must_allow('and giving it up again', format($$delete from signup_claims where item_id = (select id from signup_items where item = 'Chairs') and user_id = %L$$, t.id('guest')));
select t.must_allow('then going back to a phone number', format($$update guest_contacts set phone = '512-555-0100' where spark_id = %L and user_id = %L$$, t.id('invite_plan'), t.id('guest')));
select t.must_refuse('a guest adding an album photo', format($$insert into album_photos (spark_id, path) values (%L, %L)$$, t.id('invite_plan'), t.id('guest') || '/' || gen_random_uuid() || '.jpg'));
select t.must_refuse('a guest setting a profile photo', format($$insert into profiles (id, name, avatar_path) values (%L, 'Gus', %L)$$, t.id('guest'), t.id('guest') || '/' || gen_random_uuid() || '.jpg'));
select t.must_allow('a guest keeping a name on their profile', format($$insert into profiles (id, name) values (%L, 'Gus')$$, t.id('guest')));
select t.must_refuse('a guest using the old offers path', format($$select public.add_offer(%L, 'spot', 'Park', 'Gus')$$, t.id('idea')));
reset role;
select t.login('member'); set role authenticated;
select t.must_allow('a member still takes a job', format($$insert into signup_claims (item_id, user_id) values ((select id from signup_items where item = 'Chairs'), %L)$$, t.id('member')));
reset role;

-- Nobody keeps a password (20261101100000_no_passwords.sql), except the TEST e2e leads -------------------
insert into auth.users (id, email, encrypted_password, created_at, raw_user_meta_data)
values (gen_random_uuid(), 'squatter@ericscott-creative.com', extensions.crypt('Throwaway-Pass-12345', extensions.gen_salt('bf')), now(), '{}'),
       (gen_random_uuid(), 'e2e-lead-1@example.com', extensions.crypt('lead-pass', extensions.gen_salt('bf')), now(), '{}'),
       (gen_random_uuid(), 'e2e-lead-7@example.com', extensions.crypt('lead-pass', extensions.gen_salt('bf')), now(), '{}');
select t.check('a password given at sign-up is blanked',
  (select encrypted_password from auth.users where email = 'squatter@ericscott-creative.com') = '');
update auth.users set encrypted_password = extensions.crypt('Another-Pass-1', extensions.gen_salt('bf')) where email = 'squatter@ericscott-creative.com';
select t.check('a password set later is blanked too',
  (select encrypted_password from auth.users where email = 'squatter@ericscott-creative.com') = '');
update auth.users set email_confirmed_at = now() where email = 'squatter@ericscott-creative.com';
select t.check('confirming the address leaves it blank',
  (select encrypted_password from auth.users where email = 'squatter@ericscott-creative.com') = '');
select t.check('the e2e leads keep theirs',
  (select encrypted_password = extensions.crypt('lead-pass', encrypted_password) from auth.users where email = 'e2e-lead-1@example.com'));
select t.check('only leads 1 to 6',
  (select encrypted_password from auth.users where email = 'e2e-lead-7@example.com') = '');

-- Looking for a host and Who came (20261101090000_hosts_and_who_came.sql, 20261101110000_rsvp_interest_column_grants.sql)
-- Fresh people: earlier blocks remove 'member' and 'linked' from the group
select t.person('taker'), t.person('helper'), t.person('late');
insert into memberships (group_id, user_id, role) values (t.id('g'), t.id('taker'), 'member'), (t.id('g'), t.id('helper'), 'member'), (t.id('g'), t.id('late'), 'member');
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date) values
  (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Host idea', 'group', false, null),
  (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Came walk', 'group', true, current_date - 2),
  (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Secret walk', 'invite', true, current_date + 3);
insert into t.ids select 'host_idea', id from sparks where text = 'Host idea';
insert into t.ids select 'came_walk', id from sparks where text = 'Came walk';
insert into t.ids select 'secret_walk', id from sparks where text = 'Secret walk';
insert into rsvps (spark_id, user_id, status) values (t.id('came_walk'), t.id('taker'), 'going');
select t.login('taker'); set role authenticated;
select t.must_refuse('checking yourself in', format($$update rsvps set attended = true where spark_id = %L$$, t.id('came_walk')));
select t.must_refuse('moving your reply to an invite-only event', format($$update rsvps set spark_id = %L where spark_id = %L$$, t.id('secret_walk'), t.id('came_walk')));
select t.must_refuse('marking yourself as came', format($$select public.mark_attended(%L, %L, true)$$, t.id('came_walk'), t.id('taker')));
select t.must_allow('changing your answer', format($$update rsvps set status = 'maybe' where spark_id = %L$$, t.id('came_walk')));
select t.must_allow('re-saving your reply the way an upsert does (spark_id and user_id unchanged)', format($$insert into rsvps (spark_id, user_id, status) values (%L, %L, 'going') on conflict (spark_id, user_id) do update set spark_id = excluded.spark_id, user_id = excluded.user_id, status = excluded.status$$, t.id('came_walk'), t.id('taker')));
-- Bringing others (20261110000000_plus_ones.sql)
select t.must_allow('saying you''re bringing two', format($$update rsvps set plus_count = 2, plus_note = 'My kids' where spark_id = %L$$, t.id('came_walk')));
select t.must_refuse('bringing more than ten', format($$update rsvps set plus_count = 11 where spark_id = %L$$, t.id('came_walk')));
select t.must_refuse('a who-is-coming line over 80 characters', format($$update rsvps set plus_note = repeat('x', 81) where spark_id = %L$$, t.id('came_walk')));
select t.check('and load_all carries them', public.load_all() -> 'rsvps' @> jsonb_build_array(jsonb_build_object('spark_id', t.id('came_walk'), 'plus_count', 2, 'plus_note', 'My kids')));
select t.must_refuse('taking the lead of an idea that isn''t looking for a host', format($$select public.take_the_lead(%L)$$, t.id('host_idea')));
select t.must_refuse('saying someone else''s idea is looking for a host', format($$select public.set_wants_host(%L, true)$$, t.id('host_idea')));
select t.must_refuse('flipping wants_host directly', format($$update sparks set wants_host = true where id = %L$$, t.id('host_idea')));
reset role;
select t.login('helper'); set role authenticated;
select t.must_allow('interest with "I could help"', format($$insert into interests (spark_id, user_id, can_help) values (%L, %L, true)$$, t.id('host_idea'), t.id('helper')));
select t.must_allow('switching "I could help" off', format($$update interests set can_help = false where spark_id = %L$$, t.id('host_idea')));
select t.must_refuse('moving your interest to another event', format($$update interests set spark_id = %L where spark_id = %L$$, t.id('came_walk'), t.id('host_idea')));
reset role;
select t.login('late'); set role authenticated;
select t.must_refuse('an RSVP that arrives checked in', format($$insert into rsvps (spark_id, user_id, status, attended) values (%L, %L, 'going', true)$$, t.id('came_walk'), t.id('late')));
reset role;
select t.login('host'); set role authenticated;
select t.must_refuse('checking in before the day', format($$select public.mark_attended(%L, %L, true)$$, t.id('invite_plan'), t.id('replied')));
select t.must_allow('the host checks someone in', format($$select public.mark_attended(%L, %L, true)$$, t.id('came_walk'), t.id('taker')));
select t.must_allow('the lead looks for a host', format($$select public.set_wants_host(%L, true)$$, t.id('host_idea')));
reset role;
select t.check('checked in', (select attended from rsvps where spark_id = t.id('came_walk') and user_id = t.id('taker')));
select t.login('taker'); set role authenticated;
-- I'll decide (lead_rule 'me', 20261111000000_idea_handoffs.sql): only someone asked can take it
select t.must_refuse('a member nobody asked taking an "I''ll decide" idea', format($$select public.take_the_lead(%L)$$, t.id('host_idea')));
reset role;
select t.login('host'); set role authenticated;
select t.must_allow('the lead asks the taker', format($$select public.ask_to_lead(%L, %L)$$, t.id('host_idea'), t.id('taker')));
reset role;
select t.login('taker'); set role authenticated;
select t.must_allow('someone else takes the lead', format($$select public.take_the_lead(%L)$$, t.id('host_idea')));
reset role;
select t.check('the taker leads it, and it isn''t looking any more',
  (select lead_id = t.id('taker') and not wants_host from sparks where id = t.id('host_idea')));
select t.check('the floater stays interested',
  exists (select 1 from interests where spark_id = t.id('host_idea') and user_id = t.id('host')));

-- Co-hosts (20261101130000_cohosts.sql) ------------------------------------------------------------------
select t.person('cohost'), t.person('cohost2');
insert into memberships (group_id, user_id, role) values (t.id('g'), t.id('cohost'), 'member'), (t.id('g'), t.id('cohost2'), 'member');
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date, mood) values
  (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Co walk', 'invite', true, current_date + 4,
   array[t.id('host')::text || '/' || gen_random_uuid() || '.jpg']);
insert into t.ids select 'co_walk', id from sparks where text = 'Co walk';
select t.login('cohost'); set role authenticated;
select t.must_refuse('a member making themselves a co-host', format($$select public.add_cohost(%L, %L)$$, t.id('co_walk'), t.id('cohost')));
select t.must_refuse('writing cohosts directly', format($$insert into cohosts (spark_id, user_id) values (%L, %L)$$, t.id('co_walk'), t.id('cohost')));
select t.check('an invite-only event is hidden before', (select count(*) from sparks where id = t.id('co_walk')) = 0);
reset role;
select t.login('host'); set role authenticated;
select t.must_refuse('a co-host from outside the groups', format($$select public.add_cohost(%L, %L)$$, t.id('co_walk'), t.id('outsider')));
select t.must_refuse('a guest as co-host', format($$select public.add_cohost(%L, %L)$$, t.id('co_walk'), t.id('guest')));
select t.must_allow('the lead adds a co-host', format($$select public.add_cohost(%L, %L)$$, t.id('co_walk'), t.id('cohost')));
reset role;
select t.check('the new co-host gets a note', exists (select 1 from notes where user_id = t.id('cohost') and body like '%co-lead of Co walk%'));
select t.login('cohost'); set role authenticated;
select t.check('a co-host sees the invite-only event', (select count(*) from sparks where id = t.id('co_walk')) = 1);
select t.check('is_host for a co-host', public.is_host(t.id('co_walk')));
select t.must_allow('a co-host edits it (even with the lead''s mood photo on it)', format($$update sparks set text = 'Co walk' where id = %L$$, t.id('co_walk')));
select t.must_allow('a co-host adds their own mood photo', format($$update sparks set mood = mood || array[%L] where id = %L$$, t.id('cohost')::text || '/' || gen_random_uuid() || '.jpg', t.id('co_walk')));
select t.must_refuse('…but not someone else''s', format($$update sparks set mood = mood || array[%L] where id = %L$$, t.id('outsider')::text || '/' || gen_random_uuid() || '.jpg', t.id('co_walk')));
select t.must_allow('a co-host posts an update', format($$insert into plan_updates (spark_id, body, created_by) values (%L, 'Bring water', %L)$$, t.id('co_walk'), t.id('cohost')));
select t.must_allow('a co-host adds a job with a count', format($$insert into signup_items (spark_id, item, need, created_by) values (%L, 'Snacks', 3, %L)$$, t.id('co_walk'), t.id('cohost')));
select t.must_allow('a co-host adds another co-host', format($$select public.add_cohost(%L, %L)$$, t.id('co_walk'), t.id('cohost2')));
select t.must_refuse('a co-host removing another', format($$select public.remove_cohost(%L, %L)$$, t.id('co_walk'), t.id('cohost2')));
select t.must_refuse('a co-host cancelling', format($$select public.cancel_event(%L)$$, t.id('co_walk')));
select t.must_refuse('a co-host deleting', format($$delete from sparks where id = %L$$, t.id('co_walk')));
select t.must_refuse('a co-host deleting through delete_event', format($$select public.delete_event(%L, true)$$, t.id('co_walk')));
reset role;
select t.login('cohost2'); set role authenticated;
select t.must_allow('a co-host steps down', format($$select public.remove_cohost(%L, %L)$$, t.id('co_walk'), t.id('cohost2')));
select t.check('and is no longer a host', not public.is_host(t.id('co_walk')));
reset role;
select t.login('host'); set role authenticated;
select t.must_allow('the lead removes a co-host', format($$select public.remove_cohost(%L, %L)$$, t.id('co_walk'), t.id('cohost')));
reset role;

-- The demo wipe is gone (20261101140000_quiet_tests_no_wipe.sql): nothing can remove all demo content at once
select t.check('wipe_demo() no longer exists', to_regprocedure('public.wipe_demo()') is null);

-- The lead is Going to their own plan (20261101160000_lead_going.sql) ---------------------------------------------
select t.login('host'); set role authenticated;
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, planned, day_date)
values (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Lead going walk', true, current_date + 5);
reset role;
select t.check('posting a plan marks its lead Going',
  exists (select 1 from rsvps r join sparks s on s.id = r.spark_id where s.text = 'Lead going walk' and r.user_id = t.id('host') and r.status = 'going'));
select t.login('member'); set role authenticated;
select t.must_allow('a member says Going', $$insert into rsvps (spark_id, user_id, status) select id, auth.uid(), 'going' from sparks where text = 'Lead going walk'$$);
reset role;
select t.login('host'); set role authenticated;
select t.must_allow('the lead can change their answer', $$update rsvps set status = 'maybe' where user_id = auth.uid() and spark_id = (select id from sparks where text = 'Lead going walk')$$);
select t.must_allow('the lead says Going again', $$update rsvps set status = 'going' where user_id = auth.uid() and spark_id = (select id from sparks where text = 'Lead going walk')$$);
select t.must_allow('the lead turns it back into an idea', $$select public.clear_plan((select id from sparks where text = 'Lead going walk'))$$);
reset role;
select t.check('the member going is now interested',
  exists (select 1 from interests i join sparks s on s.id = i.spark_id where s.text = 'Lead going walk' and i.user_id = t.id('member')));
select t.check('the lead isn''t interested in their own idea',
  not exists (select 1 from interests i join sparks s on s.id = i.spark_id where s.text = 'Lead going walk' and i.user_id = t.id('host')));
update sparks set day_date = current_date + 6 where text = 'Lead going walk';
select t.login('host'); set role authenticated;
select t.must_allow('the lead makes it a plan again', $$select public.make_plan((select id from sparks where text = 'Lead going walk'))$$);
reset role;
select t.check('making it a plan marks the lead Going',
  exists (select 1 from rsvps r join sparks s on s.id = r.spark_id where s.text = 'Lead going walk' and r.user_id = t.id('host') and r.status = 'going'));

-- Invite people (20261101170000_invite_people.sql): friends and people in the event's groups ---------------------
select t.login('host'); set role authenticated;
select t.check('the lead invites a group member who isn''t a friend',
  (public.invite_friends((select id from sparks where text = 'Lead going walk'), array[t.id('admin')]) -> 'invited') = to_jsonb(array[t.id('admin')]));
select t.check('someone outside the event''s groups is skipped',
  (public.invite_friends((select id from sparks where text = 'Lead going walk'), array[t.id('outsider')]) -> 'invited') = '[]'::jsonb);
select t.check('the lead sees who has an invite',
  array(select public.event_invited((select id from sparks where text = 'Lead going walk'))) = array[t.id('admin')]);
select t.check('the lead invites with a note',
  (public.invite_friends((select id from sparks where text = 'Lead going walk'), array[t.id('late')], '  ' || repeat('x', 150)) -> 'invited') ? t.id('late')::text);
select t.check('an invite carries its note, trimmed and cut to 140 characters',
  (select message from event_invites where user_id = t.id('late') and spark_id = (select id from sparks where text = 'Lead going walk')) = repeat('x', 140));
select t.check('an invite without a note has none',
  (select message from event_invites where user_id = t.id('admin') and spark_id = (select id from sparks where text = 'Lead going walk')) is null);
reset role;
select t.check('the invited member can see the event through the invite',
  exists (select 1 from link_access where user_id = t.id('admin') and via = 'invite' and spark_id = (select id from sparks where text = 'Lead going walk')));
select t.login('outsider'); set role authenticated;
select t.check('someone who can''t invite sees no invites',
  not exists (select 1 from public.event_invited((select id from sparks where text = 'Lead going walk'))));
reset role;

-- Invited and Nudge (20261102040000_invited_and_nudge.sql): the hosts read every invite and nudge once a day --------
select t.login('host'); set role authenticated;
select t.check('the lead reads the invites to their event',
  exists (select 1 from event_invites where user_id = t.id('admin') and spark_id = (select id from sparks where text = 'Lead going walk')));
select t.check('the lead nudges someone who hasn''t replied',
  public.nudge_invitee((select id from sparks where text = 'Lead going walk'), t.id('admin')));
select t.check('a second nudge the same day sends nothing',
  not public.nudge_invitee((select id from sparks where text = 'Lead going walk'), t.id('admin')));
select t.must_refuse('nudging someone who wasn''t invited',
  format($$select public.nudge_invitee((select id from sparks where text = 'Lead going walk'), %L)$$, t.id('outsider')));
select t.must_refuse('setting nudged_at directly',
  $$update event_invites set nudged_at = null where spark_id = (select id from sparks where text = 'Lead going walk')$$);
reset role;
select t.check('the person nudged gets one note',
  (select count(*) = 1 from notes where user_id = t.id('admin') and body like '% is hoping you can make Lead going walk. Going, Maybe or Can’t?'));
select t.login('admin'); set role authenticated;
select t.must_refuse('someone invited can''t nudge',
  format($$select public.nudge_invitee((select id from sparks where text = 'Lead going walk'), %L)$$, t.id('admin')));
reset role;
select t.login('outsider'); set role authenticated;
select t.check('someone else reads no invites to it',
  not exists (select 1 from event_invites where spark_id = (select id from sparks where text = 'Lead going walk')));
reset role;

-- Job asks and the lead handover (20261102070000_job_asks_and_handoff.sql) ------------------------------------
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date) values
  (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Job ask walk', 'group', true, current_date + 5),
  (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Handover walk', 'group', true, current_date + 6);
insert into signup_items (id, spark_id, item, need, created_by) values
  (gen_random_uuid(), (select id from sparks where text = 'Job ask walk'), 'Barricades', 3, t.id('host'));
create function t.job() returns uuid language sql stable as $$ select id from signup_items where item = 'Barricades' $$;
grant execute on function t.job() to authenticated;
select t.login('host'); set role authenticated;
select t.check('a job ask''s note is optional (20261103020000)', (select is_nullable = 'YES' from information_schema.columns where table_schema = 'public' and table_name = 'job_asks' and column_name = 'message')
  and not exists (select 1 from pg_proc where proname = 'ask_for_job' and prosrc like '%say why them%'));
select t.must_allow('the lead asks someone, with why them', format($$select public.ask_for_job(%L, %L, 'I thought of you because you did it last year')$$, t.job(), t.id('helper')));
select t.must_allow('and a second person', format($$select public.ask_for_job(%L, %L, 'I thought of you because you live next door')$$, t.job(), t.id('taker')));
select t.must_refuse('a third while two are open', format($$select public.ask_for_job(%L, %L, 'I thought of you because why not')$$, t.job(), t.id('late')));
select t.must_refuse('asking someone outside the groups', format($$select public.ask_for_job(%L, %L, 'I thought of you')$$, t.job(), t.id('outsider')));
select t.must_refuse('writing an ask directly', format($$insert into job_asks (item_id, spark_id, user_id, asked_by, message) values (%L, (select id from sparks where text = 'Job ask walk'), %L, %L, 'x')$$, t.job(), t.id('late'), t.id('host')));
reset role;
select t.login('admin'); set role authenticated;
select t.must_refuse('someone who doesn''t lead it asking', format($$select public.ask_for_job(%L, %L, 'I thought of you')$$, t.job(), t.id('late')));
select t.check('a member sees no asks that aren''t theirs', not exists (select 1 from job_asks));
reset role;
select t.login('helper'); set role authenticated;
select t.check('the person asked sees the ask and its line', (select message from job_asks where user_id = t.id('helper')) = 'I thought of you because you did it last year');
select t.must_allow('I''m in', format($$select public.answer_job_ask(%L, true)$$, t.job()));
select t.check('I''m in signs them up', exists (select 1 from signup_claims where item_id = t.job() and user_id = t.id('helper')));
select t.check('and marks them Going', exists (select 1 from rsvps where spark_id = (select id from sparks where text = 'Job ask walk') and user_id = t.id('helper') and status = 'going'));
reset role;
select t.login('host'); set role authenticated;
select t.must_allow('an answer frees a slot for someone else', format($$select public.ask_for_job(%L, %L, 'I thought of you because you''re handy')$$, t.job(), t.id('late')));
select t.must_allow('the lead withdraws an open ask', format($$select public.withdraw_job_ask(%L, %L)$$, t.job(), t.id('taker')));
select t.check('the withdrawn ask is gone', not exists (select 1 from job_asks where item_id = t.job() and user_id = t.id('taker')));
reset role;
select t.login('late'); set role authenticated;
select t.must_allow('Can''t this time', format($$select public.answer_job_ask(%L, false)$$, t.job()));
reset role;
select t.check('the asker gets a quiet note', exists (select 1 from notes where user_id = t.id('host') and body like '% can’t take Barricades this time (Job ask walk).'));
select t.check('Can''t this time signs nobody up', not exists (select 1 from signup_claims where item_id = t.job() and user_id = t.id('late')));
-- A host takes someone off a job (20261118000000_one_push_and_full_asks.sql, jobs audit M1)
select t.login('late'); set role authenticated;
select t.must_refuse('a member can''t take someone off a job', format($$select public.remove_part_claim(%L, %L)$$, t.job(), t.id('helper')));
reset role;
select t.check('so they''re still on it', exists (select 1 from signup_claims where item_id = t.job() and user_id = t.id('helper')));
select t.login('host'); set role authenticated;
select t.must_allow('the lead takes someone off a job', format($$select public.remove_part_claim(%L, %L)$$, t.job(), t.id('helper')));
reset role;
select t.check('they''re off it, and told who did it',
  not exists (select 1 from signup_claims where item_id = t.job() and user_id = t.id('helper'))
  and exists (select 1 from notes where user_id = t.id('helper') and body like '% took you off Barricades (Job ask walk).' and quiet));
-- I'm in after the job filled up closes the ask instead of failing (20261118000000_one_push_and_full_asks.sql)
insert into signup_items (id, spark_id, item, need, created_by) values
  (gen_random_uuid(), (select id from sparks where text = 'Job ask walk'), 'Cones', 1, t.id('host'));
select t.login('host'); set role authenticated;
select t.must_allow('the lead asks someone to bring cones', format($$select public.ask_for_job((select id from signup_items where item = 'Cones'), %L, null)$$, t.id('taker')));
reset role;
insert into signup_claims (item_id, user_id) values ((select id from signup_items where item = 'Cones'), t.id('helper'));
select t.login('taker'); set role authenticated;
select t.check('I''m in on a job that filled up says so', public.answer_job_ask((select id from signup_items where item = 'Cones'), true) = 'full');
reset role;
select t.check('and closes the ask without signing them up',
  (select answer from job_asks where item_id = (select id from signup_items where item = 'Cones') and user_id = t.id('taker')) = 'full'
  and not exists (select 1 from signup_claims where item_id = (select id from signup_items where item = 'Cones') and user_id = t.id('taker')));

select t.login('admin'); set role authenticated;
select t.must_refuse('only the lead hands it on', format($$select public.offer_lead((select id from sparks where text = 'Handover walk'), %L)$$, t.id('taker')));
reset role;
select t.login('host'); set role authenticated;
select t.must_refuse('handing it to someone outside the groups', format($$select public.offer_lead((select id from sparks where text = 'Handover walk'), %L)$$, t.id('outsider')));
select t.must_allow('the lead offers it to a member', format($$select public.offer_lead((select id from sparks where text = 'Handover walk'), %L, 'You know the route')$$, t.id('taker')));
select t.check('nothing changes yet', (select lead_id from sparks where text = 'Handover walk') = t.id('host'));
reset role;
select t.login('helper'); set role authenticated;
select t.must_refuse('someone else can''t accept it', $$select public.answer_lead_offer((select id from sparks where text = 'Handover walk'), true)$$);
reset role;
select t.login('taker'); set role authenticated;
select t.check('the person offered sees it', exists (select 1 from lead_offers where user_id = t.id('taker')));
select t.must_allow('they take it', $$select public.answer_lead_offer((select id from sparks where text = 'Handover walk'), true)$$);
reset role;
select t.check('they lead it now', (select lead_id from sparks where text = 'Handover walk') = t.id('taker'));
select t.check('the old lead is a co-lead', exists (select 1 from cohosts where spark_id = (select id from sparks where text = 'Handover walk') and user_id = t.id('host')));
select t.check('the new lead is Going', exists (select 1 from rsvps where spark_id = (select id from sparks where text = 'Handover walk') and user_id = t.id('taker') and status = 'going'));
select t.check('the old lead gets a note', exists (select 1 from notes where user_id = t.id('host') and body like '% is leading Handover walk now. You’re a co-lead.'));
select t.check('the offer is gone', not exists (select 1 from lead_offers where spark_id = (select id from sparks where text = 'Handover walk')));

-- The starter picks a lead from the people who offered (20261122030000_pick_lead.sql) -------------------------------
select t.login('host'); set role authenticated;
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, wants_host)
values (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Pick walk', true);
reset role;
select t.login('helper'); set role authenticated;
select t.must_allow('a member offers to lead', $$insert into interests (spark_id, user_id, can_help) values ((select id from sparks where text = 'Pick walk'), (select auth.uid()), true)$$);
reset role;
select t.login('member'); set role authenticated;
select t.must_refuse('someone who isn''t a lead picking a lead', format($$select public.pick_lead((select id from sparks where text = 'Pick walk'), %L)$$, t.id('helper')));
reset role;
select t.login('host'); set role authenticated;
select t.must_refuse('picking someone who didn''t offer', format($$select public.pick_lead((select id from sparks where text = 'Pick walk'), %L)$$, t.id('taker')));
select t.must_allow('the starter picks the one who offered', format($$select public.pick_lead((select id from sparks where text = 'Pick walk'), %L)$$, t.id('helper')));
reset role;
select t.check('the pick leads it, and it isn''t looking any more',
  (select lead_id = t.id('helper') and not wants_host from sparks where text = 'Pick walk'));
select t.check('the starter stays interested',
  exists (select 1 from interests i join sparks s on s.id = i.spark_id where s.text = 'Pick walk' and i.user_id = t.id('host')));
select t.login('host'); set role authenticated;
select t.must_refuse('picking again once it has a lead', format($$select public.pick_lead((select id from sparks where text = 'Pick walk'), %L)$$, t.id('helper')));
reset role;

-- Hand it to a co-lead in one tap (20261122050000_hand_to_colead.sql) ------------------------------------------------
select t.login('host'); set role authenticated;
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text)
values (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Colead walk');
select t.must_allow('the lead adds a co-lead', format($$select public.add_cohost((select id from sparks where text = 'Colead walk'), %L)$$, t.id('helper')));
select t.must_refuse('handing it to someone who isn''t a co-lead', format($$select public.hand_to_colead((select id from sparks where text = 'Colead walk'), %L)$$, t.id('taker')));
reset role;
select t.login('member'); set role authenticated;
select t.must_refuse('someone who isn''t the lead handing it on', format($$select public.hand_to_colead((select id from sparks where text = 'Colead walk'), %L)$$, t.id('helper')));
reset role;
select t.login('host'); set role authenticated;
select t.must_allow('the lead hands it to the co-lead', format($$select public.hand_to_colead((select id from sparks where text = 'Colead walk'), %L)$$, t.id('helper')));
reset role;
select t.check('the co-lead leads, the old lead co-leads',
  (select lead_id = t.id('helper') from sparks where text = 'Colead walk')
  and exists (select 1 from cohosts c join sparks s on s.id = c.spark_id where s.text = 'Colead walk' and c.user_id = t.id('host'))
  and not exists (select 1 from cohosts c join sparks s on s.id = c.spark_id where s.text = 'Colead walk' and c.user_id = t.id('helper')));

-- A plan needs a lead too (20261101200000_plan_needs_lead.sql) ----------------------------------------------------
select t.login('host'); set role authenticated;
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, day_date)
values (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Needs a lead walk', current_date + 5);
select t.must_allow('the lead looks for a lead', $$select public.set_wants_host((select id from sparks where text = 'Needs a lead walk'), true)$$);
select t.must_refuse('making it a plan while it''s looking for a lead', $$select public.make_plan((select id from sparks where text = 'Needs a lead walk'))$$);
select t.must_allow('the lead takes it back', $$select public.set_wants_host((select id from sparks where text = 'Needs a lead walk'), false)$$);
select t.must_allow('then it can be a plan', $$select public.make_plan((select id from sparks where text = 'Needs a lead walk'))$$);
reset role;

-- Step back as lead (20261101210000_step_back.sql) ----------------------------------------------------------------
select t.login('member'); set role authenticated;
select t.must_refuse('someone who isn''t the lead stepping back', $$select public.step_back((select id from sparks where text = 'Needs a lead walk'))$$);
reset role;
select t.login('host'); set role authenticated;
select t.check('the lead steps back from a plan: it''s an idea again', public.step_back((select id from sparks where text = 'Needs a lead walk')) = 'idea');
reset role;
select t.check('not planned, looking for a lead, date kept',
  exists (select 1 from sparks where text = 'Needs a lead walk' and not planned and wants_host and day_date is not null));
select t.check('the old lead is interested, not going',
  exists (select 1 from interests i join sparks s on s.id = i.spark_id where s.text = 'Needs a lead walk' and i.user_id = t.id('host'))
  and not exists (select 1 from rsvps r join sparks s on s.id = r.spark_id where s.text = 'Needs a lead walk'));

-- Review fixes (20261102000000_review_fixes.sql) ------------------------------------------------------------------
-- A Maybe is treated like Going when a plan goes back to an idea
select t.login('host'); set role authenticated;
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, planned, day_date)
values (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Maybe walk', true, current_date + 5);
reset role;
select t.login('member'); set role authenticated;
select t.must_allow('a member says Maybe', $$insert into rsvps (spark_id, user_id, status) select id, auth.uid(), 'maybe' from sparks where text = 'Maybe walk'$$);
reset role;
delete from notes where user_id = t.id('member');
select t.login('host'); set role authenticated;
select t.must_allow('the lead turns it back into an idea', $$select public.clear_plan((select id from sparks where text = 'Maybe walk'))$$);
reset role;
select t.check('the Maybe is interested and got the note',
  exists (select 1 from interests i join sparks s on s.id = i.spark_id where s.text = 'Maybe walk' and i.user_id = t.id('member'))
  and exists (select 1 from notes where user_id = t.id('member') and body like 'Maybe walk is off the calendar%'));
-- A date that has passed can't be made a plan (3 days back: clear of the Chicago / UTC day boundary)
update sparks set day_date = current_date - 3 where text = 'Maybe walk';
select t.login('host'); set role authenticated;
select t.must_refuse('making it a plan on a date that has passed', $$select public.make_plan((select id from sparks where text = 'Maybe walk'))$$);
reset role;
update sparks set day_date = current_date + 5 where text = 'Maybe walk';
select t.login('host'); set role authenticated;
select t.must_allow('with a date ahead it can be a plan', $$select public.make_plan((select id from sparks where text = 'Maybe walk'))$$);
insert into signup_items (id, spark_id, item, need) values (gen_random_uuid(), (select id from sparks where text = 'Maybe walk'), 'Bring chairs', 2);
reset role;
-- Stepping back from a plan: a Maybe becomes interested and gets the note too
select t.login('member'); set role authenticated;
select t.must_allow('the member changes to Maybe', $$update rsvps set status = 'maybe' where user_id = auth.uid() and spark_id = (select id from sparks where text = 'Maybe walk')$$);
-- Taking yourself off a job tells the lead, but not in the first 2 minutes (Undo)
select t.must_allow('the member takes a job', $$insert into signup_claims (item_id) select id from signup_items where item = 'Bring chairs'$$);
reset role;
delete from notes where user_id = t.id('host');
select t.login('member'); set role authenticated;
select t.must_allow('and undoes it straight away', $$delete from signup_claims where user_id = auth.uid() and item_id = (select id from signup_items where item = 'Bring chairs')$$);
reset role;
select t.check('an Undo right after signing up tells no one', not exists (select 1 from notes where user_id = t.id('host')));
select t.login('member'); set role authenticated;
select t.must_allow('the member takes the job again', $$insert into signup_claims (item_id) select id from signup_items where item = 'Bring chairs'$$);
reset role;
update signup_claims set created_at = now() - interval '10 minutes' where user_id = t.id('member') and item_id = (select id from signup_items where item = 'Bring chairs');
select t.login('member'); set role authenticated;
select t.must_allow('later, the member takes themselves off', $$delete from signup_claims where user_id = auth.uid() and item_id = (select id from signup_items where item = 'Bring chairs')$$);
reset role;
select t.check('the lead gets a note that the job is open again',
  exists (select 1 from notes where user_id = t.id('host') and body like '%can’t do Bring chairs any more (Maybe walk).'));
delete from notes where user_id = t.id('host');
-- The lead removing the job tells the people signed up, not the lead
select t.login('member'); set role authenticated;
select t.must_allow('the member takes the job a third time', $$insert into signup_claims (item_id) select id from signup_items where item = 'Bring chairs'$$);
reset role;
update signup_claims set created_at = now() - interval '10 minutes' where user_id = t.id('member') and item_id = (select id from signup_items where item = 'Bring chairs');
select t.login('host'); set role authenticated;
select t.must_allow('the lead takes the job down', $$select public.remove_signup((select id from signup_items where item = 'Bring chairs'))$$);
reset role;
select t.check('taking a job down writes the lead no "can''t do" note', not exists (select 1 from notes where user_id = t.id('host') and body like '%can’t do%'));
delete from notes where user_id = t.id('member');
select t.login('host'); set role authenticated;
select t.check('the lead steps back from the plan', public.step_back((select id from sparks where text = 'Maybe walk')) = 'idea');
reset role;
select t.check('the Maybe is interested and got the stepped-back note',
  exists (select 1 from interests i join sparks s on s.id = i.spark_id where s.text = 'Maybe walk' and i.user_id = t.id('member'))
  and exists (select 1 from notes where user_id = t.id('member') and body like 'Maybe walk is an idea again%'));

-- Your own account, a cover photo, deleting your only group (20261102010000_my_account_and_cover.sql) ----------------
select t.person('solo'), t.person('leaver'), t.person('heir');
select t.login('solo'); set role authenticated;
select * from public.create_group('Solo crew');
select t.must_allow('the only owner deletes their only group', $$select public.delete_group((select id from groups where name = 'Solo crew'))$$);
reset role;
select t.check('the group is gone', not exists (select 1 from groups where name = 'Solo crew'));
-- A cover photo comes off (hosts only)
update sparks set photos = array['00000000-0000-0000-0000-000000000000/11111111-1111-1111-1111-111111111111.jpg'] where text = 'Lead going walk';
select t.login('member'); set role authenticated;
select t.must_refuse('a member taking the cover off', $$select public.remove_idea_cover((select id from sparks where text = 'Lead going walk'))$$);
reset role;
select t.login('host'); set role authenticated;
select t.check('the lead takes the cover off and gets its path back', public.remove_idea_cover((select id from sparks where text = 'Lead going walk')) like '%11111111-1111-1111-1111-111111111111.jpg');
reset role;
select t.check('no photo and no framing left', exists (select 1 from sparks where text = 'Lead going walk' and photos = '{}' and cover_pos is null));
-- Deleting your own account (Design v8-18 store safety, 20261124000000_store_safety.sql)
-- t.fresh(): signed in with an email code just now (the 6-digit code step)
create function t.fresh(p_name text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', t.id(p_name), 'role', 'authenticated', 'is_anonymous', false,
    'amr', json_build_array(json_build_object('method', 'otp', 'timestamp', extract(epoch from now())::bigint)))::text, false);
  perform set_config('request.jwt.claim.sub', t.id(p_name)::text, false);
end $$;
grant execute on function t.fresh(text) to authenticated;
select t.login('guest'); set role authenticated;
select t.must_refuse('a guest deleting "their account"', $$select public.delete_my_account('[]', '[]')$$);
reset role;
select t.login('leaver'); set role authenticated;
select * from public.create_group('Leaver crew');
reset role;
insert into memberships (group_id, user_id, role) values ((select id from groups where name = 'Leaver crew'), t.id('heir'), 'member');
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, planned, day_date)
values (gen_random_uuid(), (select id from groups where name = 'Leaver crew'), 'Leaver', 'Leaver', t.id('leaver'), t.id('leaver'), 'Handed on walk', true, current_date + 5),
       (gen_random_uuid(), (select id from groups where name = 'Leaver crew'), 'Leaver', 'Leaver', t.id('leaver'), t.id('leaver'), 'Called off walk', true, current_date + 6),
       (gen_random_uuid(), (select id from groups where name = 'Leaver crew'), 'Leaver', 'Leaver', t.id('leaver'), t.id('leaver'), 'Looking again walk', true, current_date + 7),
       (gen_random_uuid(), (select id from groups where name = 'Leaver crew'), 'Leaver', 'Leaver', t.id('leaver'), t.id('leaver'), 'Long ago walk', true, current_date - 9);
insert into cohosts (spark_id, user_id, added_by) values ((select id from sparks where text = 'Handed on walk'), t.id('heir'), t.id('leaver'));
insert into rsvps (spark_id, user_id, status) values ((select id from sparks where text = 'Called off walk'), t.id('heir'), 'going');
select t.login('leaver'); set role authenticated;
select t.check('the plan lists the group to hand on and the three upcoming events',
  jsonb_array_length(public.delete_account_plan() -> 'groups') = 1 and jsonb_array_length(public.delete_account_plan() -> 'events') = 3
  and public.delete_account_plan() -> 'groups' -> 0 -> 'people' -> 0 ->> 'id' = t.id('heir')::text);
select t.must_refuse('deleting without a fresh email code', $$select public.delete_my_account('[]', '[]')$$);
select t.fresh('leaver');
select t.must_refuse('deleting without saying who gets the group you own alone', $$select public.delete_my_account('[]', '[]')$$);
select t.must_refuse('handing the group to someone outside it', format($$select public.delete_my_account('[{"id": "%s", "to": "%s"}]', '[]')$$,
  (select id from groups where name = 'Leaver crew'), t.id('outsider')));
select t.must_allow('with a fresh code and a new owner picked, the account goes', format($$select public.delete_my_account('[{"id": "%s", "to": "%s"}]', '[{"id": "%s", "act": "cancel"}]')$$,
  (select id from groups where name = 'Leaver crew'), t.id('heir'), (select id from sparks where text = 'Called off walk')));
reset role;
select t.check('the account is gone', not exists (select 1 from auth.users where id = t.id('leaver')));
select t.check('the group stays, with its new owner', exists (select 1 from memberships m join groups g on g.id = m.group_id where g.name = 'Leaver crew' and m.user_id = t.id('heir') and m.role = 'owner'));
select t.check('the co-led event passed to its co-lead, who is no longer listed as a co-lead',
  exists (select 1 from sparks where text = 'Handed on walk' and lead_id = t.id('heir'))
  and not exists (select 1 from cohosts c join sparks s on s.id = c.spark_id where s.text = 'Handed on walk'));
select t.check('the cancelled event stays, cancelled, and the people going were told',
  exists (select 1 from sparks where text = 'Called off walk' and cancelled_at is not null)
  and exists (select 1 from notes where user_id = t.id('heir') and body like 'Called off walk is cancelled%'));
select t.check('an event passed on with no co-lead is an idea looking for a lead', exists (select 1 from sparks where text = 'Looking again walk' and not planned and wants_host and lead_id is null));
select t.check('a past event with no co-lead went with them', not exists (select 1 from sparks where text = 'Long ago walk'));
select t.login('solo'); set role authenticated;
select * from public.create_group('Solo crew');
reset role;
select t.fresh('solo'); set role authenticated;
select t.must_allow('a group with nobody else in it just goes with the account', $$select public.delete_my_account('[]', '[]')$$);
reset role;
select t.check('…and so does the group', not exists (select 1 from groups where name = 'Solo crew'));

-- Float an idea and ask someone to lead (20261102020000_float_and_ask.sql) -----------------------------------------
select t.person('floater'), t.person('asked'), t.person('stranger');
insert into memberships (group_id, user_id, role) values (t.id('g'), t.id('floater'), 'member'), (t.id('g'), t.id('asked'), 'member');
select t.login('floater'); set role authenticated;
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, wants_host)
values (gen_random_uuid(), t.id('g'), 'Floater', 'Floater', t.id('floater'), t.id('floater'), 'Floated idea', true),
       (gen_random_uuid(), t.id('g'), 'Floater', 'Floater', t.id('floater'), t.id('floater'), 'Floated back idea', true);
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, planned, day_date, wants_host)
values (gen_random_uuid(), t.id('g'), 'Floater', 'Floater', t.id('floater'), t.id('floater'), 'Plan not floated', true, current_date + 4, true);
reset role;
insert into t.ids select 'floated', id from sparks where text = 'Floated idea';
insert into t.ids select 'floated_back', id from sparks where text = 'Floated back idea';
select t.check('an idea can be posted already looking for a lead', (select wants_host and not planned from sparks where id = t.id('floated')));
select t.check('a plan is never posted looking for a lead', (select planned and not wants_host from sparks where text = 'Plan not floated'));
insert into link_access (user_id, spark_id, via) values (t.id('stranger'), t.id('floated'), 'link');
select t.login('stranger'); set role authenticated;
select t.check('a link holder from outside the group sees the floated idea', exists (select 1 from sparks where id = t.id('floated')));
select t.must_refuse('someone outside the event''s groups taking the lead', format($$select public.take_the_lead(%L)$$, t.id('floated')));
select t.must_refuse('someone who doesn''t lead it asking a person to lead', format($$select public.ask_to_lead(%L, %L)$$, t.id('floated'), t.id('asked')));
reset role;
select t.login('asked'); set role authenticated;
select t.must_refuse('a member asking someone to lead an idea that isn''t theirs', format($$select public.ask_to_lead(%L, %L)$$, t.id('floated'), t.id('taker')));
select t.must_refuse('writing an ask directly', format($$insert into lead_asks (spark_id, user_id, asked_by) values (%L, %L, %L)$$, t.id('floated'), t.id('asked'), t.id('asked')));
reset role;
select t.login('floater'); set role authenticated;
select t.must_refuse('asking someone outside the event''s groups', format($$select public.ask_to_lead(%L, %L)$$, t.id('floated'), t.id('stranger')));
select t.must_refuse('asking yourself', format($$select public.ask_to_lead(%L, %L)$$, t.id('floated'), t.id('floater')));
select t.must_refuse('asking about a plan', format($$select public.ask_to_lead((select id from sparks where text = 'Plan not floated'), %L)$$, t.id('asked')));
select t.must_allow('the floater asks a member to lead, with a note', format($$select public.ask_to_lead(%L, %L, 'You ran the last one so well')$$, t.id('floated'), t.id('asked')));
select t.check('the ask keeps its note', (select message = 'You ran the last one so well' from lead_asks where spark_id = t.id('floated') and user_id = t.id('asked')));
select t.must_allow('asking the same person again changes nothing', format($$select public.ask_to_lead(%L, %L)$$, t.id('floated'), t.id('asked')));
select t.check('the floater sees one ask', (select count(*) = 1 from lead_asks where spark_id = t.id('floated') and user_id = t.id('asked')));
select t.must_allow('the floater asks about a second idea', format($$select public.ask_to_lead(%L, %L)$$, t.id('floated_back'), t.id('asked')));
select t.must_allow('the floater takes that one back', format($$select public.set_wants_host(%L, false)$$, t.id('floated_back')));
reset role;
select t.check('taking it back clears its asks', not exists (select 1 from lead_asks where spark_id = t.id('floated_back')));
select t.login('taker'); set role authenticated;
select t.check('another member doesn''t see the ask', not exists (select 1 from lead_asks where spark_id = t.id('floated')));
reset role;
select t.login('asked'); set role authenticated;
select t.check('the person asked sees it', exists (select 1 from lead_asks where spark_id = t.id('floated') and user_id = t.id('asked')));
select t.check('and gets it in load_all', public.load_all() -> 'lead_asks' @> jsonb_build_array(jsonb_build_object('spark_id', t.id('floated'), 'user_id', t.id('asked'))));
select t.must_refuse('deleting an ask directly', format($$delete from lead_asks where spark_id = %L$$, t.id('floated')));
select t.must_allow('the person asked takes the lead', format($$select public.take_the_lead(%L)$$, t.id('floated')));
reset role;
select t.check('they lead it, and its asks are gone',
  (select lead_id = t.id('asked') and not wants_host from sparks where id = t.id('floated'))
  and not exists (select 1 from lead_asks where spark_id = t.id('floated')));

-- Answering, withdrawing and handing back (20261111000000_idea_handoffs.sql) ----------------------------------------
select t.login('floater'); set role authenticated;
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, wants_host)
values (gen_random_uuid(), t.id('g'), 'Floater', 'Floater', t.id('floater'), t.id('floater'), 'Declined idea', true);
reset role;
insert into t.ids select 'declined', id from sparks where text = 'Declined idea';
select t.login('floater'); set role authenticated;
select t.must_allow('the floater asks', format($$select public.ask_to_lead(%L, %L)$$, t.id('declined'), t.id('asked')));
select t.must_allow('and asks a second person', format($$select public.ask_to_lead(%L, %L)$$, t.id('declined'), t.id('taker')));
select t.must_allow('then takes the second ask back', format($$select public.withdraw_lead_ask(%L, %L)$$, t.id('declined'), t.id('taker')));
reset role;
select t.check('the withdrawn ask is gone', not exists (select 1 from lead_asks where spark_id = t.id('declined') and user_id = t.id('taker')));
select t.login('stranger'); set role authenticated;
select t.must_refuse('someone else withdrawing an ask', format($$select public.withdraw_lead_ask(%L, %L)$$, t.id('declined'), t.id('asked')));
select t.must_refuse('answering an ask nobody made', format($$select public.answer_lead_ask(%L, false)$$, t.id('declined')));
reset role;
select t.login('asked'); set role authenticated;
select t.must_allow('the person asked says no', format($$select public.answer_lead_ask(%L, false)$$, t.id('declined')));
reset role;
select t.check('a no clears the ask, the idea still looks, and the floater gets a note',
  not exists (select 1 from lead_asks where spark_id = t.id('declined'))
  and (select wants_host and lead_id = t.id('floater') from sparks where id = t.id('declined'))
  and exists (select 1 from notes where user_id = t.id('floater') and body like '% can’t lead Declined idea right now.%'));
select t.login('floater'); set role authenticated;
select t.must_allow('the floater asks again', format($$select public.ask_to_lead(%L, %L)$$, t.id('declined'), t.id('asked')));
reset role;
insert into interests (spark_id, user_id) values (t.id('declined'), t.id('taker'));
select t.login('asked'); set role authenticated;
select t.must_allow('the person asked says yes', format($$select public.answer_lead_ask(%L, true)$$, t.id('declined')));
reset role;
select t.check('a yes makes them the lead, thanks the floater and tells the people interested',
  (select lead_id = t.id('asked') and not wants_host from sparks where id = t.id('declined'))
  and exists (select 1 from notes where user_id = t.id('floater') and body like '%is leading Declined idea. Thanks for floating it!%')
  and exists (select 1 from notes where user_id = t.id('taker') and body like '%is leading Declined idea now.%'));
select t.login('asked'); set role authenticated;
select t.must_allow('the new lead picks a date', format($$update sparks set day_date = current_date + 9 where id = %L$$, t.id('declined')));
reset role;
select t.check('the people interested hear about the date', exists (select 1 from notes where user_id = t.id('taker') and body like '% picked % for Declined idea.%'));
select t.login('asked'); set role authenticated;
select t.check('stepping back from an idea they took over', public.step_back(t.id('declined')) = 'idea');
reset role;
select t.check('it goes back to the floater, looking for a lead again, and the one stepping back stays interested',
  (select lead_id = t.id('floater') and wants_host from sparks where id = t.id('declined'))
  and exists (select 1 from interests where spark_id = t.id('declined') and user_id = t.id('asked'))
  and exists (select 1 from notes where user_id = t.id('floater') and body like '%you can choose one.%'));

-- First-run flags on the account (20261112000000_seen_on_account.sql) ------------------------------------------------
select t.login('floater'); set role authenticated;
select t.must_allow('saving your own seen flags', $$insert into notif_state (user_id, seen) values (auth.uid(), '{"swipe": 1}')$$);
select t.must_allow('updating them', $$update notif_state set seen = '{"swipe": 1, "fbAsked": 1}' where user_id = auth.uid()$$);
select t.must_refuse('seen that isn''t an object', $$update notif_state set seen = '[1]' where user_id = auth.uid()$$);
reset role;
select t.login('asked'); set role authenticated;
select t.check('someone else''s flags stay hidden', not exists (select 1 from notif_state where user_id = t.id('floater')));
reset role;

-- Feedback carries its context and an optional screenshot (20261102030000_feedback_context.sql) ------------------------
select t.person('fbsender');
select t.login('fbsender'); set role authenticated;
select t.must_allow('feedback with its context', $$insert into feedback (body, screen, context) values ('Works', 'calendar', '{"device": "iPhone · iOS 26 · Safari", "taps": []}')$$);
select t.must_allow('feedback with a screenshot in your own folder', format($$insert into feedback (body, shot) values ('Look', %L)$$, t.id('fbsender') || '/11111111-1111-1111-1111-111111111111.jpg'));
select t.must_refuse('feedback pointing at someone else''s screenshot', format($$insert into feedback (body, shot) values ('Look', %L)$$, t.id('host') || '/11111111-1111-1111-1111-111111111111.jpg'));
select t.must_refuse('a screenshot path of the wrong shape', $$insert into feedback (body, shot) values ('Look', '../x.jpg')$$);
select t.must_refuse('context that isn''t an object', $$insert into feedback (body, context) values ('x', '[1, 2]')$$);
select t.must_refuse('a huge context', $$insert into feedback (body, context) values ('x', jsonb_build_object('pad', repeat('a', 9000)))$$);
select t.must_allow('a screenshot upload to your own folder', format($$insert into storage.objects (bucket_id, name, owner) values ('feedback-shots', %L, %L)$$, t.id('fbsender') || '/22222222-2222-2222-2222-222222222222.jpg', t.id('fbsender')));
select t.must_refuse('a screenshot upload to someone else''s folder', format($$insert into storage.objects (bucket_id, name) values ('feedback-shots', %L)$$, t.id('host') || '/33333333-3333-3333-3333-333333333333.jpg'));
select t.check('the sender sees their own screenshot', exists (select 1 from storage.objects where bucket_id = 'feedback-shots' and name like t.id('fbsender') || '/%'));
reset role;
select t.login('host'); set role authenticated;
select t.check('someone else can''t see it', not exists (select 1 from storage.objects where bucket_id = 'feedback-shots'));
reset role;
select t.check('the screenshot bucket is private', (select not public from storage.buckets where id = 'feedback-shots'));

-- Guests can send feedback too, 3 an hour, named from their guest RSVP, with no screenshot (20261113000000_guest_feedback.sql)
select t.person('fbguest', true);
select t.login('fbguest'); set role authenticated;
select t.must_allow('a guest sends feedback', $$insert into feedback (body, screen) values ('Love it', 'detail')$$);
select t.must_refuse('a guest''s feedback can''t carry a screenshot', format($$insert into feedback (body, shot) values ('Look', %L)$$, t.id('fbguest') || '/44444444-4444-4444-4444-444444444444.jpg'));
select t.must_allow('a second note', $$insert into feedback (body) values ('Two')$$);
select t.must_allow('a third note', $$insert into feedback (body) values ('Three')$$);
select t.must_refuse('a guest''s fourth note in an hour', $$insert into feedback (body) values ('Four')$$);
select t.must_refuse('a guest can''t send feedback as someone else', format($$insert into feedback (body, user_id) values ('Forged', %L)$$, t.id('fbsender')));
reset role;
select t.check('a guest with no RSVP name is called Guest', (select name from feedback where user_id = t.id('fbguest') and body = 'Love it') = 'Guest');

-- Ten an hour, except the e2e leads (20261102060000_feedback_cap_exempt.sql)
select t.person('chatty'), t.person('exempt');
insert into private.rate_exempt (user_id) values (t.id('exempt'));
select t.login('chatty'); set role authenticated;
do $c$ begin for i in 1..10 loop insert into feedback (body) values ('Note ' || i); end loop; end $c$;
select t.must_refuse('an eleventh note in an hour', $$insert into feedback (body) values ('One more')$$);
reset role;
select t.login('exempt'); set role authenticated;
do $c$ begin for i in 1..11 loop insert into feedback (body) values ('Note ' || i); end loop; end $c$;
reset role;
select t.check('an exempt account isn''t capped', (select count(*) = 11 from feedback where user_id = t.id('exempt')));

-- One request loads the app (20261101220000_load_all.sql): the same rows the caller could read table by table ----
create function t.load_matches() returns boolean language sql as $$
  select jsonb_array_length(d -> 'memberships') = (select count(*) from memberships)
     and jsonb_array_length(d -> 'groups') = (select count(*) from groups)
     and jsonb_array_length(d -> 'sparks') = (select count(*) from sparks)
     and jsonb_array_length(d -> 'offers') = (select count(*) from offers)
     and jsonb_array_length(d -> 'interests') = (select count(*) from interests)
     and jsonb_array_length(d -> 'guest_contacts') = (select count(*) from guest_contacts)
     and jsonb_array_length(d -> 'rsvps') = (select count(*) from rsvps)
     and jsonb_array_length(d -> 'date_options') = (select count(*) from date_options)
     and jsonb_array_length(d -> 'date_votes') = (select count(*) from date_votes)
     and jsonb_array_length(d -> 'spot_options') = (select count(*) from spot_options)
     and jsonb_array_length(d -> 'spot_votes') = (select count(*) from spot_votes)
     and jsonb_array_length(d -> 'signup_items') = (select count(*) from signup_items)
     and jsonb_array_length(d -> 'signup_claims') = (select count(*) from signup_claims)
     and jsonb_array_length(d -> 'signup_waits') = (select count(*) from signup_waits)
     and jsonb_array_length(d -> 'plan_updates') = (select count(*) from plan_updates)
     and jsonb_array_length(d -> 'cohosts') = (select count(*) from cohosts)
     and jsonb_array_length(d -> 'album_photos') = (select count(*) from album_photos)
     and jsonb_array_length(d -> 'plan_prep') = (select count(*) from plan_prep)
     and jsonb_array_length(d -> 'reactions') = (select count(*) from reactions)
     and jsonb_array_length(d -> 'spark_groups') = (select count(*) from spark_groups)
     and jsonb_array_length(d -> 'event_drafts') = (select count(*) from event_drafts)
     and jsonb_array_length(d -> 'notes') = least(50, (select count(*) from notes))
     and jsonb_array_length(d -> 'lead_asks') = (select count(*) from lead_asks)
     and jsonb_array_length(d -> 'event_invites') = (select count(*) from event_invites)
     and jsonb_array_length(d -> 'job_asks') = (select count(*) from job_asks)
     and jsonb_array_length(d -> 'lead_offers') = (select count(*) from lead_offers)
     and not exists (select 1 from jsonb_array_elements(d -> 'profiles') e where (e ->> 'id')::uuid not in (select id from profiles))
    from (select public.load_all() as d) x
$$;
grant execute on function t.load_matches() to authenticated, anon;
select t.check('load_all reads as the caller, not as its owner', (select not prosecdef from pg_proc where oid = 'public.load_all()'::regprocedure));
select t.check('someone with no session can''t call load_all', not has_function_privilege('anon', 'public.load_all()', 'execute'));
select t.login('host'); set role authenticated;
select t.check('the host''s load_all holds what the host can read', t.load_matches());
select t.check('the host gets the invite-only plan', public.load_all() -> 'sparks' @> jsonb_build_array(jsonb_build_object('id', t.id('invite_plan'))));
select t.check('the host gets the guest''s name on it', public.load_all() -> 'guest_contacts' @> jsonb_build_array(jsonb_build_object('spark_id', t.id('invite_plan'), 'user_id', t.id('guest'))));
select t.check('an account gets its friends list', jsonb_typeof(public.load_all() -> 'friend_state' -> 'friends') = 'array');
reset role;
select t.login('member'); set role authenticated;
select t.check('a member''s load_all holds what the member can read', t.load_matches());
select t.check('a member doesn''t get a guest''s name', not (public.load_all() -> 'guest_contacts' @> jsonb_build_array(jsonb_build_object('user_id', t.id('guest')))));
reset role;
select t.login('outsider'); set role authenticated;
select t.check('an outsider''s load_all holds what the outsider can read', t.load_matches());
select t.check('an outsider gets none of the group''s events',
  not exists (select 1 from jsonb_array_elements(public.load_all() -> 'sparks') e where (e ->> 'group_id')::uuid = t.id('g')));
select t.check('an outsider doesn''t get the group', not (public.load_all() -> 'groups' @> jsonb_build_array(jsonb_build_object('id', t.id('g')))));
reset role;
select t.login('guest'); set role authenticated;
select t.check('a guest''s load_all holds what the guest can read', t.load_matches());
select t.check('a guest gets the event they hold a link to, and their own name',
  public.load_all() -> 'sparks' @> jsonb_build_array(jsonb_build_object('id', t.id('invite_plan')))
  and public.load_all() -> 'profiles' @> jsonb_build_array(jsonb_build_object('id', t.id('guest'))));
select t.check('a guest gets no friends list', public.load_all() -> 'friend_state' = 'null'::jsonb);
reset role;

-- Soft holds and No help needed (20261103000000_soft_holds.sql) ---------------------------------------
select t.login('host'); set role authenticated;
insert into sparks (group_id, author_name, lead_name, lead_id, created_by, text, hold_until, hold_nudged_at)
values (t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Poll idea', '2030-01-01', now());
reset role;
insert into t.ids select 'poll_idea', id from sparks where text = 'Poll idea';
select t.check('posting can''t set a hold or the nudge stamp', (select hold_until is null and hold_nudged_at is null from sparks where id = t.id('poll_idea')));
select t.login('host'); set role authenticated;
insert into date_options (spark_id, day_date, who) values (t.id('poll_idea'), current_date + 10, 'Host');
reset role;
select t.check('the poll''s first date holds it for 7 days',
  (select hold_until = (now() at time zone 'America/Chicago')::date + 7 from sparks where id = t.id('poll_idea')));
select t.login('host'); set role authenticated;
select t.must_refuse('the lead setting the hold by hand', format($$update sparks set hold_until = '2030-01-01' where id = %L$$, t.id('poll_idea')));
select t.must_allow('the lead keeps holding', format($$select public.keep_holding(%L)$$, t.id('poll_idea')));
reset role;
select t.check('keep holding adds 7 days to the hold (20261120000000)',
  (select hold_until = (now() at time zone 'America/Chicago')::date + 14 from sparks where id = t.id('poll_idea')));
select t.login('host'); set role authenticated;
select public.keep_holding(t.id('poll_idea')); select public.keep_holding(t.id('poll_idea')); select public.keep_holding(t.id('poll_idea'));
reset role;
select t.check('keep holding stops 30 days out',
  (select hold_until = (now() at time zone 'America/Chicago')::date + 30 from sparks where id = t.id('poll_idea')));
select t.login('host'); set role authenticated;
select t.must_allow('the lead says no help needed', format($$update sparks set no_help = true where id = %L$$, t.id('poll_idea')));
reset role;
select t.login('member'); set role authenticated;
select t.must_refuse('a member keeping the dates held', format($$select public.keep_holding(%L)$$, t.id('poll_idea')));
select t.must_refuse('a member saying no help needed', format($$update sparks set no_help = false where id = %L$$, t.id('poll_idea')));
reset role;
select t.check('the daily job runs with the hold reminders', (select private.push_daily() is null or true));
select t.check('joining Torrez Fitness adds no other group', not exists (select 1 from join_also j join groups g on g.id = j.group_id where g.code = 'TORREZ'));

-- What to expect's overview (20261103030000_what_to_expect.sql) ------------------------------------------
select t.login('host'); set role authenticated;
select t.must_allow('the lead writes an overview', format($$update sparks set overview = 'Games and food with whoever shows up' where id = %L$$, t.id('poll_idea')));
select t.must_allow('an overview of 200 characters (120 until 20261120000000)', format($$update sparks set overview = repeat('x', 200) where id = %L$$, t.id('poll_idea')));
select t.must_refuse('an overview over 200 characters', format($$update sparks set overview = repeat('x', 201) where id = %L$$, t.id('poll_idea')));
select t.must_allow('the lead writes an overview again', format($$update sparks set overview = 'Games and food with whoever shows up' where id = %L$$, t.id('poll_idea')));
reset role;
select t.login('member'); set role authenticated;
select t.must_refuse('a member writing the overview', format($$update sparks set overview = 'Mine now' where id = %L$$, t.id('poll_idea')));
select t.must_refuse('a member editing through admin_edit_spark', format($$select public.admin_edit_spark(%L, 'Poll idea', '{}', 'Mine now')$$, t.id('poll_idea')));
reset role;
select t.check('the overview is the lead''s', (select overview = 'Games and food with whoever shows up' from sparks where id = t.id('poll_idea')));

-- Discussion (20261105000000_event_comments.sql): read by anyone who can see the plan; written by hosts and people
-- coming; one level of replies (under a comment or an update); authors and hosts delete; nobody edits ----------------
reset role;
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date) values
  (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Chat walk', 'group', true, current_date + 6);
insert into t.ids select 'chat_walk', id from sparks where text = 'Chat walk';
insert into plan_updates (spark_id, body, created_by) values (t.id('chat_walk'), 'Meet at the gate', t.id('host'));
insert into t.ids select 'chat_upd', id from plan_updates where spark_id = t.id('chat_walk');
select t.login('member'); set role authenticated;
select t.must_refuse('a member who hasn''t replied comments', format($$insert into event_comments (spark_id, body) values (%L, 'Hi!')$$, t.id('chat_walk')));
select t.must_allow('a member says Going', format($$insert into rsvps (spark_id, user_id, status) values (%L, %L, 'going')$$, t.id('chat_walk'), t.id('member')));
select t.must_allow('someone going comments', format($$insert into event_comments (spark_id, body) values (%L, 'Is there parking?')$$, t.id('chat_walk')));
select t.must_refuse('commenting as someone else', format($$insert into event_comments (spark_id, body, created_by) values (%L, 'Hi', %L)$$, t.id('chat_walk'), t.id('host')));
select t.must_refuse('an empty comment', format($$insert into event_comments (spark_id, body) values (%L, '   ')$$, t.id('chat_walk')));
select t.must_refuse('a comment over 500 characters', format($$insert into event_comments (spark_id, body) values (%L, repeat('x', 501))$$, t.id('chat_walk')));
select t.must_allow('a reply under the lead''s update', format($$insert into event_comments (spark_id, update_id, body) values (%L, %L, 'Which gate?')$$, t.id('chat_walk'), t.id('chat_upd')));
reset role;
insert into t.ids select 'chat_c1', id from event_comments where body = 'Is there parking?';
select t.login('host'); set role authenticated;
select t.must_allow('the lead replies', format($$insert into event_comments (spark_id, parent_id, body) values (%L, %L, 'The lot on 51st')$$, t.id('chat_walk'), t.id('chat_c1')));
reset role;
insert into t.ids select 'chat_r1', id from event_comments where body = 'The lot on 51st';
select t.login('member'); set role authenticated;
select t.must_refuse('a reply to a reply', format($$insert into event_comments (spark_id, parent_id, body) values (%L, %L, 'Thanks')$$, t.id('chat_walk'), t.id('chat_r1')));
select t.must_refuse('editing a comment', format($$update event_comments set body = 'Edited' where id = %L$$, t.id('chat_c1')));
select t.must_refuse('deleting the lead''s reply', format($$delete from event_comments where id = %L$$, t.id('chat_r1')));
select t.check('a member reads the discussion', (select count(*) from event_comments where spark_id = t.id('chat_walk')) = 3);
reset role;
select t.login('outsider'); set role authenticated;
select t.check('an outsider reads none of it', (select count(*) from event_comments where spark_id = t.id('chat_walk')) = 0);
select t.must_refuse('an outsider comments', format($$insert into event_comments (spark_id, body) values (%L, 'Hello')$$, t.id('chat_walk')));
reset role;
-- Likes (20261121010000_post_likes.sql): people in the discussion like a comment or an update; you unlike your own
select t.login('member'); set role authenticated;
select t.must_allow('someone going likes a comment', format($$insert into post_likes (target_id, spark_id) values (%L, %L)$$, t.id('chat_c1'), t.id('chat_walk')));
select t.must_allow('...and the lead''s update', format($$insert into post_likes (target_id, spark_id) values (%L, %L)$$, t.id('chat_upd'), t.id('chat_walk')));
select t.must_refuse('liking twice', format($$insert into post_likes (target_id, spark_id) values (%L, %L)$$, t.id('chat_c1'), t.id('chat_walk')));
select t.must_refuse('liking as someone else', format($$insert into post_likes (target_id, spark_id, user_id) values (%L, %L, %L)$$, t.id('chat_r1'), t.id('chat_walk'), t.id('host')));
select t.must_refuse('liking something that isn''t on the event', format($$insert into post_likes (target_id, spark_id) values (gen_random_uuid(), %L)$$, t.id('chat_walk')));
select t.check('a member reads the likes', (select count(*) from post_likes where spark_id = t.id('chat_walk')) = 2);
reset role;
select t.login('outsider'); set role authenticated;
select t.check('an outsider reads no likes', (select count(*) from post_likes where spark_id = t.id('chat_walk')) = 0);
select t.must_refuse('an outsider likes', format($$insert into post_likes (target_id, spark_id) values (%L, %L)$$, t.id('chat_c1'), t.id('chat_walk')));
reset role;
select t.login('member'); set role authenticated;
select t.must_allow('unliking your own', format($$delete from post_likes where target_id = %L$$, t.id('chat_upd')));
select t.check('...and it is gone', (select count(*) from post_likes where spark_id = t.id('chat_walk')) = 1);
reset role;
select t.login('host'); set role authenticated;
select t.must_allow('the lead deletes a comment on their plan', format($$delete from event_comments where id = %L$$, t.id('chat_c1')));
reset role;
select t.check('its replies go with it', not exists (select 1 from event_comments where id = t.id('chat_r1')));
select t.login('member'); set role authenticated;
select t.must_allow('you delete your own', format($$delete from event_comments where spark_id = %L and created_by = %L$$, t.id('chat_walk'), t.id('member')));
reset role;

-- Take part (20261106000000_take_part.sql): spots with a waitlist and a per-person cap; guests claim with a phone ----
reset role;
select t.person('player1'), t.person('player2'), t.person('player3'), t.person('guest2', true);
insert into memberships (group_id, user_id, role) values
  (t.id('g'), t.id('player1'), 'member'), (t.id('g'), t.id('player2'), 'member'), (t.id('g'), t.id('player3'), 'member');
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date) values
  (gen_random_uuid(), t.id('g'), 'Host', 'Host', t.id('host'), t.id('host'), 'Open play', 'group', true, current_date + 5);
insert into t.ids select 'play', id from sparks where text = 'Open play';
insert into link_access (user_id, spark_id) values (t.id('guest2'), t.id('play'));
select t.login('member'); set role authenticated;
select t.must_refuse('a member adding a spot', format($$insert into signup_items (spark_id, item, kind) values (%L, 'Court time', 'seat')$$, t.id('play')));
reset role;
select t.login('host'); set role authenticated;
select t.must_allow('the lead adds court times (a time spot with two rows)',
  format($$insert into signup_items (spark_id, item, kind, per_person) values (%L, 'Court time', 'time', 1)$$, t.id('play')));
reset role;
insert into t.ids select 'court', id from signup_items where item = 'Court time' and shift_of is null;
select t.login('host'); set role authenticated;
select t.must_allow('its first time', format($$insert into signup_items (spark_id, item, kind, shift_of, time, end_time, need) values (%L, 'Court time', 'time', %L, '09:00', '09:30', 1)$$, t.id('play'), t.id('court')));
select t.must_allow('its second time', format($$insert into signup_items (spark_id, item, kind, shift_of, time, end_time, need) values (%L, 'Court time', 'time', %L, '09:30', '10:00', 1)$$, t.id('play'), t.id('court')));
select t.must_refuse('a time row of another kind', format($$insert into signup_items (spark_id, item, kind, shift_of, time, need) values (%L, 'Court time', 'job', %L, '10:00', 1)$$, t.id('play'), t.id('court')));
reset role;
insert into t.ids select 'c900', id from signup_items where shift_of = t.id('court') and time = '09:00';
insert into t.ids select 'c930', id from signup_items where shift_of = t.id('court') and time = '09:30';
select t.login('player1'); set role authenticated;
select t.must_allow('a member claims 9:00', format($$insert into signup_claims (item_id) values (%L)$$, t.id('c900')));
select t.must_refuse('a second time past the cap of 1', format($$insert into signup_claims (item_id) values (%L)$$, t.id('c930')));
select t.must_refuse('the waitlist for a time with room', format($$insert into signup_waits (item_id) values (%L)$$, t.id('c930')));
reset role;
select t.login('player2'); set role authenticated;
select t.must_refuse('claiming a full time', format($$insert into signup_claims (item_id) values (%L)$$, t.id('c900')));
select t.must_refuse('jumping the line with an old created_at', format($$insert into signup_waits (item_id, created_at) values (%L, now() - interval '1 day')$$, t.id('c900')));
select t.must_allow('joining the full time''s waitlist', format($$insert into signup_waits (item_id) values (%L)$$, t.id('c900')));
reset role;
select t.login('player3'); set role authenticated;
select t.must_allow('a second person in line', format($$insert into signup_waits (item_id) values (%L)$$, t.id('c900')));
select t.check('people see the line', (select count(*) from signup_waits where item_id = t.id('c900')) = 2);
reset role;
update signup_claims set created_at = now() - interval '10 minutes' where item_id = t.id('c900');
select t.login('player1'); set role authenticated;
select t.must_allow('the holder gives it up', format($$delete from signup_claims where item_id = %L and user_id = auth.uid()$$, t.id('c900')));
reset role;
select t.check('the first in line moved up', exists (select 1 from signup_claims where item_id = t.id('c900') and user_id = t.id('player2')));
select t.check('and left the line', not exists (select 1 from signup_waits where item_id = t.id('c900') and user_id = t.id('player2')));
select t.check('and is going', exists (select 1 from rsvps where spark_id = t.id('play') and user_id = t.id('player2') and status = 'going'));
select t.check('they heard about it', exists (select 1 from notes where user_id = t.id('player2') and body like 'You’re in: 9:00am court time opened up%'));
select t.check('as a bell line only: the push goes out directly, once (20261118000000)', (select bool_and(quiet) from notes where user_id = t.id('player2') and body like 'You’re in: 9:00am court time opened up%'));
select t.check('the lead heard who gave it up and who moved up', exists (select 1 from notes where user_id = t.id('host') and body like '% gave up 9:00am. % moved up.%'));
select t.check('the second is still in line', exists (select 1 from signup_waits where item_id = t.id('c900') and user_id = t.id('player3')));
select t.login('player1'); set role authenticated;
select t.must_refuse('taking someone else off', format($$select public.remove_part_claim(%L, %L)$$, t.id('c900'), t.id('player2')));
reset role;
select t.login('host'); set role authenticated;
select t.must_allow('the lead takes someone off', format($$select public.remove_part_claim(%L, %L)$$, t.id('c900'), t.id('player2')));
reset role;
select t.check('they''re told', exists (select 1 from notes where user_id = t.id('player2') and body like '% took you off 9:00am court time%'));
select t.check('with one push, not two (quiet note, 20261118000000)', (select bool_and(quiet) from notes where user_id = t.id('player2') and body like '% took you off 9:00am court time%'));
select t.check('and the next in line moves up', exists (select 1 from signup_claims where item_id = t.id('c900') and user_id = t.id('player3')));
-- Guests: a spot with a name and phone, never a job
insert into signup_items (spark_id, item, kind, need, created_by) values (t.id('play'), 'Beginner clinic', 'seat', 8, t.id('host'));
insert into signup_items (spark_id, item, need, created_by) values (t.id('play'), 'Bring balls', 2, t.id('host'));
insert into t.ids select 'clinic', id from signup_items where item = 'Beginner clinic';
insert into t.ids select 'balls', id from signup_items where item = 'Bring balls';
select t.login('guest2'); set role authenticated;
select t.must_allow('a guest leaves a name only', format($$insert into guest_contacts (spark_id, user_id, name) values (%L, %L, 'Sam')$$, t.id('play'), t.id('guest2')));
select t.must_refuse('a guest claims a seat without a phone', format($$insert into signup_claims (item_id) values (%L)$$, t.id('clinic')));
select t.must_allow('a guest adds a phone', format($$update guest_contacts set phone = '512-555-0100' where spark_id = %L and user_id = %L$$, t.id('play'), t.id('guest2')));
select t.must_allow('then claims a seat', format($$insert into signup_claims (item_id) values (%L)$$, t.id('clinic')));
-- One kind of sign-up (20261119000000_one_kind_of_signup.sql): a guest with a phone can take a job too, unless its
-- guests option is off
select t.must_allow('a guest can take a job too now', format($$insert into signup_claims (item_id) values (%L)$$, t.id('balls')));
reset role;
insert into signup_items (spark_id, item, need, guests, created_by) values (t.id('play'), 'Run the till', 1, false, t.id('host'));
insert into t.ids select 'till', id from signup_items where item = 'Run the till';
select t.login('guest2'); set role authenticated;
select t.must_refuse('but not one with guests off', format($$insert into signup_claims (item_id) values (%L)$$, t.id('till')));
reset role;
-- Jobs get waitlists and per-person limits like spots
update signup_items set waitlist = true where id = t.id('till');
select t.login('player2'); set role authenticated;
select t.must_allow('a member takes the one till spot', format($$insert into signup_claims (item_id) values (%L)$$, t.id('till')));
reset role;
select t.login('player3'); set role authenticated;
select t.must_allow('a full job with a waitlist takes a waiter', format($$insert into signup_waits (item_id) values (%L)$$, t.id('till')));
reset role;
update signup_claims set created_at = now() - interval '10 minutes' where item_id = t.id('till');
select t.login('player2'); set role authenticated;
select t.must_allow('the holder gives the job up', format($$delete from signup_claims where item_id = %L and user_id = auth.uid()$$, t.id('till')));
reset role;
select t.check('the first in line moves up on a job too', exists (select 1 from signup_claims where item_id = t.id('till') and user_id = t.id('player3')));
insert into signup_items (spark_id, item, need, per_person, created_by) values (t.id('play'), 'Hand out flyers', 5, 1, t.id('host'));
insert into t.ids select 'flyers', id from signup_items where item = 'Hand out flyers';
insert into signup_items (spark_id, item, shift_of, time, need, created_by) select spark_id, item, id, t, 2, created_by from signup_items, (values (time '09:00'), (time '10:00')) v(t) where id = t.id('flyers');
select t.login('player2'); set role authenticated;
select t.must_allow('one flyer shift', format($$insert into signup_claims (item_id) values ((select id from signup_items where shift_of = %L and time = '09:00'))$$, t.id('flyers')));
select t.must_refuse('a second shift over the job''s per-person limit', format($$insert into signup_claims (item_id) values ((select id from signup_items where shift_of = %L and time = '10:00'))$$, t.id('flyers')));
reset role;
-- Moving a time tells the people holding it, and their reminder goes again (20261118000000, jobs audit M3)
update signup_claims set reminded_at = now() where item_id = t.id('c900');
select t.login('host'); set role authenticated;
select t.must_allow('the lead moves 9:00 to 9:15', format($$update signup_items set "time" = '09:15' where id = %L$$, t.id('c900')));
reset role;
select t.check('the holder hears it moved', exists (select 1 from notes where user_id = t.id('player3') and body like '% moved: 9:00am → 9:15am (%' and quiet));
select t.check('and gets the reminder again', not exists (select 1 from signup_claims where item_id = t.id('c900') and reminded_at is not null));
select t.check('the lead hears nothing about their own change', not exists (select 1 from notes where user_id = t.id('host') and body like '% moved: 9:00am → 9:15am%'));
update signup_items set "time" = '09:00' where id = t.id('c900');
-- Removing a time tells the people holding it
select t.login('host'); set role authenticated;
select t.must_allow('the lead removes 9:00', format($$select public.remove_signup(%L)$$, t.id('c900')));
reset role;
select t.check('the holder hears 9:00am court time was removed', exists (select 1 from notes where user_id = t.id('player3') and body like '9:00am court time was removed%'));

-- Float an idea: Talk it through, Who leads it, day parts (20261107000000_float_sheet.sql) ------------------------------
select t.person('starter8'), t.person('talker8'), t.person('outsider8');
insert into memberships (group_id, user_id, role) values (t.id('g'), t.id('starter8'), 'member'), (t.id('g'), t.id('talker8'), 'member');
select t.login('starter8'); set role authenticated;
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, wants_host, overview)
values (gen_random_uuid(), t.id('g'), 'Starter', 'Starter', t.id('starter8'), t.id('starter8'), 'Floated kite day', true, repeat('k', 120));
reset role;
insert into t.ids select 'kite', id from sparks where text = 'Floated kite day';
select t.check('a floated idea starts with Talk it through off and I decide', (select not talk and lead_rule = 'me' from sparks where id = t.id('kite')));
select t.login('starter8'); set role authenticated;
select t.must_refuse('a description over 200 characters (120 until 20261120000000)', format($$update sparks set overview = %L where id = %L$$, repeat('k', 201), t.id('kite')));
select t.must_refuse('a lead rule that isn''t me or any', format($$update sparks set lead_rule = 'whoever' where id = %L$$, t.id('kite')));
select t.must_allow('the starter sets Anyone', format($$update sparks set lead_rule = 'any' where id = %L$$, t.id('kite')));
select t.must_allow('a date option for the evening', format($$insert into date_options (spark_id, day_date, day_part, who) values (%L, current_date + 9, 'evening', 'Starter')$$, t.id('kite')));
select t.must_refuse('a day part that isn''t morning, afternoon or evening', format($$insert into date_options (spark_id, day_date, day_part, who) values (%L, current_date + 10, 'night', 'Starter')$$, t.id('kite')));
select t.must_refuse('a day part and a clock time at once', format($$insert into date_options (spark_id, day_date, day_time, day_part, who) values (%L, current_date + 11, '18:00', 'evening', 'Starter')$$, t.id('kite')));
select t.must_refuse('offering to talk through your own idea', format($$select public.offer_to_talk(%L)$$, t.id('kite')));
reset role;
select t.login('talker8'); set role authenticated;
select t.must_refuse('offering to talk while Talk it through is off', format($$select public.offer_to_talk(%L)$$, t.id('kite')));
select t.must_refuse('a member changing Talk it through', format($$update sparks set talk = true where id = %L returning id$$, t.id('kite')));
reset role;
select t.check('…and it stays off', (select not talk from sparks where id = t.id('kite')));
select t.login('starter8'); set role authenticated;
select t.must_allow('the starter turns Talk it through on', format($$update sparks set talk = true where id = %L$$, t.id('kite')));
reset role;
select t.login('outsider8'); set role authenticated;
select t.must_refuse('someone who can''t see the idea offering to talk', format($$select public.offer_to_talk(%L)$$, t.id('kite')));
reset role;
select t.login('talker8'); set role authenticated;
select t.must_refuse('writing a talk offer directly', format($$insert into talk_offers (spark_id, user_id) values (%L, %L)$$, t.id('kite'), t.id('talker8')));
select t.must_allow('a member offers to talk it through', format($$select public.offer_to_talk(%L)$$, t.id('kite')));
select t.must_allow('offering again changes nothing', format($$select public.offer_to_talk(%L)$$, t.id('kite')));
select t.check('the member sees their offer once', (select count(*) = 1 from talk_offers where spark_id = t.id('kite') and user_id = t.id('talker8')));
select t.must_refuse('deleting a talk offer directly', format($$delete from talk_offers where spark_id = %L returning spark_id$$, t.id('kite')));
reset role;
select t.check('the starter got a note', exists (select 1 from notes where user_id = t.id('starter8') and created_by = t.id('talker8') and body like '% would like to talk through Floated kite day with you.'));
select t.check('the offer is still there', exists (select 1 from talk_offers where spark_id = t.id('kite') and user_id = t.id('talker8')));
select t.login('starter8'); set role authenticated;
select t.check('the starter sees the offer', exists (select 1 from talk_offers where spark_id = t.id('kite') and user_id = t.id('talker8')));
select t.check('and gets it in load_all', public.load_all() -> 'talk_offers' @> jsonb_build_array(jsonb_build_object('spark_id', t.id('kite'), 'user_id', t.id('talker8'))));
select t.check('load_all carries the date option''s day part', public.load_all() -> 'date_options' @> jsonb_build_array(jsonb_build_object('spark_id', t.id('kite'), 'day_part', 'evening')));
reset role;
select t.login('taker'); set role authenticated;
select t.check('another member doesn''t see the offer', not exists (select 1 from talk_offers where spark_id = t.id('kite')));
reset role;

-- Multi-day events (20261108000000_multi_day.sql, Design v8-7) -------------------------------------------------------
select t.person('lead9'), t.person('member9');
insert into memberships (group_id, user_id, role) values (t.id('g'), t.id('lead9'), 'member'), (t.id('g'), t.id('member9'), 'member');
select t.login('lead9'); set role authenticated;
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, planned, day_date, day_time, schedule)
values (gen_random_uuid(), t.id('g'), 'Lead', 'Lead', t.id('lead9'), t.id('lead9'), 'Garage sale weekend', true, current_date + 4, '10:00',
        jsonb_build_object('kind', 'days', 'each', true, 'days', jsonb_build_array(
          jsonb_build_object('d', current_date + 4, 't', '10:00', 'e', '16:00'), jsonb_build_object('d', current_date + 5, 't', '12:00', 'e', '17:00'))));
reset role;
insert into t.ids select 'sale', id from sparks where text = 'Garage sale weekend';
select t.login('lead9'); set role authenticated;
select t.must_refuse('separate days that don''t start on the event''s date', format($$update sparks set schedule = jsonb_build_object('kind', 'days', 'days', jsonb_build_array(jsonb_build_object('d', current_date + 6), jsonb_build_object('d', current_date + 7))) where id = %L$$, t.id('sale')));
select t.must_refuse('separate days out of order', format($$update sparks set schedule = jsonb_build_object('kind', 'days', 'days', jsonb_build_array(jsonb_build_object('d', current_date + 4), jsonb_build_object('d', current_date + 3))) where id = %L$$, t.id('sale')));
select t.must_refuse('a single separate day', format($$update sparks set schedule = jsonb_build_object('kind', 'days', 'days', jsonb_build_array(jsonb_build_object('d', current_date + 4))) where id = %L$$, t.id('sale')));
select t.must_refuse('a span that ends before it starts', format($$update sparks set schedule = '{"kind":"span","to":"2000-01-01"}' where id = %L$$, t.id('sale')));
select t.must_refuse('a repeat that isn''t weekly, every 2 weeks or monthly', format($$update sparks set schedule = '{"kind":"repeat","every":"daily"}' where id = %L$$, t.id('sale')));
select t.must_refuse('a schedule with extra keys', format($$update sparks set schedule = '{"kind":"repeat","every":"week","x":1}' where id = %L$$, t.id('sale')));
select t.must_refuse('a bad time in a day', format($$update sparks set schedule = jsonb_build_object('kind', 'days', 'days', jsonb_build_array(jsonb_build_object('d', current_date + 4, 't', '25:00'), jsonb_build_object('d', current_date + 5))) where id = %L$$, t.id('sale')));
select t.must_allow('the lead makes it weekly', format($$update sparks set schedule = '{"kind":"repeat","every":"week","until":null}' where id = %L$$, t.id('sale')));
select t.must_allow('…and back to separate days', format($$update sparks set schedule = jsonb_build_object('kind', 'days', 'each', true, 'days', jsonb_build_array(jsonb_build_object('d', current_date + 4, 't', '10:00', 'e', '16:00'), jsonb_build_object('d', current_date + 5, 't', '12:00', 'e', '17:00'))) where id = %L$$, t.id('sale')));
select t.must_allow('the lead adds a Sunday job', format($$insert into signup_items (spark_id, item, need, day, created_by) values (%L, 'Pack up', 2, current_date + 5, %L)$$, t.id('sale'), t.id('lead9')));
reset role;
select t.login('member9'); set role authenticated;
select t.must_refuse('a member changing the schedule', format($$update sparks set schedule = null where id = %L returning id$$, t.id('sale')));
select t.must_refuse('a member adding a job tied to a day', format($$insert into signup_items (spark_id, item, day, created_by) values (%L, 'Bring a table', current_date + 4, %L)$$, t.id('sale'), t.id('member9')));
select t.must_allow('a member picks Going Sat, Maybe Sun', format($$insert into rsvps (spark_id, user_id, status, days, maybe_days) values (%L, %L, 'going', array[current_date + 4], array[current_date + 5])$$, t.id('sale'), t.id('member9')));
select t.must_allow('…and changes to both days', format($$update rsvps set days = array[current_date + 4, current_date + 5], maybe_days = '{}' where spark_id = %L and user_id = %L$$, t.id('sale'), t.id('member9')));
select t.check('load_all carries the reply''s days', public.load_all() -> 'rsvps' @> jsonb_build_array(jsonb_build_object('spark_id', t.id('sale'), 'user_id', t.id('member9'), 'days', jsonb_build_array(current_date + 4, current_date + 5))));
select t.check('load_all carries the job''s day', public.load_all() -> 'signup_items' @> jsonb_build_array(jsonb_build_object('spark_id', t.id('sale'), 'item', 'Pack up', 'day', current_date + 5)));
select t.check('load_all carries the schedule', (select (e -> 'schedule' ->> 'kind') = 'days' from jsonb_array_elements(public.load_all() -> 'sparks') e where e ->> 'id' = t.id('sale')::text));
reset role;
select t.check('a separate-days event happens on both days', (select count(*) = 2 from private.event_days(current_date + 4, '10:00', (select schedule from sparks where id = t.id('sale')), current_date + 30)));
select t.check('a weekly event happens every week up to the day asked', (select count(*) = 5 from private.event_days(current_date, null, '{"kind":"repeat","every":"week"}', current_date + 28)));
select t.check('…until its end date', (select count(*) = 2 from private.event_days(current_date, null, jsonb_build_object('kind', 'repeat', 'every', 'week', 'until', current_date + 10), current_date + 28)));
select t.check('a span is reminded once, before its first day', (select count(*) = 1 from private.event_days(current_date, null, jsonb_build_object('kind', 'span', 'to', current_date + 2), current_date + 28)));
select t.login('lead9'); set role authenticated;
select t.must_allow('the lead takes the date off', format($$select public.clear_plan(%L)$$, t.id('sale')));
reset role;
select t.check('…and the schedule goes with it', (select schedule is null from sparks where id = t.id('sale')));

-- Led ideas (20261109000000_led_ideas.sql, Design v8-8) ----------------------------------------------------------------
select t.person('lead10'), t.person('member10'), t.person('guest10', true);
insert into memberships (group_id, user_id, role) values (t.id('g'), t.id('lead10'), 'member'), (t.id('g'), t.id('member10'), 'member'), (t.id('g'), t.id('guest10'), 'member');
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date)
values (gen_random_uuid(), t.id('g'), 'Lead', 'Lead', t.id('lead10'), t.id('lead10'), 'Pumpkin carving night', 'group', false, current_date + 9);
insert into t.ids select 'pumpkin', id from sparks where text = 'Pumpkin carving night';
select t.login('member10'); set role authenticated;
select t.must_refuse('a member who isn''t interested comments on an idea', format($$insert into event_comments (spark_id, body) values (%L, 'Hi!')$$, t.id('pumpkin')));
select t.must_allow('a member says I''m interested', format($$insert into interests (spark_id, user_id) values (%L, %L)$$, t.id('pumpkin'), t.id('member10')));
select t.must_allow('someone interested comments on the idea', format($$insert into event_comments (spark_id, body) values (%L, 'I can bring knives')$$, t.id('pumpkin')));
reset role;
select t.login('guest10'); set role authenticated;
select t.check('a guest without an account reads no comments', (select count(*) from event_comments where spark_id = t.id('pumpkin')) = 0);
select t.check('…but gets the count', public.comment_count(t.id('pumpkin')) = 1);
select t.must_refuse('a guest can''t comment', format($$insert into event_comments (spark_id, body) values (%L, 'Hi')$$, t.id('pumpkin')));
reset role;
select t.login('outsider'); set role authenticated;
select t.check('an outsider gets no count', public.comment_count(t.id('pumpkin')) is null);
reset role;
select t.login('lead10'); set role authenticated;
select t.must_allow('the lead makes it a plan', format($$select public.make_plan(%L)$$, t.id('pumpkin')));
reset role;
select t.check('everyone interested is Maybe now', (select count(*) = 1 and bool_and(status = 'maybe') from rsvps where spark_id = t.id('pumpkin') and user_id <> t.id('lead10')));
select t.check('…and the lead is Going', exists (select 1 from rsvps where spark_id = t.id('pumpkin') and user_id = t.id('lead10') and status = 'going'));

-- Comment pushes (20261109010000_comment_pushes.sql): push_send is swapped for a recorder from here on ---------------
create table t.pushes (users uuid[], topic text, title text, body text, tag text);
grant all on t.pushes to authenticated;
create or replace function private.push_send(p_users uuid[], p_topic text, p_title text, p_body text, p_url text, p_tag text)
returns void language sql security definer set search_path = public as $$ insert into t.pushes values (p_users, p_topic, p_title, p_body, p_tag) $$;
select t.login('member10'); set role authenticated;
select t.must_allow('someone Maybe comments on the plan', format($$insert into event_comments (spark_id, body) values (%L, 'Can I bring my kid?')$$, t.id('pumpkin')));
reset role;
select t.check('the lead hears about the comment', exists (select 1 from t.pushes where t.id('lead10') = any(users) and topic = 'hosting' and tag = 'cm:' || t.id('pumpkin')));
select t.check('…grouped once there are two within the hour', exists (select 1 from t.pushes where body = '2 new comments'));
insert into t.ids select 'kid_q', id from event_comments where body = 'Can I bring my kid?';
delete from t.pushes;
select t.login('lead10'); set role authenticated;
select t.must_allow('the lead replies', format($$insert into event_comments (spark_id, parent_id, body) values (%L, %L, 'Of course!')$$, t.id('pumpkin'), t.id('kid_q')));
reset role;
select t.check('the comment''s author hears about the reply', exists (select 1 from t.pushes where users = array[t.id('member10')] and topic = 'updates' and body like '%replied: Of course!'));
select t.check('the lead isn''t told about their own reply', not exists (select 1 from t.pushes where t.id('lead10') = any(users)));

-- Short links (20261109020000_link_codes.sql) ------------------------------------------------------------------------
select t.check('every event has a link code', not exists (select 1 from sparks where link_code is null or link_code !~ '^[a-z0-9]{8}$'));
select t.check('codes aren''t made from the id', not exists (select 1 from sparks where position(link_code in id::text) > 0));
create table t.code as select link_code from sparks where id = t.id('pumpkin');
grant select on t.code to authenticated;
select t.login('lead10'); set role authenticated;
select t.must_refuse('the lead changing the code', format($$update sparks set link_code = 'mycode99' where id = %L and link_code = 'mycode99' returning id$$, t.id('pumpkin')));
reset role;
select t.check('…it stays as it was', (select link_code <> 'mycode99' from sparks where id = t.id('pumpkin')));
select t.login('outsider'); set role authenticated;
select t.check('an outsider opens the event by its code', public.open_event((select link_code from t.code)) = t.id('pumpkin'));
select t.check('…and can see it now', exists (select 1 from sparks where id = t.id('pumpkin')));
select t.check('a wrong code opens nothing', public.open_event('zzzzzzzz') is null);
select t.check('a malformed code opens nothing', public.open_event('../x') is null);
reset role;
select t.check('the preview by code has the title', (select title from public.event_preview((select link_code from sparks where id = t.id('pumpkin')))) = 'Pumpkin carving night');
-- A private event previews its title and date but not its time or place (20261117000000_private_link_preview.sql)
update sparks set visibility = 'invite', day_date = current_date + 5, day_time = '18:00', spot = 'Secret garden' where id = t.id('pumpkin');
select t.check('a private event''s preview has its title and date', (select title = 'Pumpkin carving night' and day_date = current_date + 5 from public.event_preview((select link_code from sparks where id = t.id('pumpkin')))));
select t.check('…but no time or place', (select day_time is null and spot is null from public.event_preview((select link_code from sparks where id = t.id('pumpkin')))));
update sparks set visibility = 'group' where id = t.id('pumpkin');
select t.check('an old link finds its code', public.link_code_for(t.id('pumpkin')) = (select link_code from sparks where id = t.id('pumpkin')));

-- An idea's discussion reaches everyone interested (20261114000000_idea_comment_notes.sql) --------------------------------
select t.person('lead12'), t.person('fanA12'), t.person('fanB12');
insert into memberships (group_id, user_id, role) values (t.id('g'), t.id('lead12'), 'member'), (t.id('g'), t.id('fanA12'), 'member'), (t.id('g'), t.id('fanB12'), 'member');
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned)
values (gen_random_uuid(), t.id('g'), 'Lead', 'Lead', t.id('lead12'), t.id('lead12'), 'Power point night', 'group', false);
insert into t.ids select 'ppt', id from sparks where text = 'Power point night';
insert into interests (spark_id, user_id) values (t.id('ppt'), t.id('fanA12')), (t.id('ppt'), t.id('fanB12'));
select t.login('fanA12'); set role authenticated;
select t.must_allow('someone interested posts on the idea', format($$insert into event_comments (spark_id, body) values (%L, 'I''ll do one on bees')$$, t.id('ppt')));
reset role;
select t.check('the others interested get it in their notifications', (select count(*) from notes where user_id = t.id('fanB12') and body like '% on Power point night: I''ll do one on bees' and quiet) = 1);
select t.check('…but not the writer', not exists (select 1 from notes where user_id = t.id('fanA12')));
select t.login('fanB12'); set role authenticated;
select t.check('they can read it', (select count(*) from notes where body like '%Power point night%') = 1);
select t.must_allow('a reply', format($$insert into event_comments (spark_id, parent_id, body) values (%L, (select id from event_comments where body = 'I''ll do one on bees'), 'Yes!')$$, t.id('ppt')));
select t.must_refuse('notes stay unwritable by clients', format($$insert into notes (user_id, body) values (%L, 'x')$$, t.id('fanA12')));
reset role;
select t.check('a reply doesn''t notify everyone interested', not exists (select 1 from notes where user_id = t.id('lead12') and body like '%replied%'));
-- …but the person replied to hears it (20261116000000_reply_notes.sql)
select t.check('the comment''s author gets a bell line for the reply', (select count(*) from notes where user_id = t.id('fanA12') and body like '% replied to you on Power point night: Yes!' and quiet) = 1);
select t.check('…and only that one', (select count(*) from notes where user_id = t.id('fanA12')) = 1);
select t.login('lead12'); set role authenticated;
select t.must_allow('the host replies to their own reply''s thread', format($$insert into event_comments (spark_id, parent_id, body) values (%L, (select id from event_comments where body = 'I''ll do one on bees'), 'Love it')$$, t.id('ppt')));
reset role;
select t.check('a host''s reply reaches the author too', (select count(*) from notes where user_id = t.id('fanA12') and body like '% replied to you on Power point night: Love it') = 1);
select t.login('fanA12'); set role authenticated;
select t.must_allow('replying in your own thread', format($$insert into event_comments (spark_id, parent_id, body) values (%L, (select id from event_comments where body = 'I''ll do one on bees'), 'Thanks all')$$, t.id('ppt')));
reset role;
select t.check('your own reply doesn''t notify you', (select count(*) from notes where user_id = t.id('fanA12')) = 2);

-- Multi-day fixes (20261115000000_multi_day_fixes.sql) ---------------------------------------------------------------
select t.check('last day: one day is its date', private.event_last_day(date '2026-10-16', null) = date '2026-10-16');
select t.check('last day: a span ends on `to`', private.event_last_day(date '2026-10-16', '{"kind":"span","to":"2026-10-18"}') = date '2026-10-18');
select t.check('last day: separate days end on the last one', private.event_last_day(date '2026-10-16', '{"kind":"days","days":[{"d":"2026-10-16"},{"d":"2026-10-30"}]}') = date '2026-10-30');
select t.check('last day: a repeat ends on its last date up to `until`', private.event_last_day(date '2026-10-16', '{"kind":"repeat","every":"week","until":"2026-10-29"}') = date '2026-10-23');
select t.check('last day: a repeat without an end never ends', private.event_last_day(date '2026-10-16', '{"kind":"repeat","every":"week","until":null}') is null);
select t.check('monthly from the 31st clamps to each month''s end, counted from the start',
  (select array_agg(day order by day) from private.event_days(date '2027-01-31', null, '{"kind":"repeat","every":"month"}', date '2027-04-30'))
    = array[date '2027-01-31', date '2027-02-28', date '2027-03-31', date '2027-04-30']);
select t.check('every 2 weeks still steps two weeks', (select count(*) = 3 from private.event_days(date '2027-01-01', null, '{"kind":"repeat","every":"2week"}', date '2027-01-29')));
select t.check('a multi-day push hint for a span', private.when_text(date '2026-10-16', null, null, '{"kind":"span","to":"2026-10-18"}') = 'Fri, Oct 16 – Sun, Oct 18');
select t.check('…and for separate days', private.when_text(date '2026-10-30', '10:00', 'Park', '{"kind":"days","days":[{"d":"2026-10-30"},{"d":"2026-10-31"}]}') = 'Fri, Oct 30 at 10:00am + 1 more day · Park');

-- An event that's under way (its first day is past, its last ahead) hasn't passed
select t.person('lead13'), t.person('mem13'), t.person('wait13'), t.person('inv13');
insert into memberships (group_id, user_id, role) values (t.id('g'), t.id('lead13'), 'member'), (t.id('g'), t.id('mem13'), 'member'),
  (t.id('g'), t.id('wait13'), 'member'), (t.id('g'), t.id('inv13'), 'member');
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date, schedule)
values (gen_random_uuid(), t.id('g'), 'Lead', 'Lead', t.id('lead13'), t.id('lead13'), 'Camp weekend', 'group', true, current_date - 1,
        jsonb_build_object('kind', 'span', 'to', current_date + 2)),
       (gen_random_uuid(), t.id('g'), 'Lead', 'Lead', t.id('lead13'), t.id('lead13'), 'Old camp weekend', 'group', true, current_date - 4,
        jsonb_build_object('kind', 'span', 'to', current_date - 2));
insert into t.ids select 'camp', id from sparks where text = 'Camp weekend';
insert into t.ids select 'oldcamp', id from sparks where text = 'Old camp weekend';
insert into signup_items (spark_id, item, need, kind, created_by) values (t.id('camp'), 'Bunk', 1, 'seat', t.id('lead13')), (t.id('oldcamp'), 'Old bunk', 1, 'seat', t.id('lead13'));
insert into signup_claims (item_id, user_id) select id, t.id('mem13') from signup_items where item in ('Bunk', 'Old bunk');
insert into event_invites (spark_id, user_id, invited_by) values (t.id('camp'), t.id('inv13'), t.id('lead13')), (t.id('oldcamp'), t.id('inv13'), t.id('lead13'));
select t.login('wait13'); set role authenticated;
select t.must_allow('joining the waitlist on a span that''s under way', format($$insert into signup_waits (item_id, user_id) select id, %L from signup_items where item = 'Bunk'$$, t.id('wait13')));
select t.must_refuse('…but not once its last day has passed', format($$insert into signup_waits (item_id, user_id) select id, %L from signup_items where item = 'Old bunk'$$, t.id('wait13')));
reset role;
select t.login('lead13'); set role authenticated;
select t.check('the lead nudges an invitee on a span that''s under way', public.nudge_invitee(t.id('camp'), t.id('inv13')));
select t.must_refuse('…but not once it''s over', format($$select public.nudge_invitee(%L, %L)$$, t.id('oldcamp'), t.id('inv13')));
reset role;

-- Taking a day off an Each-day event trims the picks, frees the job's day and tells them
select t.person('lead14'), t.person('a14'), t.person('b14'), t.person('c14');
insert into memberships (group_id, user_id, role) values (t.id('g'), t.id('lead14'), 'member'), (t.id('g'), t.id('a14'), 'member'),
  (t.id('g'), t.id('b14'), 'member'), (t.id('g'), t.id('c14'), 'member');
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date, schedule)
values (gen_random_uuid(), t.id('g'), 'Lead', 'Lead', t.id('lead14'), t.id('lead14'), 'Book fair', 'group', true, current_date + 10,
        jsonb_build_object('kind', 'days', 'each', true, 'days', jsonb_build_array(jsonb_build_object('d', current_date + 10),
          jsonb_build_object('d', current_date + 11), jsonb_build_object('d', current_date + 12))));
insert into t.ids select 'fair', id from sparks where text = 'Book fair';
insert into rsvps (spark_id, user_id, status, days, maybe_days) values
  (t.id('fair'), t.id('a14'), 'going', array[current_date + 10, current_date + 12], array[current_date + 11]),
  (t.id('fair'), t.id('b14'), 'going', array[current_date + 12], null);
insert into signup_items (spark_id, item, need, day, created_by) values (t.id('fair'), 'Pack books', 2, current_date + 12, t.id('lead14'));
insert into signup_claims (item_id, user_id) select id, t.id('c14') from signup_items where item = 'Pack books';
select t.login('lead14'); set role authenticated;
select t.must_allow('the lead takes the third day off', format($$update sparks set schedule = jsonb_build_object('kind', 'days', 'each', true, 'days', jsonb_build_array(jsonb_build_object('d', current_date + 10), jsonb_build_object('d', current_date + 11))) where id = %L$$, t.id('fair')));
reset role;
select t.check('the removed day leaves a reply''s picks, the rest stay', (select days = array[current_date + 10] and maybe_days = array[current_date + 11] from rsvps where spark_id = t.id('fair') and user_id = t.id('a14')));
select t.check('a reply left with no days stands for the whole event (still Going)', (select days is null and maybe_days is null and status = 'going' from rsvps where spark_id = t.id('fair') and user_id = t.id('b14')));
select t.check('a job on the removed day is for the whole event now', (select day is null from signup_items where item = 'Pack books'));
select t.check('the people who lose a day are told', (select count(distinct user_id) = 3 from notes where body = 'Book fair: ' || to_char(current_date + 12, 'Dy, Mon FMDD') || ' was taken off the schedule.'));
select t.check('…not the lead', not exists (select 1 from notes where user_id = t.id('lead14') and body like 'Book fair:%'));
select t.login('lead14'); set role authenticated;
select t.must_allow('the lead turns Each day off', format($$update sparks set schedule = jsonb_set(schedule, '{each}', 'false') where id = %L$$, t.id('fair')));
reset role;
select t.check('…and every reply is for the whole event', not exists (select 1 from rsvps where spark_id = t.id('fair') and (days is not null or maybe_days is not null)));

-- The daily reminder filters by picked days only on an Each-day event
create table t.today as select (now() at time zone 'America/Chicago')::date as d;
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date, schedule)
select gen_random_uuid(), t.id('g'), 'Lead', 'Lead', t.id('lead14'), t.id('lead14'), 'Plant swap', 'group', true, d,
       jsonb_build_object('kind', 'days', 'each', false, 'days', jsonb_build_array(jsonb_build_object('d', d), jsonb_build_object('d', d + 1)))
  from t.today;
insert into t.ids select 'swap', id from sparks where text = 'Plant swap';
insert into rsvps (spark_id, user_id, status, days) select t.id('swap'), t.id('a14'), 'going', array[d + 1] from t.today;
delete from t.pushes;
select private.push_daily();
select t.check('not Each day: a stray day pick doesn''t stop today''s reminder',
  exists (select 1 from t.pushes, t.today where tag = 'r:' || t.id('swap') || ':' || d || ':0' and t.id('a14') = any(users)));
update sparks set schedule = jsonb_set(schedule, '{each}', 'true') where id = t.id('swap');
delete from t.pushes;
select private.push_daily();
select t.check('Each day: only the days they picked',
  not exists (select 1 from t.pushes, t.today where tag = 'r:' || t.id('swap') || ':' || d || ':0' and t.id('a14') = any(users))
  and exists (select 1 from t.pushes, t.today where tag = 'r:' || t.id('swap') || ':' || (d + 1) || ':1' and t.id('a14') = any(users)));

-- The link preview: schedule, and a photo falling back cover → mood → the home group's
insert into groups (id, name, code, created_by, photo) values (gen_random_uuid(), 'Preview group', 'PREV15', t.id('lead14'), 'photos/share-hub.jpg');
insert into t.ids select 'pg', id from groups where code = 'PREV15';
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date, schedule, photos, mood)
values (gen_random_uuid(), t.id('pg'), 'Lead', 'Lead', t.id('lead14'), t.id('lead14'), 'Preview fair', 'group', true, current_date + 5,
        jsonb_build_object('kind', 'span', 'to', current_date + 6),
        array[t.id('lead14') || '/00000000-0000-0000-0000-000000000001.jpg'], array[t.id('lead14') || '/00000000-0000-0000-0000-000000000002.jpg']);
insert into t.ids select 'pf', id from sparks where text = 'Preview fair';
create function t.preview_photo() returns text language sql as $$ select photo from public.event_preview((select link_code from sparks where id = t.id('pf'))) $$;
select t.check('the preview carries the schedule', (select schedule ->> 'kind' = 'span' from public.event_preview((select link_code from sparks where id = t.id('pf')))));
select t.check('the preview photo is the cover first', t.preview_photo() like '%0001.jpg');
update sparks set photos = '{}' where id = t.id('pf');
select t.check('…then the first mood photo', t.preview_photo() like '%0002.jpg');
update sparks set mood = '{}' where id = t.id('pf');
select t.check('…then the home group''s photo', t.preview_photo() = 'photos/share-hub.jpg');
update groups set photo = null where id = t.id('pg');
select t.check('…and none when there''s none of the three', t.preview_photo() is null);

-- Community memory (20261121030000_event_memory.sql): the journal and summaries hold facts that outlive the event ---
select t.person('mem_lead'); select t.person('mem_a'); select t.person('mem_b');
insert into groups (id, name, code, created_by) values (gen_random_uuid(), 'Memory group', 'MEMO22', t.id('mem_lead'));
insert into t.ids select 'mem_g', id from groups where code = 'MEMO22';
insert into memberships (group_id, user_id, role) values (t.id('mem_g'), t.id('mem_a'), 'member'), (t.id('mem_g'), t.id('mem_b'), 'member')
  on conflict do nothing;
create function t.jn(p_name text, p_kind text) returns bigint language sql as $$
  select count(*) from private.event_journal where spark_id = t.id(p_name) and kind = p_kind $$;

-- no client role reads or writes either table
set role authenticated;
select t.must_refuse('a signed-in person reads the journal', 'select * from private.event_journal');
select t.must_refuse('a signed-in person reads the summaries', 'select * from private.event_summaries');
select t.must_refuse('a signed-in person writes the journal', $$insert into private.event_journal (spark_id, kind) values (gen_random_uuid(), 'x')$$);
select t.must_refuse('a signed-in person runs close_out_events', 'select private.close_out_events()');
set role anon;
select t.must_refuse('a visitor reads the journal', 'select * from private.event_journal');
select t.must_refuse('a visitor reads the summaries', 'select * from private.event_summaries');
reset role;

-- event types
select t.check('pickleball night is pickleball', private.guess_event_type('Pickleball Night 2') = 'pickleball');
select t.check('chili cook-off is a potluck', private.guess_event_type('Chili Cook-Off') = 'potluck');
select t.check('halloween walk is a walk', private.guess_event_type('Halloween Walk') = 'walk');
select t.check('street cleanup is volunteering', private.guess_event_type('Street cleanup') = 'volunteer');
select t.check('an odd title is other', private.guess_event_type('Zzz') = 'other');
select t.check('titles group together', private.title_key('Pickleball Night 2') = private.title_key('pickleball night')
  and private.title_key('Oct 12 Pickleball Night!') = 'pickleball night');

-- a real event: posted, edited, claimed, released, cancelled
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date, day_time)
values (gen_random_uuid(), t.id('mem_g'), 'Lead', 'Lead', t.id('mem_lead'), t.id('mem_lead'), 'Pickleball Night 7', 'group', true, current_date + 4, '18:00');
insert into t.ids select 'mem_ev', id from sparks where text = 'Pickleball Night 7';
select t.check('the event type is filled in', (select event_type from sparks where id = t.id('mem_ev')) = 'pickleball');
select t.check('posting writes a journal row', t.jn('mem_ev', 'posted') = 1);
insert into signup_items (spark_id, item, need, created_by) values (t.id('mem_ev'), 'Bring nets', 2, t.id('mem_lead'));
insert into t.ids select 'mem_job', id from signup_items where spark_id = t.id('mem_ev');
select t.check('adding a job is recorded', t.jn('mem_ev', 'job_added') = 1);
update signup_items set need = 3 where id = t.id('mem_job');
select t.check('changing the spots is recorded', t.jn('mem_ev', 'job_spots_changed') = 1);
insert into signup_claims (item_id, user_id) values (t.id('mem_job'), t.id('mem_a')), (t.id('mem_job'), t.id('mem_b'));
select t.check('claims are recorded', t.jn('mem_ev', 'job_claimed') = 2);
delete from signup_claims where user_id = t.id('mem_b');
select t.check('a released claim is recorded', t.jn('mem_ev', 'job_released') = 1);
update sparks set day_time = '19:00', spot = 'The park' where id = t.id('mem_ev');
select t.check('a new time is recorded', t.jn('mem_ev', 'date_changed') = 1);
select t.check('a new place is recorded, without the place', t.jn('mem_ev', 'spot_changed') = 1
  and not exists (select 1 from private.event_journal where data::text like '%park%'));
-- removing a job on its own logs the removal (with its claim count) but not its claims as released
insert into signup_items (spark_id, item, need, created_by) values (t.id('mem_ev'), 'Snacks', 2, t.id('mem_lead'));
insert into t.ids select 'mem_snack', id from signup_items where item = 'Snacks' and spark_id = t.id('mem_ev');
insert into signup_claims (item_id, user_id) values (t.id('mem_snack'), t.id('mem_a'));
delete from signup_items where id = t.id('mem_snack');
select t.check('removing a job is recorded once with its claim count, and releases nothing',
  (select count(*) from private.event_journal where spark_id = t.id('mem_ev') and kind = 'job_removed' and (data ->> 'claimed')::int = 1) = 1
  and t.jn('mem_ev', 'job_released') = 1);

update sparks set cancelled_at = now(), cancel_reason = 'Rain, sorry' where id = t.id('mem_ev');
select t.check('a cancel is recorded with the reason''s length only', t.jn('mem_ev', 'cancelled') = 1
  and (select (data ->> 'reason_len')::int = 11 and (data ->> 'reason_given')::boolean from private.event_journal
        where spark_id = t.id('mem_ev') and kind = 'cancelled')
  and not exists (select 1 from private.event_journal where data::text ilike '%rain%'));
select t.check('the journal holds no user id', not exists (select 1 from private.event_journal j, auth.users u
  where j.data::text like '%' || u.id::text || '%'));

-- a deleted event does not log each claim as released
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date, day_time)
values (gen_random_uuid(), t.id('mem_g'), 'Lead', 'Lead', t.id('mem_lead'), t.id('mem_lead'), 'Potluck supper', 'group', true, current_date + 4, '18:00');
insert into t.ids select 'mem_pot', id from sparks where text = 'Potluck supper';
insert into signup_items (spark_id, item, need, created_by) values (t.id('mem_pot'), 'Salad', 2, t.id('mem_lead'));
insert into t.ids select 'mem_salad', id from signup_items where spark_id = t.id('mem_pot');
insert into signup_claims (item_id, user_id) values (t.id('mem_salad'), t.id('mem_a'));
select t.login('mem_lead');
select public.delete_event(t.id('mem_pot'), false, null);
select t.check('deleting an event logs no per-claim release or job removal', t.jn('mem_pot', 'job_released') = 0 and t.jn('mem_pot', 'job_removed') = 0);
select t.check('a normal delete writes a deleted row', t.jn('mem_pot', 'deleted') = 1);
select t.check('a normal delete keeps the summary without the title', exists (select 1 from private.event_summaries
  where spark_id = t.id('mem_pot') and title_key is null and event_type = 'potluck' and cancelled and jobs -> 0 ->> 'name' = 'Salad'));

-- a quiet delete discards everything
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date, day_time)
values (gen_random_uuid(), t.id('mem_g'), 'Lead', 'Lead', t.id('mem_lead'), t.id('mem_lead'), 'Oops party', 'group', true, current_date + 4, '18:00');
insert into t.ids select 'mem_oops', id from sparks where text = 'Oops party';
select t.check('the mistake was journaled first', t.jn('mem_oops', 'posted') = 1);
select public.delete_event(t.id('mem_oops'), true, null);
select t.check('a quiet delete leaves no journal rows', t.jn('mem_oops', 'posted') = 0 and t.jn('mem_oops', 'deleted') = 0);
select t.check('a quiet delete leaves no summary', not exists (select 1 from private.event_summaries where spark_id = t.id('mem_oops')));

-- test, demo and [E2E] events write nothing
insert into sparks (group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date, day_time, test)
values (t.id('mem_g'), 'Lead', 'Lead', t.id('mem_lead'), t.id('mem_lead'), 'A test event', 'group', true, current_date + 4, '18:00', true);
insert into sparks (group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date, day_time)
values (t.id('mem_g'), 'Lead', 'Lead', t.id('mem_lead'), t.id('mem_lead'), '[E2E] walk 123', 'group', true, current_date + 4, '18:00');
insert into signup_items (spark_id, item, need, created_by) select id, 'Chairs', 1, t.id('mem_lead') from sparks where text in ('A test event', '[E2E] walk 123');
insert into signup_claims (item_id, user_id) select i.id, t.id('mem_a') from signup_items i join sparks s on s.id = i.spark_id where s.text in ('A test event', '[E2E] walk 123');
select t.check('test and [E2E] events write no journal rows', not exists (select 1 from private.event_journal j join sparks s on s.id = j.spark_id
  where s.text in ('A test event', '[E2E] walk 123')));
select t.check('…and are never closed out', (select private.close_out_events()) is not null
  and not exists (select 1 from private.event_summaries m join sparks s on s.id = m.spark_id where s.text in ('A test event', '[E2E] walk 123')));
select set_config('request.jwt.claims', '{"role":"service_role"}', false), set_config('request.jwt.claim.role', 'service_role', false);
insert into sparks (group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date, day_time, demo)
values (t.id('mem_g'), 'Lead', 'Lead', t.id('mem_lead'), t.id('mem_lead'), 'A demo event', 'group', true, current_date + 4, '18:00', true);
select set_config('request.jwt.claims', '', false), set_config('request.jwt.claim.role', '', false);
select t.check('demo events write nothing', exists (select 1 from sparks where text = 'A demo event' and demo) and not exists (select 1 from private.event_journal j join sparks s on s.id = j.spark_id where s.text = 'A demo event'));

-- close out: only events that ended a day ago, once
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date, day_time, day_end)
values (gen_random_uuid(), t.id('mem_g'), 'Lead', 'Lead', t.id('mem_lead'), t.id('mem_lead'), 'Game night 3', 'group', true, current_date + 3, '18:00', '20:30');
insert into t.ids select 'mem_past', id from sparks where text = 'Game night 3';
insert into signup_items (spark_id, item, need, created_by, created_at) values (t.id('mem_past'), 'Snacks', 2, t.id('mem_lead'), now() - interval '10 days');
insert into t.ids select 'mem_psnack', id from signup_items where spark_id = t.id('mem_past');
insert into signup_claims (item_id, user_id, created_at) values (t.id('mem_psnack'), t.id('mem_a'), now() - interval '9 days'), (t.id('mem_psnack'), t.id('mem_b'), now() - interval '8 days');
insert into rsvps (spark_id, user_id, status) values
  (t.id('mem_past'), t.id('mem_a'), 'going'), (t.id('mem_past'), t.id('mem_b'), 'going');
update sparks set day_date = current_date - 2 where id = t.id('mem_past');
update rsvps set attended = true where spark_id = t.id('mem_past') and user_id = t.id('mem_a');
select t.check('a future event is not closed out yet', private.close_out_events() >= 1
  and not exists (select 1 from private.event_summaries where spark_id = t.id('mem_ev')));
select t.check('the summary has the counts', exists (select 1 from private.event_summaries where spark_id = t.id('mem_past')
  and event_type = 'game_night' and title_key = 'game night' and going = 3 and came = 1 and not cancelled and duration_min = 150
  and start_time = '18:00' and jobs -> 0 ->> 'name' = 'Snacks' and (jobs -> 0 ->> 'claimed')::int = 2 and (jobs -> 0 ->> 'hours_to_fill')::numeric = 48.0
  and lead_days is not null and dow is not null));
select t.check('close_out_events twice writes one summary', private.close_out_events() = 0
  and (select count(*) from private.event_summaries where spark_id = t.id('mem_past')) = 1);
select t.check('the summary holds no user id', not exists (select 1 from private.event_summaries s, auth.users u
  where s::text like '%' || u.id::text || '%'));

-- Limit RSVPs, the event waitlist and a note on an offer to lead (20261123000000_cap_waitlist_offer_note.sql, Design v8-18)
reset role;
select t.person('cap_lead'), t.person('cap_a'), t.person('cap_b');
insert into memberships (group_id, user_id, role) values (t.id('g'), t.id('cap_lead'), 'member'), (t.id('g'), t.id('cap_a'), 'member'), (t.id('g'), t.id('cap_b'), 'member');
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date, cap) values
  (gen_random_uuid(), t.id('g'), 'Lead', 'Lead', t.id('cap_lead'), t.id('cap_lead'), 'Capped supper', 'group', true, current_date + 5, 2),
  (gen_random_uuid(), t.id('g'), 'Lead', 'Lead', t.id('cap_lead'), t.id('cap_lead'), 'Open supper', 'group', true, current_date + 5, null),
  (gen_random_uuid(), t.id('g'), 'Lead', 'Lead', t.id('cap_lead'), t.id('cap_lead'), 'Capped idea', 'group', false, null, null);
insert into t.ids select 'cap_ev', id from sparks where text = 'Capped supper';
insert into t.ids select 'cap_open', id from sparks where text = 'Open supper';
insert into t.ids select 'cap_idea', id from sparks where text = 'Capped idea';
select t.login('cap_a'); set role authenticated;
select t.must_allow('going while there''s room (the lead is one of the two)', format($$insert into rsvps (spark_id, user_id, status) values (%L, %L, 'going')$$, t.id('cap_ev'), t.id('cap_a')));
select t.must_refuse('bringing a plus-one past the cap', format($$update rsvps set plus_count = 1 where spark_id = %L and user_id = %L$$, t.id('cap_ev'), t.id('cap_a')));
select t.must_refuse('setting another lead''s cap', format($$update sparks set cap = 50 where id = %L$$, t.id('cap_ev')));
select t.must_refuse('joining the waitlist of an event with room', format($$insert into event_waits (spark_id, user_id) values (%L, %L)$$, t.id('cap_open'), t.id('cap_a')));
reset role;
select t.login('cap_b'); set role authenticated;
select t.must_refuse('going to a full event', format($$insert into rsvps (spark_id, user_id, status) values (%L, %L, 'going')$$, t.id('cap_ev'), t.id('cap_b')));
select t.must_allow('a Maybe on a full event', format($$insert into rsvps (spark_id, user_id, status) values (%L, %L, 'maybe')$$, t.id('cap_ev'), t.id('cap_b')));
select t.must_allow('joining its waitlist', format($$insert into event_waits (spark_id, user_id) values (%L, %L)$$, t.id('cap_ev'), t.id('cap_b')));
select t.must_refuse('jumping the line', format($$insert into event_waits (spark_id, user_id, created_at) values (%L, %L, now() - interval '1 day')$$, t.id('cap_open'), t.id('cap_b')));
select t.check('load_all carries the waitlist', public.load_all() -> 'event_waits' @> jsonb_build_array(jsonb_build_object('spark_id', t.id('cap_ev'), 'user_id', t.id('cap_b'))));
select t.must_allow('an offer to lead with a note', format($$insert into interests (spark_id, user_id, can_help, offer_note) values (%L, %L, true, 'I ran one last spring')$$, t.id('cap_idea'), t.id('cap_b')));
select t.must_refuse('a note over 120 characters', format($$update interests set offer_note = repeat('x', 121) where spark_id = %L$$, t.id('cap_idea')));
select t.check('and load_all carries the note', public.load_all() -> 'interests' @> jsonb_build_array(jsonb_build_object('spark_id', t.id('cap_idea'), 'offer_note', 'I ran one last spring')));
reset role;
select t.login('cap_a'); set role authenticated;
select t.must_allow('dropping to Maybe', format($$update rsvps set status = 'maybe' where spark_id = %L and user_id = %L$$, t.id('cap_ev'), t.id('cap_a')));
reset role;
select t.check('the first in line moves up to Going', (select status from rsvps where spark_id = t.id('cap_ev') and user_id = t.id('cap_b')) = 'going'
  and not exists (select 1 from event_waits where spark_id = t.id('cap_ev')));
select t.check('and hears about it', exists (select 1 from notes where user_id = t.id('cap_b') and body like 'A spot opened%'));
select t.login('cap_lead'); set role authenticated;
select t.must_allow('the lead sets the cap', format($$update sparks set cap = 3 where id = %L$$, t.id('cap_ev')));
reset role;

-- Store safety: reports, blocks, a guest's sign-ups (Design v8-18, 20261124000000_store_safety.sql) ---------------
select t.person('rep_own'), t.person('rep_adm'), t.person('rep_m'), t.person('rep_a');
insert into groups (id, name, code, created_by) values (gen_random_uuid(), 'Report group', 'CHECKR', t.id('rep_own'));
insert into t.ids select 'rep_g', id from groups where code = 'CHECKR';
insert into memberships (group_id, user_id, role) values (t.id('rep_g'), t.id('rep_own'), 'owner'), (t.id('rep_g'), t.id('rep_adm'), 'admin'),
  (t.id('rep_g'), t.id('rep_m'), 'member'), (t.id('rep_g'), t.id('rep_a'), 'member');
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date)
values (gen_random_uuid(), t.id('rep_g'), 'Mem', 'Mem', t.id('rep_m'), t.id('rep_m'), 'Reported walk', 'group', true, current_date + 8);
insert into t.ids select 'rep_ev', id from sparks where text = 'Reported walk';
insert into event_comments (id, spark_id, body, created_by) values (gen_random_uuid(), t.id('rep_ev'), 'Buy my stuff', t.id('rep_m')),
  (gen_random_uuid(), t.id('rep_ev'), 'Admin says hi', t.id('rep_adm'));
insert into t.ids select 'rep_c', id from event_comments where body = 'Buy my stuff';
insert into t.ids select 'rep_c2', id from event_comments where body = 'Admin says hi';
select t.check('nobody reads or writes reports directly', not has_table_privilege('authenticated', 'public.reports', 'select')
  and not has_table_privilege('authenticated', 'public.reports', 'insert') and not has_table_privilege('anon', 'public.reports', 'select'));
select t.login('guest'); set role authenticated;
select t.must_refuse('a guest reporting', format($$select public.report_content('comment', '%s', 'Spam')$$, t.id('rep_c')));
reset role;
select t.login('outsider'); set role authenticated;
select t.must_refuse('reporting a comment you can''t see', format($$select public.report_content('comment', '%s', 'Spam')$$, t.id('rep_c')));
reset role;
select t.login('rep_m'); set role authenticated;
select t.must_refuse('reporting your own comment', format($$select public.report_content('comment', '%s', 'Spam')$$, t.id('rep_c')));
reset role;
select t.login('rep_a'); set role authenticated;
select t.must_refuse('a report needs one of the five reasons', format($$select public.report_content('comment', '%s', 'Meh')$$, t.id('rep_c')));
select t.check('a member reports a comment', public.report_content('comment', t.id('rep_c')::text, 'Spam', 'selling things') is not null);
select t.check('reporting it again keeps the one report', public.report_content('comment', t.id('rep_c')::text, 'Harassment') = public.report_content('comment', t.id('rep_c')::text, 'Spam'));
select t.check('a report about a group admin', public.report_content('comment', t.id('rep_c2')::text, 'Harassment') is not null);
select t.check('the reporter sees their open reports (to fold them)', jsonb_array_length(public.my_safety() -> 'reports') = 2);
select t.must_refuse('a member reading the group''s reports', format($$select * from public.list_reports('%s')$$, t.id('rep_g')));
select t.must_refuse('a member reading all reports', $$select * from public.list_reports()$$);
select t.must_refuse('a member acting on a report', format($$select public.resolve_report((select id from public.list_reports('%s') limit 1), 'dismiss')$$, t.id('rep_g')));
reset role;
select t.check('the report about an admin goes straight to the app owner', (select about_lead from reports where target = t.id('rep_c2')::text)
  and not (select about_lead from reports where target = t.id('rep_c')::text));
select t.login('rep_adm'); set role authenticated;
select t.check('the group''s admin sees the report about a member, not the one about themselves, and not who sent it',
  (select count(*) from public.list_reports(t.id('rep_g'))) = 1 and (select reporter_name from public.list_reports(t.id('rep_g'))) is null
  and (select excerpt from public.list_reports(t.id('rep_g'))) = 'Buy my stuff');
select public.resolve_report((select id from public.list_reports(t.id('rep_g'))), 'remove');
reset role;
select t.check('Remove content deletes the comment, closes the report and tells the person who posted it',
  not exists (select 1 from event_comments where id = t.id('rep_c'))
  and exists (select 1 from reports where target = t.id('rep_c')::text and status = 'removed')
  and exists (select 1 from notes where user_id = t.id('rep_m') and body like 'Your comment on Reported walk was removed%'));
select t.login('rep_a'); set role authenticated;
select public.withdraw_report('comment', t.id('rep_c2')::text);
select t.check('Undo takes back your own open report', jsonb_array_length(public.my_safety() -> 'reports') = 0);
select t.check('a member reports an event', public.report_content('event', t.id('rep_ev')::text, 'Unsafe') is not null);
reset role;
select t.login('rep_adm'); set role authenticated;
select public.resolve_report((select id from public.list_reports(t.id('rep_g'))), 'block');
reset role;
select t.check('Block removes the person from the group and keeps them out',
  not exists (select 1 from memberships where group_id = t.id('rep_g') and user_id = t.id('rep_m'))
  and exists (select 1 from group_bans where group_id = t.id('rep_g') and user_id = t.id('rep_m'))
  and exists (select 1 from sparks where id = t.id('rep_ev')));
delete from group_bans where group_id = t.id('rep_g') and user_id = t.id('rep_m');
insert into memberships (group_id, user_id, role) values (t.id('rep_g'), t.id('rep_m'), 'member');
-- Blocking a person
select t.login('rep_a'); set role authenticated;
select t.must_refuse('writing a block directly', format($$insert into public.user_blocks (blocker, blocked) values ('%s', '%s')$$, t.id('rep_a'), t.id('rep_m')));
select t.must_refuse('blocking yourself', format($$select public.block_user('%s')$$, t.id('rep_a')));
select public.block_user(t.id('rep_m'));
select t.check('you see your own blocks, with their names', (select count(*) from user_blocks) = 1 and public.my_safety() -> 'blocks' -> 0 ->> 'id' = t.id('rep_m')::text);
reset role;
select t.login('rep_m'); set role authenticated;
select t.check('the person blocked can''t see that block', (select count(*) from user_blocks) = 0);
select t.check('their friend request goes nowhere (it looks sent)', public.send_friend_request(t.id('rep_a')) = 'requested');
reset role;
select t.check('…and no request was saved', not exists (select 1 from friend_requests where from_id = t.id('rep_m') and to_id = t.id('rep_a')));
select private.make_friends(t.id('rep_m'), t.id('rep_a'));
select t.check('a friendship between them doesn''t happen either', not exists (select 1 from friendships where user_a = least(t.id('rep_m'), t.id('rep_a')) and user_b = greatest(t.id('rep_m'), t.id('rep_a'))));
select t.login('rep_a'); set role authenticated;
select public.unblock_user(t.id('rep_m'));
select t.check('Unblock takes it off', (select count(*) from user_blocks) = 0);
reset role;
-- Remove my sign-ups (a guest on an event)
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, visibility, planned, day_date)
values (gen_random_uuid(), t.id('rep_g'), 'Host', 'Host', t.id('rep_own'), t.id('rep_own'), 'Guest walk', 'group', true, current_date + 9);
insert into t.ids select 'gw', id from sparks where text = 'Guest walk';
insert into guest_contacts (spark_id, user_id, name, phone) values (t.id('gw'), t.id('guest'), 'Vic', '5125550123');
insert into rsvps (spark_id, user_id, status) values (t.id('gw'), t.id('guest'), 'going');
select t.login('guest'); set role authenticated;
select public.remove_my_signups(t.id('gw'));
reset role;
select t.check('Remove my sign-ups takes the reply, name and contact off', not exists (select 1 from rsvps where spark_id = t.id('gw') and user_id = t.id('guest'))
  and not exists (select 1 from guest_contacts where spark_id = t.id('gw') and user_id = t.id('guest'))
  and exists (select 1 from rsvps where spark_id = t.id('gw') and user_id = t.id('rep_own')));
