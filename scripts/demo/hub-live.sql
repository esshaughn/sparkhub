-- Hub on Hunters becomes a real group that keeps some demo events (owner, 2026-10-01).
--   Test: supabase db query --linked -f scripts/demo/hub-live.sql
--   Live: supabase db query --linked --project-ref xwrzfpgsazyrgieymtee -f scripts/demo/hub-live.sql
-- Safe to re-run. Unlike pilot-torrez.sql it deletes nothing: the demo events (seed-hub.py) stay, with their
-- DEMO pill and Test event tab, and the demo people stay members because they host them. Only the group's
-- own DEMO chip goes. Its name stays reserved (it's in demo_roster), and the roster testers' one-time
-- sign-in activity (demo_participate) no longer reaches into it.
update public.groups set demo = false where code = 'HUNTER';

-- The owner's titles for the 2027 events (they were typed as 2026)
update public.sparks set text = 'Mini Gras 2027'
 where demo and text = 'Mini Gras 2026' and group_id = (select id from public.groups where code = 'HUNTER');
update public.sparks set text = 'Egg Hunt 2027'
 where demo and text = 'Egg Hunt 2026' and group_id = (select id from public.groups where code = 'HUNTER');

select name, demo,
       (select count(*) from public.sparks s where s.group_id = g.id and s.demo) as demo_events,
       (select count(*) from public.sparks s where s.group_id = g.id and not s.demo) as real_events
  from public.groups g where code = 'HUNTER';
