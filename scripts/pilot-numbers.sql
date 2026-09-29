-- The pilot's numbers to watch: Torrez Fitness, real people only (accounts ending @example.com, demo
-- events and [E2E] test posts are left out). Read-only: it changes nothing. Run it weekly and keep the results.
--   Live: supabase db query --linked --project-ref xwrzfpgsazyrgieymtee -f scripts/pilot-numbers.sql -o table
--   Test: supabase db query --linked -f scripts/pilot-numbers.sql -o table
--
-- The four headline numbers are marked ★. "Seen" comes from memberships.last_seen_at, which holds only the LAST
-- visit, so it says who came back this week, not how often: write the number down each week to see the trend.

with g as (select id from public.groups where name = 'Torrez Fitness'),
people as (                       -- real members of Torrez
  select m.user_id, m.joined_at, m.last_seen_at, m.role
    from public.memberships m join g on g.id = m.group_id
    join auth.users u on u.id = m.user_id
   where u.email is not null and u.email not ilike '%@example.com'
),
n as (select count(*)::numeric as members from people),
ev as (                           -- real events posted in Torrez, led by real people
  select s.id, s.created_at, s.planned, s.lead_id, s.day_date
    from public.sparks s join g on g.id = s.group_id
    join auth.users u on u.id = s.lead_id
   where not s.demo and u.email is not null and u.email not ilike '%@example.com' and s.text not like '[E2E]%'
),
per_event as (                    -- for each planned event: real members (other than its lead) who said Going or Maybe
  select e.id, count(distinct r.user_id) filter (
           where r.status in ('going', 'maybe') and r.user_id <> e.lead_id and r.user_id in (select user_id from people)) as answered
    from ev e left join public.rsvps r on r.spark_id = e.id
   where e.planned group by e.id
),
leaf as (                         -- sign-up rows people actually claim (a job with shifts is claimed through its shifts)
  select i.id, i.need from public.signup_items i join ev e on e.id = i.spark_id
   where not exists (select 1 from public.signup_items c where c.shift_of = i.id)
),
rows_ as (
  select 1 as o, '★ Members (real people in Torrez)' as metric, (select members from n)::text as value
  union all select 2, '   joined in the last 7 days', (select count(*) from people where joined_at >= now() - interval '7 days')::text
  union all select 3, '★ Members who came back in the last 7 days',
         (select count(*) from people where last_seen_at >= now() - interval '7 days')::text
         || ' of ' || (select members from n)::text
         || coalesce(' (' || round(100.0 * (select count(*) from people where last_seen_at >= now() - interval '7 days') / nullif((select members from n), 0)) || '%)', '')
  union all select 4, '★ Events posted in the last 7 days (real hosts)', (select count(*) from ev where created_at >= now() - interval '7 days')::text
  union all select 5, '   events posted, all time', (select count(*) from ev)::text
  union all select 6, '   of those, made into plans (with a date)', (select count(*) from ev where planned)::text
  union all select 7, '   members who have posted an event', (select count(distinct lead_id) from ev where lead_id in (select user_id from people))::text
  union all select 8, '   ...other than the owner (eric@ericscott-creative.com)',
         (select count(distinct e.lead_id) from ev e join auth.users u on u.id = e.lead_id
           where e.lead_id in (select user_id from people) and lower(u.email) <> 'eric@ericscott-creative.com')::text
  union all select 9, '★ Members who RSVP''d to someone else''s plan (at least once)',
         (select count(distinct r.user_id) from public.rsvps r join ev e on e.id = r.spark_id
           where e.planned and r.status in ('going', 'maybe') and r.user_id <> e.lead_id and r.user_id in (select user_id from people))::text
         || ' of ' || (select members from n)::text
  union all select 10, '   average share of members answering each plan',
         coalesce(round(100.0 * (select avg(answered) from per_event) / nullif((select members from n), 0)) || '%', 'no plans yet')
  union all select 11, '   job spots claimed / needed',
         (select count(*) from public.signup_claims c join leaf l on l.id = c.item_id where c.user_id in (select user_id from people))::text
         || ' / ' || coalesce((select sum(need) from leaf where need is not null), 0)::text
  union all select 12, '   members with phone notifications on',
         (select count(distinct p.user_id) from public.push_subscriptions p where p.user_id in (select user_id from people))::text
         || ' of ' || (select members from n)::text
  union all select 13, '   reactions and thank-yous on Torrez events',
         (select count(*) from public.reactions x join ev e on e.id = x.spark_id where x.user_id in (select user_id from people))::text
  union all select 14, '   upcoming real plans', (select count(*) from ev where planned and day_date >= current_date)::text
)
select metric, value from rows_ order by o;
