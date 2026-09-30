-- Demo groups (owner, 2026-09-30): all three demo groups get the Hub on Hunters treatment, and "demo" moves
-- out of the name into a chip.
--  1. The app may read groups.demo (it shows a DEMO chip by the group's name). Clients still can't change it.
--  2. "Hub on Hunters (Demo)" is "Hub on Hunters" again (the demo roster is keyed by name, so it follows).
--  3. Joining Torrez Fitness by its link also makes you a plain member of Walnut Creek Neighborhood and
--     Woodcliff Neighborhood (join_also, as for Hub on Hunters), and the people already in Torrez get them now.
grant select (demo) on table public.groups to authenticated;

update public.demo_roster set group_name = 'Hub on Hunters' where group_name = 'Hub on Hunters (Demo)';
update public.groups set name = 'Hub on Hunters' where name = 'Hub on Hunters (Demo)';

insert into public.join_also (group_id, also_group_id)
  select t.id, g.id from public.groups t, public.groups g
   where t.code = 'TORREZ' and g.demo and g.name in ('Walnut Creek Neighborhood', 'Woodcliff Neighborhood')
  on conflict do nothing;
insert into public.memberships (group_id, user_id)
  select j.also_group_id, m.user_id from public.join_also j join public.memberships m on m.group_id = j.group_id
    join auth.users u on u.id = m.user_id
   where u.email not ilike '%@example.com'   -- test accounts stay as they are
  on conflict do nothing;
