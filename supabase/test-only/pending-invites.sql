-- TEST PROJECT ONLY (torrezhub-test, hroxgvxvafgikikviiud). Never run this on live.
--
-- Lets the owner pre-arrange group memberships for a tester who hasn't signed in
-- yet: when an account gets a listed email (a new sign-up, or an anonymous visitor
-- signing in with Google or an email code), it joins the listed groups.
--
-- Apply (or re-apply) with:
--   supabase db query --linked --project-ref hroxgvxvafgikikviiud -f supabase/test-only/pending-invites.sql
-- Add a tester:
--   insert into public.test_pending_invites (email, group_name, role) values ('someone@gmail.com', 'Torrez Fitness', 'admin');

create table if not exists public.test_pending_invites (
  email      text not null,
  group_name text not null,
  role       text not null default 'member' check (role in ('admin', 'member')),
  primary key (email, group_name)
);
alter table public.test_pending_invites enable row level security;   -- no policies: not readable by the app
revoke all on table public.test_pending_invites from anon, authenticated;

create or replace function public.test_apply_pending_invites() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null then
    insert into memberships (group_id, user_id, role)
    select g.id, new.id, i.role
      from test_pending_invites i join groups g on g.name = i.group_name
     where lower(i.email) = lower(new.email)
    on conflict (group_id, user_id) do update set role = excluded.role;
  end if;
  return new;
end $$;

drop trigger if exists test_apply_pending_invites on auth.users;
create trigger test_apply_pending_invites
  after insert or update of email on auth.users
  for each row execute function public.test_apply_pending_invites();

insert into public.test_pending_invites (email, group_name, role) values
  ('torrezfitness@gmail.com', 'Torrez Fitness', 'admin'),
  ('torrezfitness@gmail.com', 'Woodcliff Neighborhood', 'admin'),
  ('torrezfitness@gmail.com', 'Hub on Hunters', 'member'),
  ('torrez.fitness@gmail.com', 'Torrez Fitness', 'admin'),
  ('torrez.fitness@gmail.com', 'Woodcliff Neighborhood', 'admin'),
  ('torrez.fitness@gmail.com', 'Hub on Hunters', 'member')
on conflict (email, group_name) do update set role = excluded.role;
