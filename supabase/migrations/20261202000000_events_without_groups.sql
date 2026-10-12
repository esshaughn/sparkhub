-- Events without a group (owner, 2026-10-12): an event no longer has to live in a group. A personal event has
-- group_id null and is always invite-only (visibility 'invite'). Who sees it: its lead, co-hosts, the people invited
-- or holding its link, and anyone who replied. Nobody gets a "new event" push for it (those go to groups), and it
-- can't be posted to groups (the spark_groups insert rule compares against the home group, which is null).
-- "The event's people" (who may take the lead, be asked to lead or made a co-host) are, for a personal event, the
-- people it was shared with and the lead's friends, in place of the members of its groups.

alter table public.sparks alter column group_id drop not null;
alter table public.sparks add constraint sparks_personal_invite_only check (group_id is not null or visibility = 'invite');

-- Posting: a personal event needs no group; a group event still needs you to be in the group
alter policy "post a spark as yourself" on public.sparks
  with check (created_by = auth.uid() and lead_id = auth.uid() and public.is_signed_in()
              and (group_id is null or public.is_member(group_id))
              and public.all_match(photos, '^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$')
              and public.all_match(mood, '^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$'));

-- Who sees an event: the same as before, plus, for a personal event, its lead and anyone who replied
-- (a group event gives those through the membership branch)
create or replace function public.can_see_spark_row(p_id uuid, p_group uuid, p_lead uuid, p_visibility text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from link_access l where l.spark_id = p_id and l.user_id = auth.uid())
      or exists (select 1 from cohosts c where c.spark_id = p_id and c.user_id = auth.uid())
      or (p_group is null and (p_lead = auth.uid()
                               or exists (select 1 from rsvps r where r.spark_id = p_id and r.user_id = auth.uid())))
      or exists (select 1 from memberships m
                  where m.user_id = auth.uid()
                    and (m.group_id = p_group
                         or m.group_id in (select g.group_id from spark_groups g where g.spark_id = p_id))
                    and (p_visibility = 'group' or p_lead = auth.uid() or public.is_admin(m.group_id)
                         or exists (select 1 from rsvps r where r.spark_id = p_id and r.user_id = auth.uid())));
$$;

-- The event's people: members of its groups; for a personal event, the people it was shared with
-- (link or invite), co-hosts, anyone who replied, and the lead's friends
create or replace function private.in_event_groups(p_spark uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
     where m.user_id = p_user
       and (m.group_id = (select group_id from sparks where id = p_spark)
            or m.group_id in (select g.group_id from spark_groups g where g.spark_id = p_spark)))
  or exists (
    select 1 from sparks s
     where s.id = p_spark and s.group_id is null
       and (p_user in (s.lead_id, s.created_by)
            or exists (select 1 from link_access l where l.spark_id = s.id and l.user_id = p_user)
            or exists (select 1 from cohosts c where c.spark_id = s.id and c.user_id = p_user)
            or exists (select 1 from rsvps r where r.spark_id = s.id and r.user_id = p_user)
            or exists (select 1 from friendships f
                        where f.user_a = least(s.lead_id, p_user) and f.user_b = greatest(s.lead_id, p_user))));
$$;

-- Co-hosts come from the event's people (was: an inline check on the event's groups)
create or replace function public.add_cohost(p_spark uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_name text;
begin
  select id, text, lead_id, group_id, cancelled_at into s from sparks where id = p_spark;
  if s.id is null or not (public.is_host(p_spark) or public.is_admin(s.group_id)) then
    raise exception 'only a host can add co-hosts' using errcode = '42501';
  end if;
  if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '22023'; end if;
  if p_user is null or p_user = s.lead_id then raise exception 'they already lead it' using errcode = '22023'; end if;
  -- An account (not a guest) among the event's people
  if not exists (select 1 from auth.users u where u.id = p_user and not coalesce(u.is_anonymous, false))
     or not private.in_event_groups(p_spark, p_user) then
    raise exception 'co-hosts come from the event''s groups' using errcode = '22023';
  end if;
  if (select count(*) from cohosts where spark_id = p_spark) >= 5 then raise exception 'up to 5 co-hosts' using errcode = '22023'; end if;
  insert into cohosts (spark_id, user_id, added_by) values (p_spark, p_user, auth.uid()) on conflict do nothing;
  if found then
    v_name := private.person_name(auth.uid(), p_spark);
    insert into notes (user_id, body, created_by)
      values (p_user, left(v_name || ' made you a co-lead of ' || left(s.text, 120) || '.', 320), auth.uid());
  end if;
end $$;

-- A host's update to "hasn't replied": for a personal event, the people it was shared with who haven't replied
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
      -- Not replied yet, personal event: the people it was shared with
      select l.user_id
        from sparks s join link_access l on l.spark_id = s.id
       where s.id = p_spark and p_audience = 'noreply' and s.group_id is null
         and not exists (select 1 from rsvps r where r.spark_id = s.id and r.user_id = l.user_id)
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
