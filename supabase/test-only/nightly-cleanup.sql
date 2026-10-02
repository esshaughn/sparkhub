-- TEST PROJECT ONLY (sparkhub-test, hroxgvxvafgikikviiud). Never run this on live:
-- on live, anonymous users are real members' identities.
--
-- The end-to-end tests delete the ideas they create, but every simulated member is a
-- new anonymous sign-in that nothing can remove from the browser. This job
-- sweeps them, plus [E2E] ideas left behind by a crashed run and the [E2E] groups
-- the group tests create (nothing in the app deletes a group).
-- It runs every hour (nightly until 2026-10-02): every lead loads every [E2E] event in
-- Torrez Fitness, so a day of leftovers (222 that afternoon) made each load three times
-- as slow and full runs timed out, which left more behind.
--
-- Apply (or re-apply) with:
--   supabase db query --linked --project-ref hroxgvxvafgikikviiud -f supabase/test-only/nightly-cleanup.sql

create extension if not exists pg_cron;

select cron.unschedule('e2e-cleanup')
 where exists (select 1 from cron.job where jobname = 'e2e-cleanup');

select cron.schedule('e2e-cleanup', '0 * * * *', $job$
  delete from public.sparks where text like '[E2E]%' and created_at < now() - interval '2 hours';
  delete from public.groups where name like '[E2E]%' and created_at < now() - interval '2 hours';
  delete from public.feedback where body like '[E2E]%' and created_at < now() - interval '2 hours';
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

-- Tests check who a host's update would reach (private.update_recipients, 20261101000000_update_recipients.sql).
-- Only the event's lead, and only for [E2E] events.
create or replace function public.e2e_update_recipients(p_spark uuid, p_audience text)
returns uuid[] language sql security definer set search_path = public as $$
  select private.update_recipients(s.id, p_audience, auth.uid())
    from sparks s where s.id = p_spark and s.lead_id = auth.uid() and s.text like '[E2E]%';
$$;
revoke execute on function public.e2e_update_recipients(uuid, text) from public, anon;
grant  execute on function public.e2e_update_recipients(uuid, text) to authenticated;

-- Declined friend requests never go away in the app (so the person turned down can't ask again), but the
-- e2e lead accounts are reused run after run: tests clear the requests between two of them.
create or replace function public.e2e_forget_requests(p_other uuid)
returns void language sql security definer set search_path = public, auth as $$
  delete from friend_requests r
   where ((r.from_id = auth.uid() and r.to_id = p_other) or (r.from_id = p_other and r.to_id = auth.uid()))
     and (select count(*) from auth.users u where u.id in (auth.uid(), p_other) and u.email like 'e2e-lead-%@example.com') = 2;
$$;
revoke execute on function public.e2e_forget_requests(uuid) from public, anon;
grant  execute on function public.e2e_forget_requests(uuid) to authenticated;
