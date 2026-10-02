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
reset role;
select t.check('the invited member can see the event through the invite',
  exists (select 1 from link_access where user_id = t.id('admin') and via = 'invite' and spark_id = (select id from sparks where text = 'Lead going walk')));
select t.login('outsider'); set role authenticated;
select t.check('someone who can''t invite sees no invites',
  not exists (select 1 from public.event_invited((select id from sparks where text = 'Lead going walk'))));
reset role;

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
-- Deleting your own account
select t.login('guest'); set role authenticated;
select t.must_refuse('a guest deleting "their account"', $$select public.delete_my_account()$$);
reset role;
select t.login('leaver'); set role authenticated;
select * from public.create_group('Leaver crew');
reset role;
insert into memberships (group_id, user_id, role) values ((select id from groups where name = 'Leaver crew'), t.id('heir'), 'member');
select t.login('leaver'); set role authenticated;
select t.must_refuse('deleting your account while you''re the only owner of a group with others in it', $$select public.delete_my_account()$$);
insert into sparks (id, group_id, author_name, lead_name, lead_id, created_by, text, planned, day_date)
values (gen_random_uuid(), (select id from groups where name = 'Leaver crew'), 'Leaver', 'Leaver', t.id('leaver'), t.id('leaver'), 'Handed on walk', true, current_date + 5),
       (gen_random_uuid(), (select id from groups where name = 'Leaver crew'), 'Leaver', 'Leaver', t.id('leaver'), t.id('leaver'), 'Goes with them walk', true, current_date + 6);
reset role;
update memberships set role = 'owner' where user_id = t.id('heir') and group_id = (select id from groups where name = 'Leaver crew');
insert into cohosts (spark_id, user_id, added_by) values ((select id from sparks where text = 'Handed on walk'), t.id('heir'), t.id('leaver'));
select t.login('leaver'); set role authenticated;
select t.must_allow('with another owner, the account can go', $$select public.delete_my_account()$$);
reset role;
select t.check('the account is gone', not exists (select 1 from auth.users where id = t.id('leaver')));
select t.check('the group stays with its other owner', exists (select 1 from groups where name = 'Leaver crew'));
select t.check('the co-led event passed to its co-lead, who is no longer listed as a co-lead',
  exists (select 1 from sparks where text = 'Handed on walk' and lead_id = t.id('heir'))
  and not exists (select 1 from cohosts c join sparks s on s.id = c.spark_id where s.text = 'Handed on walk'));
select t.check('the event with no co-lead went with them', not exists (select 1 from sparks where text = 'Goes with them walk'));

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
select t.must_allow('the floater asks a member to lead', format($$select public.ask_to_lead(%L, %L)$$, t.id('floated'), t.id('asked')));
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
     and jsonb_array_length(d -> 'plan_updates') = (select count(*) from plan_updates)
     and jsonb_array_length(d -> 'cohosts') = (select count(*) from cohosts)
     and jsonb_array_length(d -> 'album_photos') = (select count(*) from album_photos)
     and jsonb_array_length(d -> 'plan_prep') = (select count(*) from plan_prep)
     and jsonb_array_length(d -> 'reactions') = (select count(*) from reactions)
     and jsonb_array_length(d -> 'spark_groups') = (select count(*) from spark_groups)
     and jsonb_array_length(d -> 'event_drafts') = (select count(*) from event_drafts)
     and jsonb_array_length(d -> 'notes') = least(50, (select count(*) from notes))
     and jsonb_array_length(d -> 'lead_asks') = (select count(*) from lead_asks)
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
