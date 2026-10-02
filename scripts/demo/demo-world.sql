-- The shared demo world's data (owner's brief, 2026-09-29). Run after the demo_world migration and
-- the demo seed scripts, on test and (by the owner) on live:
--   Test: supabase db query --linked -f scripts/demo/demo-world.sql
--   Live: supabase db query --linked --project-ref xwrzfpgsazyrgieymtee -f scripts/demo/demo-world.sql
-- Safe to re-run. Roles only go up; nobody is removed from anything.

-- Groups are picked by who started them (the owner's account, as seed-demo.py does) or by code, never by
-- name alone: anyone can start a group with any name (20261101050000_roster_by_id.sql).
create temp table demo_groups_here as
select g.id, g.name from public.groups g
 where g.created_by = (select id from auth.users where email = 'eric@ericscott-creative.com')
   and g.name in ('Hub on Hunters', 'Walnut Creek Neighborhood', 'Woodcliff Neighborhood')
union
select g.id, 'Torrez Fitness' from public.groups g where g.code = 'TORREZ';

-- 1. The demo groups. Nobody is added automatically any more (since 20261011000000_demo_optin.sql):
--    people join them with their invite codes, which the owner shares by hand. Torrez Fitness is the real
--    pilot group and is NOT a demo group (see pilot-torrez.sql); nor is Hub on Hunters since 2026-10-01, a
--    real group that keeps some demo events (see hub-live.sql). Both stay in the roster below.
update public.groups set demo = true
 where id in (select id from demo_groups_here where name not in ('Torrez Fitness', 'Hub on Hunters'));

-- 2. The testers' roles (the brief's roster; emails as the accounts actually exist), keyed by group id
insert into public.demo_roster (email, group_id, role)
select v.email, g.id, v.role from (values
  ('eric@ericscott-creative.com', 'Hub on Hunters', 'owner'),
  ('eric@ericscott-creative.com', 'Walnut Creek Neighborhood', 'owner'),
  ('eric@ericscott-creative.com', 'Woodcliff Neighborhood', 'owner'),
  ('eric@ericscott-creative.com', 'Torrez Fitness', 'owner'),
  ('ejshaughn@gmail.com', 'Hub on Hunters', 'owner'),                 -- Emily
  ('ejshaughn@gmail.com', 'Walnut Creek Neighborhood', 'admin'),
  ('stacy.claye@gmail.com', 'Hub on Hunters', 'admin'),               -- Stacy
  ('stacy.claye@gmail.com', 'Woodcliff Neighborhood', 'admin'),
  ('auburn.layman@gmail.com', 'Walnut Creek Neighborhood', 'owner'),  -- Auburn
  ('auburn.layman@gmail.com', 'Hub on Hunters', 'admin'),
  ('torrez.fitness@gmail.com', 'Woodcliff Neighborhood', 'owner'),    -- Joseph
  ('torrez.fitness@gmail.com', 'Torrez Fitness', 'owner')
) as v(email, group_name, role) join demo_groups_here g on g.name = v.group_name
on conflict (email, group_id) do update set role = excluded.role;

-- 3. The seeded content: anything led or posted by the demo people, plus the owner's seeded plans
update public.sparks s set demo = true
  from auth.users u
 where u.id in (s.lead_id, s.created_by) and u.email like 'seed-%@example.com';
update public.sparks s set demo = true
  from auth.users u
 where u.id = s.lead_id and u.email = 'eric@ericscott-creative.com'
   and s.text in ('Sunrise loop around the lake', 'Garden work day at the Hub', 'Paint a Hub mural!!!', 'Friendsgiving potluck', 'Poker night');
-- (seed-events.py sets the flag on everything it makes; this line only matters for older seeds)

-- 4. Only the owner can wipe it
insert into public.demo_admins (user_id)
select id from auth.users where email = 'eric@ericscott-creative.com'
on conflict do nothing;

-- 5. Roster roles for the named testers (nobody else is added to the demo groups automatically)
select public.apply_demo_world(id, email) from auth.users
 where email is not null and coalesce(is_anonymous, false) = false;

select (select count(*) from public.sparks where demo) as demo_items,
       (select count(*) from public.groups where demo) as demo_groups,
       (select count(*) from public.demo_admins) as wipers;
