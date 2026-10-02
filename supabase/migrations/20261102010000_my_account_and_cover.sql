-- Owner, 2026-10-02 (the review's "not now" items, built after all):
--  1. delete_group(): an owner can delete their only group. The function still refused ("you need to be in at least one
--     group") after the app stopped asking for that, so the only owner of their only group could neither leave nor
--     delete it. A plain member could always leave their only group; the rule had no reason left.
--  2. remove_idea_cover(): a lead or co-lead takes an event's cover photo off (the event then shows its group's photo).
--     Returns the old path, so the app can delete the file when it's in the caller's own folder.
--  3. delete_my_account(): anyone with an account deletes it themselves (until now only the owner's New accounts list
--     could, with remove_account()). Not while they're the only owner of a group that has other people in it: someone
--     else becomes an owner first, or they delete the group. A group with nobody else in it goes with them. An event
--     they lead passes to its earliest co-lead (as when a lead steps back); one with no co-lead is deleted quietly.
--     Everything else of theirs (replies, sign-ups, votes, reactions, friends, notes, push devices) goes with the
--     auth.users row. The owner accounts (demo_admins) can't be deleted this way.

-- 1. Delete a group: owners only, with no "at least one group" rule
create or replace function public.delete_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_group) then
    raise exception 'only the group''s owners can delete it' using errcode = '42501';
  end if;
  delete from groups where id = p_group;
end $$;

-- 2. Take the cover photo off
create function public.remove_idea_cover(p_spark uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not public.is_host(p_spark) then
    raise exception 'only a host can change the cover' using errcode = '42501';
  end if;
  select photos[1] into v_old from sparks where id = p_spark;
  update sparks set photos = coalesce(photos[2:], '{}'), cover_pos = null where id = p_spark;
  return v_old;
end $$;
revoke all on function public.remove_idea_cover(uuid) from public, anon;
grant execute on function public.remove_idea_cover(uuid) to authenticated;

-- 3. Delete your own account
create function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid := auth.uid(); v_groups text;
begin
  if v_me is null or not public.is_signed_in() then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from demo_admins where user_id = v_me) then
    raise exception 'an owner account can''t be deleted here' using errcode = '42501';
  end if;
  select string_agg(g.name, ', ' order by g.name) into v_groups
    from groups g join memberships m on m.group_id = g.id and m.user_id = v_me and m.role = 'owner'
   where not exists (select 1 from memberships o where o.group_id = g.id and o.role = 'owner' and o.user_id <> v_me)
     and exists (select 1 from memberships o where o.group_id = g.id and o.user_id <> v_me);
  if v_groups is not null then
    raise exception 'only owner of: %', v_groups using errcode = '23514';
  end if;
  -- Groups with nobody else in them
  delete from groups g
   where exists (select 1 from memberships m where m.group_id = g.id and m.user_id = v_me and m.role = 'owner')
     and not exists (select 1 from memberships o where o.group_id = g.id and o.user_id <> v_me);
  -- Events they lead: the earliest co-lead takes over; the rest go quietly
  update sparks s
     set lead_id = c.user_id, lead_name = coalesce((select nullif(p.name, '') from profiles p where p.id = c.user_id), 'Someone')
    from (select distinct on (spark_id) spark_id, user_id from cohosts order by spark_id, created_at, user_id) c
   where s.lead_id = v_me and c.spark_id = s.id;
  delete from cohosts c using sparks s where c.spark_id = s.id and c.user_id = s.lead_id;
  delete from sparks where lead_id = v_me;
  update sparks set created_by = lead_id where created_by = v_me;
  delete from offers where user_id = v_me;
  delete from auth.users where id = v_me;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
