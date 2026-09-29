-- Demo groups are opt-in (owner, 2026-09-29). Torrez Fitness is the one real pilot group, so signing in
-- no longer adds anyone to the demo groups: people join them with their invite codes, which the owner
-- shares by hand. Named testers still get their roster roles (and their demo plans) when they sign in.
-- Nobody already in a group is removed.
create or replace function public.apply_demo_world(p_user uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare r record; cur text; rank_of constant jsonb := '{"member":1,"admin":2,"owner":3}';
begin
  if p_email is null or p_email ilike '%@example.com' then return; end if;   -- test and demo accounts
  for r in select g.id as group_id, d.role from demo_roster d join groups g on g.name = d.group_name
            where lower(d.email) = lower(p_email) loop
    select role into cur from memberships where group_id = r.group_id and user_id = p_user;
    if r.role = 'owner' and (select count(*) from memberships where group_id = r.group_id and role = 'owner' and user_id <> p_user) >= 2 then
      r.role := 'admin';
    end if;
    if cur is null then
      insert into memberships (group_id, user_id, role) values (r.group_id, p_user, r.role);
    elsif (rank_of ->> r.role)::int > (rank_of ->> cur)::int then
      update memberships set role = r.role where group_id = r.group_id and user_id = p_user;
    end if;
  end loop;
  if exists (select 1 from demo_roster where lower(email) = lower(p_email)) then
    perform public.demo_participate(p_user);
  end if;
end $$;
revoke execute on function public.apply_demo_world(uuid, text) from public, anon, authenticated;
