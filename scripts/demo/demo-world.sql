-- The shared demo world's data (owner's brief, 2026-09-29). Run after the demo_world migration and
-- the demo seed scripts, on test and (by the owner) on live:
--   Test: supabase db query --linked -f scripts/demo/demo-world.sql
--   Live: supabase db query --linked --project-ref xwrzfpgsazyrgieymtee -f scripts/demo/demo-world.sql
-- Safe to re-run. Roles only go up; nobody is removed from anything.

-- 1. The four demo groups: everyone who signs in joins them as a member
update public.groups set demo = true
 where name in ('Hub on Hunters', 'Walnut Creek Neighborhood', 'Woodcliff Neighborhood', 'Torrez Fitness');

-- 2. The testers' roles (the brief's roster; emails as the accounts actually exist)
insert into public.demo_roster (email, group_name, role) values
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
on conflict (email, group_name) do update set role = excluded.role;

-- Earlier pre-arranged invites (test-only/pending-invites.sql) carry over where the roster doesn't cover them
do $$ begin
  if to_regclass('public.test_pending_invites') is not null then
    insert into public.demo_roster (email, group_name, role)
    select email, group_name, role from public.test_pending_invites
    on conflict (email, group_name) do nothing;
  end if;
end $$;

-- 3. The seeded content: anything led or posted by the demo people, plus the owner's seeded plans
update public.sparks s set demo = true
  from auth.users u
 where u.id in (s.lead_id, s.created_by) and u.email like 'seed-%@example.com';
update public.sparks s set demo = true
  from auth.users u
 where u.id = s.lead_id and u.email = 'eric@ericscott-creative.com'
   and s.text in ('Sunrise loop around the lake', 'Garden workday', 'Welcome picnic for new neighbors', 'Paint a Hub mural!!!', 'Friendsgiving potluck');

-- 4. Only the owner can wipe it
insert into public.demo_admins (user_id)
select id from auth.users where email = 'eric@ericscott-creative.com'
on conflict do nothing;

-- 5. Everyone already signed in gets it now (new sign-ups get it from the trigger)
select public.apply_demo_world(id, email) from auth.users
 where email is not null and coalesce(is_anonymous, false) = false;

select (select count(*) from public.sparks where demo) as demo_items,
       (select count(*) from public.groups where demo) as demo_groups,
       (select count(*) from public.demo_admins) as wipers;
