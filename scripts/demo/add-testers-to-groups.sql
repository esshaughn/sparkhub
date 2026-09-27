-- Put every current tester in every current group (owner's request, 2026-09-27).
-- Testers: every signed-in account that isn't anonymous or an @example.com test/demo account.
-- Groups: all of them except the end-to-end tests' "[E2E] …" groups.
-- New memberships are plain members; existing memberships and roles are left exactly as they are.
-- Safe to re-run. Run it before scripts/demo/seed-events.py so the new groups get their share.
--   Test: supabase db query --linked -f scripts/demo/add-testers-to-groups.sql
--   Live: supabase db query --linked --project-ref xwrzfpgsazyrgieymtee -f scripts/demo/add-testers-to-groups.sql

with added as (
  insert into public.memberships (group_id, user_id, role)
  select g.id, u.id, 'member'
    from auth.users u cross join public.groups g
   where u.email is not null
     and coalesce(u.is_anonymous, false) = false
     and u.email not ilike '%@example.com'
     and g.name not like '[E2E]%'
  on conflict (group_id, user_id) do nothing
  returning group_id, user_id
)
select u.email, g.name as joined_group
  from added a join auth.users u on u.id = a.user_id join public.groups g on g.id = a.group_id
 order by u.email, g.name;
