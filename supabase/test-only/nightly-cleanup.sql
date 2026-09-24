-- TEST PROJECT ONLY (torrezhub-test, hroxgvxvafgikikviiud). Never run this on live:
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
