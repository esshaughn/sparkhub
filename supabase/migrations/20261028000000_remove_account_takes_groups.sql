-- Remove an account (owner, 2026-09-30): when they're a group's only owner, the caller takes over
-- as its owner instead of being refused. Returns the names of those groups (comma-separated, '' if none).
-- Still owner only, and never yourself or another admin. Their events go too (quietly); everything
-- else of theirs goes with the account (cascades).

create or replace function public.remove_account(p_user uuid)
returns text language plpgsql security definer set search_path = public, auth as $$
declare v_taken text[];
begin
  if not exists (select 1 from demo_admins where user_id = auth.uid()) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user = auth.uid() or exists (select 1 from demo_admins where user_id = p_user) then raise exception 'can''t remove an admin account'; end if;
  -- Groups they're the only owner of: the caller becomes an owner (joining if they weren't a member)
  with sole as (
    select g.id, g.name from groups g join memberships m on m.group_id = g.id and m.user_id = p_user and m.role = 'owner'
     where not exists (select 1 from memberships o where o.group_id = g.id and o.role = 'owner' and o.user_id <> p_user)
  ), taken as (
    insert into memberships (group_id, user_id, role) select id, auth.uid(), 'owner' from sole
    on conflict (group_id, user_id) do update set role = 'owner'
    returning group_id
  )
  select array_agg(s.name order by s.name) into v_taken from sole s join taken t on t.group_id = s.id;
  delete from sparks where lead_id = p_user;
  update sparks set created_by = lead_id where created_by = p_user;
  delete from offers where user_id = p_user;
  delete from auth.users where id = p_user;
  return coalesce(array_to_string(v_taken, ', '), '');
end $$;
revoke all on function public.remove_account(uuid) from public, anon;
grant execute on function public.remove_account(uuid) to authenticated;
