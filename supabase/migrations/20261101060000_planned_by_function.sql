-- Whether an event is a plan changes only through make_plan() / clear_plan() (lead only, with their
-- checks and notes), not a direct update. Posting still sets it on insert.
revoke update (planned) on table public.sparks from authenticated;
