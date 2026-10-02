-- No more "testers" (owner, 2026-10-01): Emily, Stacy, Auburn, Joseph and Tom are ordinary members.
--   Test: supabase db query --linked -f scripts/demo/plain-testers.sql
--   Live: supabase db query --linked --project-ref xwrzfpgsazyrgieymtee -f scripts/demo/plain-testers.sql
-- Safe to re-run. People missing from a database are skipped.
--   * Off the demo roster (the owner's own rows stay), so sign-in never hands them roles or demo activity again.
--   * Their groups and roles: Joseph owns Torrez Fitness and Woodcliff and is a member of Hub on Hunters;
--     Tom is a member of Torrez and Hub; Emily, Stacy and Auburn are members of Walnut Creek, Hub and Torrez.
--     They leave any other demo group (Walnut Creek / Woodcliff). Real events they posted are not touched.
--   * Demo events they host go to the demo people (Marisol, Darnell, Theo, Hana, Dee), and their replies,
--     sign-ups, interest, votes, suggestions, organizer and co-host rows on demo events are removed.

create temp table people as
select u.id, v.email from (values
  ('ejshaughn@gmail.com'), ('stacy.claye@gmail.com'), ('auburn.layman@gmail.com'),
  ('torrez.fitness@gmail.com'), ('tsarvey@gmail.com')
) as v(email) join auth.users u on lower(u.email) = v.email;

-- Groups by code or by who started them, never by name alone (20261101050000_roster_by_id.sql)
create temp table grp as
select g.id, case g.code when 'TORREZ' then 'torrez' when 'HUNTER' then 'hub' end as k from public.groups g where g.code in ('TORREZ', 'HUNTER')
union
select g.id, case g.name when 'Walnut Creek Neighborhood' then 'walnut' else 'woodcliff' end from public.groups g
 where g.created_by = (select id from auth.users where email = 'eric@ericscott-creative.com')
   and g.name in ('Walnut Creek Neighborhood', 'Woodcliff Neighborhood');

-- Who belongs where, and as what
create temp table want as
select p.id as user_id, g.id as group_id, v.role from (values
  ('torrez.fitness@gmail.com', 'torrez', 'owner'), ('torrez.fitness@gmail.com', 'woodcliff', 'owner'), ('torrez.fitness@gmail.com', 'hub', 'member'),
  ('tsarvey@gmail.com', 'torrez', 'member'), ('tsarvey@gmail.com', 'hub', 'member'),
  ('ejshaughn@gmail.com', 'walnut', 'member'), ('ejshaughn@gmail.com', 'hub', 'member'), ('ejshaughn@gmail.com', 'torrez', 'member'),
  ('stacy.claye@gmail.com', 'walnut', 'member'), ('stacy.claye@gmail.com', 'hub', 'member'), ('stacy.claye@gmail.com', 'torrez', 'member'),
  ('auburn.layman@gmail.com', 'walnut', 'member'), ('auburn.layman@gmail.com', 'hub', 'member'), ('auburn.layman@gmail.com', 'torrez', 'member')
) as v(email, k, role) join people p on p.email = v.email join grp g on g.k = v.k;

-- 1. Off the roster
delete from public.demo_roster where lower(email) in (select email from people);

-- 2. Demo events they host go to a demo person (the same one each run), before anyone leaves a group
update public.sparks s set lead_id = d.id, lead_name = p.name
  from (select s2.id as spark_id,
               (array(select u.id from auth.users u
                       where u.email in ('seed-marisol@example.com', 'seed-darnell@example.com', 'seed-theo@example.com',
                                         'seed-hana@example.com', 'seed-dee@example.com') order by u.email))
               [1 + abs(hashtext(s2.id::text)) % 5] as id
          from public.sparks s2 where s2.demo and s2.lead_id in (select id from people)) d
  join public.profiles p on true
 where s.id = d.spark_id and p.id = d.id;

-- A demo person who now hosts an event isn't also one of its guests
delete from public.rsvps r using public.sparks s where s.id = r.spark_id and s.demo and r.user_id = s.lead_id;

-- 3. Their part in demo events
delete from public.rsvps r using public.sparks s where s.id = r.spark_id and s.demo and r.user_id in (select id from people);
delete from public.signup_claims c using public.signup_items i, public.sparks s
 where i.id = c.item_id and s.id = i.spark_id and s.demo and c.user_id in (select id from people);
delete from public.interests x using public.sparks s where s.id = x.spark_id and s.demo and x.user_id in (select id from people);
delete from public.organizers x using public.sparks s where s.id = x.spark_id and s.demo and x.user_id in (select id from people);
delete from public.cohosts x using public.sparks s where s.id = x.spark_id and s.demo and x.user_id in (select id from people);
delete from public.offers x using public.sparks s where s.id = x.spark_id and s.demo and x.user_id in (select id from people);
delete from public.date_votes v using public.date_options o, public.sparks s
 where o.id = v.option_id and s.id = o.spark_id and s.demo and v.user_id in (select id from people);
delete from public.spot_votes v using public.spot_options o, public.sparks s
 where o.id = v.option_id and s.id = o.spark_id and s.demo and v.user_id in (select id from people);

-- 4. Groups and roles. Owners go in before anyone is lowered, so a group never drops to no owner.
insert into public.memberships (group_id, user_id, role)
select group_id, user_id, role from want
on conflict (group_id, user_id) do update set role = excluded.role where public.memberships.role <> 'owner' or excluded.role = 'owner';
update public.memberships m set role = w.role from want w
 where m.group_id = w.group_id and m.user_id = w.user_id and m.role <> w.role;
-- Leave the demo groups (Walnut Creek / Woodcliff) not on their list, like remove_member(): their link-access rows go too
delete from public.link_access a using public.sparks s, people p
 where a.via = 'link' and s.id = a.spark_id and a.user_id = p.id
   and s.group_id in (select id from grp where k in ('walnut', 'woodcliff'))
   and not exists (select 1 from want w where w.user_id = p.id and w.group_id = s.group_id);
delete from public.memberships m using people p
 where m.user_id = p.id and m.group_id in (select id from grp where k in ('walnut', 'woodcliff'))
   and not exists (select 1 from want w where w.user_id = m.user_id and w.group_id = m.group_id);

-- Check
select p.email, string_agg(case g.k when 'torrez' then 'Torrez' when 'hub' then 'Hub' when 'walnut' then 'Walnut Creek' else 'Woodcliff' end
                           || ':' || m.role, ', ' order by g.k) as groups,
       (select count(*) from public.sparks s where s.demo and s.lead_id = p.id) as hosts_demo,
       (select count(*) from public.rsvps r join public.sparks s on s.id = r.spark_id where s.demo and r.user_id = p.id) as demo_replies,
       (select count(*) from public.demo_roster d where lower(d.email) = p.email) as roster_rows
  from people p left join public.memberships m on m.user_id = p.id left join grp g on g.id = m.group_id
 group by p.id, p.email order by p.email;
