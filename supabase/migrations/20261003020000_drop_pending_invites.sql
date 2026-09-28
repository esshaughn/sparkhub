-- The old pre-arranged invites table (test-only/pending-invites.sql) was superseded by the demo
-- roster; its trigger was dropped in 20260930000000_demo_world.sql. Carry any rows the roster
-- doesn't already have across, then drop the table and its function. No-op where it never existed.
do $$ begin
  if to_regclass('public.test_pending_invites') is not null then
    insert into public.demo_roster (email, group_name, role)
    select email, group_name, role from public.test_pending_invites
    on conflict (email, group_name) do nothing;
  end if;
end $$;

drop trigger if exists test_apply_pending_invites on auth.users;
drop function if exists public.test_apply_pending_invites() cascade;
drop table if exists public.test_pending_invites;
