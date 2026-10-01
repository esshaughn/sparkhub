-- Torrez Fitness becomes the one real pilot group (owner, 2026-09-29). Run after the demo_optin migration,
-- on test and (by the owner) on live:
--   Test: supabase db query --linked -f scripts/demo/pilot-torrez.sql
--   Live: supabase db query --linked --project-ref xwrzfpgsazyrgieymtee -f scripts/demo/pilot-torrez.sql
-- Safe to re-run. It removes only Torrez's DEMO content and the demo people; real members and any real
-- events they posted stay. Everyone already in Torrez stays in it.

-- 1. Torrez is no longer a demo group
update public.groups set demo = false where code = 'TORREZ';

-- 2. Demo events posted to Torrez as an extra group lose that link; demo events whose home is Torrez are deleted
--    (their replies, votes, sign-ups, updates and album rows go with them)
delete from public.spark_groups
 where group_id = (select id from public.groups where code = 'TORREZ')
   and spark_id in (select id from public.sparks where demo);
delete from public.sparks
 where demo and group_id = (select id from public.groups where code = 'TORREZ');

-- 3. The demo people leave Torrez
delete from public.memberships m using auth.users u
 where u.id = m.user_id and u.email like 'seed-%@example.com'
   and m.group_id = (select id from public.groups where code = 'TORREZ');

select (select count(*) from public.sparks s join public.groups g on g.id = s.group_id where g.code = 'TORREZ') as torrez_events_left,
       (select count(*) from public.memberships m join public.groups g on g.id = m.group_id where g.code = 'TORREZ') as torrez_members,
       (select count(*) from public.groups where demo) as demo_groups;
