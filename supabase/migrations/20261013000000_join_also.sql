-- Joining one group can also add you to others (owner, 2026-09-29): everyone who joins Torrez Fitness
-- with its link (TORREZ) also becomes a plain member of Hub on Hunters (Demo), so their community
-- Calendar has events as soon as they sign in. Membership only: no roster role, no sign-ups, no RSVPs.
-- Hub on Hunters is renamed "Hub on Hunters (Demo)".
create table public.join_also (
  group_id      uuid not null references public.groups (id) on delete cascade,
  also_group_id uuid not null references public.groups (id) on delete cascade,
  primary key (group_id, also_group_id),
  check (group_id <> also_group_id)
);
alter table public.join_also enable row level security;   -- no policies: not readable by the app
revoke all on table public.join_also from anon, authenticated;

create or replace function public.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_signed_in() then raise exception 'sign in to join a group'; end if;
  select g.id into v_id from groups g where g.code = upper(trim(p_code));
  if v_id is null then return null; end if;
  insert into memberships (group_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
  insert into memberships (group_id, user_id)
    select j.also_group_id, auth.uid() from join_also j where j.group_id = v_id
    on conflict do nothing;
  return v_id;
end $$;
revoke execute on function public.join_group(text) from public, anon;
grant  execute on function public.join_group(text) to authenticated;

-- The rename (the demo roster is keyed by group name, so it follows)
update public.demo_roster set group_name = 'Hub on Hunters (Demo)' where group_name = 'Hub on Hunters';
update public.groups set name = 'Hub on Hunters (Demo)' where name = 'Hub on Hunters';

-- Torrez Fitness → Hub on Hunters (Demo), and the people who already joined Torrez get it now too
insert into public.join_also (group_id, also_group_id)
  select t.id, h.id from public.groups t, public.groups h
   where t.code = 'TORREZ' and h.name = 'Hub on Hunters (Demo)'
  on conflict do nothing;
insert into public.memberships (group_id, user_id)
  select j.also_group_id, m.user_id from public.join_also j join public.memberships m on m.group_id = j.group_id
    join auth.users u on u.id = m.user_id
   where u.email not ilike '%@example.com'   -- test accounts stay as they are
  on conflict do nothing;
