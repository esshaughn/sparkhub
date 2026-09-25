-- TEST PROJECT ONLY (sparkhub-test, hroxgvxvafgikikviiud). Never run this on live:
-- on live, anonymous users are real members' identities.
--
-- The end-to-end tests delete the ideas they create, but every simulated member is a
-- new anonymous sign-in that nothing can remove from the browser. This nightly job
-- sweeps them, plus [E2E] ideas left behind by a crashed run and the [E2E] groups
-- the group tests create (nothing in the app deletes a group).
--
-- Apply (or re-apply) with:
--   supabase db query --linked --project-ref hroxgvxvafgikikviiud -f supabase/test-only/nightly-cleanup.sql

create extension if not exists pg_cron;

select cron.unschedule('e2e-cleanup')
 where exists (select 1 from cron.job where jobname = 'e2e-cleanup');

select cron.schedule('e2e-cleanup', '0 4 * * *', $job$
  delete from public.sparks where text like '[E2E]%' and created_at < now() - interval '2 hours';
  delete from public.groups where name like '[E2E]%' and created_at < now() - interval '2 hours';
  delete from auth.users   where is_anonymous      and created_at < now() - interval '1 day';
$job$);

-- Tests delete the [E2E] groups they start (the app itself can't delete groups).
-- Only the group's admin, and only groups named [E2E] …
create or replace function public.e2e_delete_group(p_group uuid)
returns boolean language sql security definer set search_path = public as $$
  with gone as (
    delete from groups g
     where g.id = p_group and g.name like '[E2E]%' and public.is_admin(g.id)
    returning 1
  ) select exists (select 1 from gone);
$$;
revoke execute on function public.e2e_delete_group(uuid) from public, anon;
grant  execute on function public.e2e_delete_group(uuid) to authenticated;
