-- Event updates, one way (Design item 29, owner 2026-10-04): a lead posts to Going, or to Going and Maybe.
-- * plan_updates.audience gains 'coming' (going or maybe; 'all' also reached people who said Can't)
-- * the push reads "Joseph: <update>" under the event's name (was the update alone)

alter table public.plan_updates drop constraint if exists plan_updates_audience_check;
alter table public.plan_updates add constraint plan_updates_audience_check
  check (audience in ('all', 'going', 'maybe', 'coming', 'noreply'));

-- Who a host's update reaches (as 20261101130000_cohosts.sql, plus 'coming')
create or replace function private.update_recipients(p_spark uuid, p_audience text, p_by uuid)
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct u) filter (where u is not null and u is distinct from p_by), '{}')
    from (
      -- Not replied yet: members who can see the event
      select m.user_id as u
        from sparks s
        join memberships m on m.group_id = s.group_id
                           or m.group_id in (select g.group_id from spark_groups g where g.spark_id = s.id)
       where s.id = p_spark and p_audience = 'noreply'
         and (s.visibility = 'group' or m.user_id = s.lead_id or m.role in ('owner', 'admin')
              or exists (select 1 from cohosts c where c.spark_id = s.id and c.user_id = m.user_id)
              or exists (select 1 from link_access l where l.spark_id = s.id and l.user_id = m.user_id))
         and not exists (select 1 from rsvps r where r.spark_id = s.id and r.user_id = m.user_id)
      union
      select r.user_id from rsvps r
       where r.spark_id = p_spark and p_audience in ('going', 'maybe') and r.status = p_audience
      union
      select r.user_id from rsvps r
       where r.spark_id = p_spark and p_audience = 'coming' and r.status in ('going', 'maybe')
      union
      select r.user_id from rsvps r where r.spark_id = p_spark and p_audience = 'all'
      union
      select c.user_id from signup_claims c join signup_items i on i.id = c.item_id
       where i.spark_id = p_spark and p_audience = 'all'
    ) x;
$$;

-- The push: the event's name as the title, "First name: update" as the body
create or replace function private.push_update() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; who text;
begin
  if auth.uid() is null then return null; end if;
  select id, text into s from sparks where id = new.spark_id;
  select nullif(split_part(trim(name), ' ', 1), '') into who from profiles where id = new.created_by;
  perform private.push_send(private.update_recipients(s.id, new.audience, new.created_by),
    'updates', s.text, coalesce(who || ': ', '') || new.body, '/#/idea/' || s.id, 'u:' || new.id);
  return null;
end $$;
