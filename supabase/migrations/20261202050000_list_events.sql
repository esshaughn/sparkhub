-- Events remember their list (owner, 2026-10-14): "Invite Dinner Crew" saves the list on the event, so a list can show
-- what's coming up with those people. It is the base for whatever a friend group becomes (an owned list now; maybe a
-- shared crew later), so it only records the link and adds no access: who sees the event is unchanged.
--   sparks.list_id: one of the lead's own lists. A friends list (group_id null) fits any event; a list inside a
--   community fits only an event whose home group is that community. Deleting the list leaves its events alone.
-- The column is readable like the rest of the event (an opaque id; nobody but the owner can read the list itself).

alter table public.sparks add column if not exists list_id uuid references public.lists (id) on delete set null;
create index if not exists sparks_list on public.sparks (list_id) where list_id is not null;
grant update (list_id) on public.sparks to authenticated;

create or replace function private.sparks_list_ok()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.list_id is null or (tg_op = 'UPDATE' and new.list_id is not distinct from old.list_id) then return new; end if;
  if auth.uid() is null then return new; end if;   -- the service role (scripts)
  if not exists (select 1 from lists l where l.id = new.list_id and l.owner_id = auth.uid()
                   and (l.group_id is null or l.group_id = new.group_id)) then
    raise exception 'list: not one of your lists for this event' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.sparks_list_ok() from public;

drop trigger if exists sparks_list_ok on public.sparks;
create trigger sparks_list_ok before insert or update of list_id on public.sparks
  for each row execute function private.sparks_list_ok();
