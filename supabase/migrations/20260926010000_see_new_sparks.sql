-- Fix: posting an idea failed ("new row violates row-level security policy").
-- The sparks read policy called can_see_spark(id), which looks the row up by id; during
-- insert ... returning the new row isn't visible to that lookup yet, so the check failed.
-- The policy now checks the row's own columns; can_see_spark(id) shares the same rule.

create or replace function public.can_see_spark_row(p_id uuid, p_group uuid, p_lead uuid, p_visibility text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from link_access l where l.spark_id = p_id and l.user_id = auth.uid())
      or (exists (select 1 from memberships m where m.group_id = p_group and m.user_id = auth.uid())
          and (p_visibility = 'group' or p_lead = auth.uid() or public.is_admin(p_group)
               or exists (select 1 from rsvps r where r.spark_id = p_id and r.user_id = auth.uid())));
$$;

create or replace function public.can_see_spark(p_spark uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from sparks s where s.id = p_spark
                  and public.can_see_spark_row(s.id, s.group_id, s.lead_id, s.visibility));
$$;

drop policy "members and link holders see an idea" on public.sparks;
create policy "members and link holders see an idea" on public.sparks
  for select to authenticated using (public.can_see_spark_row(id, group_id, lead_id, visibility));

revoke execute on function public.can_see_spark_row(uuid, uuid, uuid, text) from public, anon;
grant  execute on function public.can_see_spark_row(uuid, uuid, uuid, text) to authenticated;
