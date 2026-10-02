-- Walnut Creek and Woodcliff stop being demo groups (owner, 2026-10-01): their demo events and the demo people
-- go, and they become ordinary groups. Real events and real members stay. Hub on Hunters keeps its demo set.
--   Test: supabase db query --linked -f scripts/demo/walnut-woodcliff-real.sql
--   Live: supabase db query --linked --project-ref xwrzfpgsazyrgieymtee -f scripts/demo/walnut-woodcliff-real.sql
-- Safe to re-run. Photo files left behind are removed afterwards by scripts/demo/delete-unused-photos.py.

-- Groups by who started them, never by name alone (20261101050000_roster_by_id.sql)
create temp table grp as
select g.id from public.groups g
 where g.created_by in (select id from auth.users where email in ('eric@ericscott-creative.com', 'esshaughn@gmail.com'))   -- the owner's accounts
   and g.name in ('Walnut Creek Neighborhood', 'Woodcliff Neighborhood');

-- 1. Demo events whose home is one of them (their replies, jobs, photos rows and so on go with them)
delete from public.sparks s where s.demo and s.group_id in (select id from grp);
-- …and demo events from elsewhere stop being posted to them
delete from public.spark_groups sg using public.sparks s
 where s.id = sg.spark_id and s.demo and sg.group_id in (select id from grp);

-- 2. The demo people leave
delete from public.memberships m using auth.users u
 where u.id = m.user_id and u.email like 'seed-%@example.com' and m.group_id in (select id from grp);

-- 3. Ordinary groups (no DEMO chip)
update public.groups set demo = false where id in (select id from grp);

-- Check
select g.name, g.demo,
       (select count(*) from public.sparks s where s.group_id = g.id and s.demo) as demo_events,
       (select count(*) from public.sparks s where s.group_id = g.id and not s.demo) as real_events,
       (select count(*) from public.memberships m where m.group_id = g.id) as members
  from public.groups g where g.id in (select id from grp) order by g.name;
