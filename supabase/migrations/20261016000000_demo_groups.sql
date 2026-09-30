-- Demo groups (owner, 2026-09-30): "demo" moves out of the name into a chip.
--  1. The app may read groups.demo (it shows a DEMO chip by the group's name). Clients still can't change it.
--  2. "Hub on Hunters (Demo)" is "Hub on Hunters" again (the demo roster is keyed by name, so it follows).
-- Torrez joiners still land in Torrez Fitness and Hub on Hunters only (join_also, 20261013000000); the owner
-- decided against adding Walnut Creek and Woodcliff. (An earlier draft of this file did add them; it ran on TEST
-- only, and those join_also rows were removed there by hand.)
grant select (demo) on table public.groups to authenticated;

update public.demo_roster set group_name = 'Hub on Hunters' where group_name = 'Hub on Hunters (Demo)';
update public.groups set name = 'Hub on Hunters' where name = 'Hub on Hunters (Demo)';
