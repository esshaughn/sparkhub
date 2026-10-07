-- First-run flags follow the account (first-encounter audit 7, owner 2026-10-07): the installed iPhone app has its own
-- storage, so group welcomes, the feedback ask, swipe hints, the Me banners and the Ideas dot all came back there.
-- notif_state.seen is a small object only its owner reads and writes (the table's existing rules); the app also keeps
-- each flag on the device, and reads this column tolerantly, so a database without it still works.
alter table public.notif_state
  add column if not exists seen jsonb not null default '{}'::jsonb
    check (jsonb_typeof(seen) = 'object' and pg_column_size(seen) < 4000);
grant update (seen) on table public.notif_state to authenticated;
