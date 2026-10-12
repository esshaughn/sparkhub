-- Lists (owner, 2026-10-12): the friend lists that lived on one phone (localStorage) move into the account, and a
-- list can also live inside a community, for small private gatherings among its members. A list is private to its
-- owner: nobody else can read it or see that they're on it.
--   group_id null: a friends list; everyone on it must be the owner's friend
--   group_id set:  a list inside that community; the owner and everyone on it must be members
-- People who don't qualify (not a friend, not a member, the owner, repeats) are dropped quietly on save, so re-saving
-- a list after someone left or was unfriended just works. The planned caps (about 5 lists, 20 people) are not enforced
-- during the beta (owner, 2026-10-11: measure first); the limits here only stop abuse.

create table public.lists (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  group_id   uuid references public.groups (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 32),
  people     uuid[] not null default '{}' check (cardinality(people) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lists_owner on public.lists (owner_id);

alter table public.lists enable row level security;
revoke all on public.lists from anon, authenticated;
grant select, delete on public.lists to authenticated;
grant insert (name, group_id, people) on public.lists to authenticated;
grant update (name, people) on public.lists to authenticated;

create policy "your own lists" on public.lists for select to authenticated using (owner_id = auth.uid());
create policy "make a list" on public.lists for insert to authenticated
  with check (owner_id = auth.uid() and public.is_signed_in() and (group_id is null or public.is_member(group_id)));
create policy "change your list" on public.lists for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete your list" on public.lists for delete to authenticated using (owner_id = auth.uid());

create or replace function private.lists_clean()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (select count(*) from lists where owner_id = new.owner_id) >= 50 then
    raise exception 'up to 50 lists' using errcode = '23514';
  end if;
  new.name := btrim(new.name);
  new.people := coalesce(array(
    select p from (select distinct p from unnest(new.people) p) x
     where p is not null and p <> new.owner_id
       and case when new.group_id is null
                then exists (select 1 from friendships f
                              where f.user_a = least(new.owner_id, p) and f.user_b = greatest(new.owner_id, p))
                else exists (select 1 from memberships m where m.group_id = new.group_id and m.user_id = p)
           end), '{}');
  new.updated_at := now();
  return new;
end $$;
create trigger lists_clean before insert or update on public.lists
  for each row execute function private.lists_clean();
