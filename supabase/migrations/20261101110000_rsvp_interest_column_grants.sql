-- Supabase's default privileges gave `authenticated` UPDATE on every column of rsvps and interests, so the
-- column grants in 20260926000000_plans.sql and 20261101090000_hosts_and_who_came.sql added nothing:
-- * rsvps: you could check yourself in (attended), or move your reply to another event by changing spark_id,
--   which skipped the insert checks (can see it, it's a plan) and then made an invite-only event visible.
-- * interests: with the new "change your interest" policy, you could move your interest to another event.
-- Updates are now limited to the one column each table's app code changes.

revoke update on table public.rsvps from authenticated;
grant update (status) on table public.rsvps to authenticated;

revoke update on table public.interests from authenticated;
grant update (can_help) on table public.interests to authenticated;
