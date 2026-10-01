-- Hub on Hunters gets a fixed join code, so the pitch page (demo.wereallneighbors.org) can link to
-- /join/HUNTER in both databases. Its code was random (scripts/demo/seed-demo.py), so links shared
-- with the old code stop working. Joining it adds no other group (join_also has no row for it).
update public.groups set code = 'HUNTER'
 where name = 'Hub on Hunters' and code <> 'HUNTER'
   and not exists (select 1 from public.groups where code = 'HUNTER');
