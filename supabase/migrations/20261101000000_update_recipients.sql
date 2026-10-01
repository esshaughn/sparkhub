-- Who a host's update goes to, worked out in one place (private.update_recipients) so it can be checked.
-- "Hasn't replied" follows the same visibility rule as the event itself (can_see_spark_row): a member
-- of one of the event's groups gets it only if the event is visible to the whole group, or they lead it,
-- run that group (owner or admin), or hold a link to it. Roles are read from memberships for each person;
-- is_admin() and can_see_spark() can't be used here because they check auth.uid(), which is the host.

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
              or exists (select 1 from link_access l where l.spark_id = s.id and l.user_id = m.user_id))
         and not exists (select 1 from rsvps r where r.spark_id = s.id and r.user_id = m.user_id)
      union
      select r.user_id from rsvps r
       where r.spark_id = p_spark and p_audience in ('going', 'maybe') and r.status = p_audience
      union
      select r.user_id from rsvps r where r.spark_id = p_spark and p_audience = 'all'
      union
      select c.user_id from signup_claims c join signup_items i on i.id = c.item_id
       where i.spark_id = p_spark and p_audience = 'all'
    ) x;
$$;
revoke all on function private.update_recipients(uuid, text, uuid) from public, anon, authenticated;

create or replace function private.push_update() returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if auth.uid() is null then return null; end if;
  select id, text into s from sparks where id = new.spark_id;
  perform private.push_send(private.update_recipients(s.id, new.audience, new.created_by),
    'updates', s.text, new.body, '/#/idea/' || s.id, 'u:' || new.id);
  return null;
end $$;
