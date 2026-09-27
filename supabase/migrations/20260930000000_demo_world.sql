-- The shared demo world (owner's brief, 2026-09-29): everyone who signs in lands in the demo
-- groups, a roster gives named testers their owner/admin roles, and the owner alone can wipe the
-- seeded demo content in one go. Which groups, content and people are "demo" is data, set by
-- scripts/demo/demo-world.sql; this migration only adds the structure.

-- Hidden flags (never shown in the app; clients can't change them: no column grants)
alter table public.sparks add column demo boolean not null default false;
alter table public.groups add column demo boolean not null default false;

-- Named testers' roles, applied when the account signs in (replaces test_pending_invites)
create table public.demo_roster (
  email      text not null,
  group_name text not null,
  role       text not null check (role in ('owner', 'admin', 'member')),
  primary key (email, group_name)
);
alter table public.demo_roster enable row level security;   -- no policies: not readable by the app
revoke all on table public.demo_roster from anon, authenticated;

-- Who may wipe the demo content (the owner's account only)
create table public.demo_admins (user_id uuid primary key references auth.users (id) on delete cascade);
alter table public.demo_admins enable row level security;
create policy "see whether you're one" on public.demo_admins for select to authenticated using (user_id = auth.uid());
revoke all on table public.demo_admins from anon, authenticated;
grant select on table public.demo_admins to authenticated;

-- Roster testers who've been put into the demo content (once each)
create table public.demo_participants (user_id uuid primary key references auth.users (id) on delete cascade);
alter table public.demo_participants enable row level security;   -- no policies
revoke all on table public.demo_participants from anon, authenticated;

-- Put a roster tester into the demo content, so their own screens aren't empty: they lead one
-- upcoming demo plan in each group they run (taken over from a demo person), say Going to two plans
-- and Maybe to one, sign up for two things (a timed one first), are interested in two ideas and
-- suggest a date on one. Picks vary per person. Skipped for anyone who already leads demo content.
create or replace function public.demo_participate(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text; v_groups uuid[]; v_runs uuid[]; r record; n int := 0;
begin
  if exists (select 1 from demo_participants where user_id = p_user) then return; end if;
  insert into demo_participants (user_id) values (p_user);
  if exists (select 1 from sparks where demo and lead_id = p_user) then return; end if;
  select left(coalesce(nullif(p.name, ''), nullif(u.raw_user_meta_data ->> 'display_name', ''), nullif(u.raw_user_meta_data ->> 'full_name', ''),
                       nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)), 40)
    into v_name from auth.users u left join profiles p on p.id = u.id where u.id = p_user;
  select array_agg(m.group_id), array_agg(m.group_id) filter (where m.role in ('owner', 'admin'))
    into v_groups, v_runs
    from memberships m join groups g on g.id = m.group_id where m.user_id = p_user and g.demo;
  if v_groups is null then return; end if;

  for r in select distinct on (s.group_id) s.id from sparks s join auth.users l on l.id = s.lead_id
            where s.demo and s.planned and s.day_date >= current_date and s.group_id = any(coalesce(v_runs, '{}'))
              and l.email like 'seed-%@example.com'
            order by s.group_id, md5(s.id::text || p_user::text) loop
    delete from rsvps where spark_id = r.id and user_id = p_user;
    update sparks set lead_id = p_user, lead_name = v_name where id = r.id;
  end loop;

  for r in select s.id from sparks s
            where s.demo and s.planned and s.day_date >= current_date and s.group_id = any(v_groups) and s.lead_id <> p_user
            order by exists (select 1 from signup_items i where i.spark_id = s.id and (i.need is null or (select count(*) from signup_claims c where c.item_id = i.id) < i.need)) desc,
                     md5(s.id::text || p_user::text)
            limit 3 loop
    n := n + 1;
    insert into rsvps (spark_id, user_id, status) values (r.id, p_user, case when n = 3 then 'maybe' else 'going' end)
    on conflict (spark_id, user_id) do nothing;
  end loop;

  insert into signup_claims (item_id, user_id)
  select i.id, p_user from signup_items i
    join rsvps v on v.spark_id = i.spark_id and v.user_id = p_user and v.status = 'going'
   where i.need is null or (select count(*) from signup_claims c where c.item_id = i.id) < i.need
   order by (i.time is null), md5(i.id::text || p_user::text)
   limit 2
  on conflict do nothing;

  insert into interests (spark_id, user_id)
  select s.id, p_user from sparks s
   where s.demo and not s.planned and s.group_id = any(v_groups) and s.lead_id <> p_user
   order by md5(s.id::text || p_user::text) limit 2
  on conflict do nothing;

  insert into date_options (spark_id, day_date, day_time, who, created_by)
  select s.id, current_date + 10 + abs(hashtext(p_user::text)) % 10, '18:00', v_name, p_user from sparks s
   where s.demo and not s.planned and s.day_date is null and s.group_id = any(v_groups) and s.lead_id <> p_user
   order by md5(s.id::text || p_user::text) limit 1
  on conflict do nothing;
end $$;
revoke execute on function public.demo_participate(uuid) from public, anon, authenticated;

-- Join the demo groups (as a member) and apply roster roles. Roles only ever go up, and an
-- account is made owner only while the group has fewer than two (the owner limit).
create or replace function public.apply_demo_world(p_user uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare r record; cur text; rank_of constant jsonb := '{"member":1,"admin":2,"owner":3}';
begin
  if p_email is null or p_email ilike '%@example.com' then return; end if;   -- test and demo accounts
  insert into memberships (group_id, user_id, role)
  select id, p_user, 'member' from groups where demo
  on conflict (group_id, user_id) do nothing;
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

create or replace function public.on_account_signed_in() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and coalesce(new.is_anonymous, false) = false then
    perform public.apply_demo_world(new.id, new.email);
  end if;
  return new;
end $$;

drop trigger if exists test_apply_pending_invites on auth.users;   -- the older, admin-only version
drop trigger if exists demo_world_on_sign_in on auth.users;
create trigger demo_world_on_sign_in
  after insert or update of email, is_anonymous on auth.users
  for each row execute function public.on_account_signed_in();

-- The owner's one-tap wipe: removes every demo idea and plan (their replies, votes, sign-ups,
-- updates and photos go with them), takes the demo people out of the groups, and stops adding
-- new sign-ups to the demo groups. Real posts and real people stay.
create or replace function public.wipe_demo()
returns table (ideas int, memberships int) language plpgsql security definer set search_path = public as $$
declare n_ideas int; n_members int;
begin
  if not exists (select 1 from demo_admins where user_id = auth.uid()) then
    raise exception 'only the owner can remove the demo content' using errcode = '42501';
  end if;
  delete from sparks where demo;
  get diagnostics n_ideas = row_count;
  delete from memberships m using auth.users u
   where u.id = m.user_id and u.email like 'seed-%@example.com';
  get diagnostics n_members = row_count;
  update groups set demo = false where demo;
  delete from demo_participants;
  return query select n_ideas, n_members;
end $$;
revoke execute on function public.wipe_demo() from public, anon;
grant  execute on function public.wipe_demo() to authenticated;
