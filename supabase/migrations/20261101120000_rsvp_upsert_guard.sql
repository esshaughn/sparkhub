-- The app saves a reply with an upsert, which sets spark_id and user_id as well as status on conflict, so
-- 20261101110000_rsvp_interest_column_grants.sql (update on status only) broke RSVPs. Give those columns
-- back and guard the row instead: a reply never moves to another event or person, and only mark_attended()
-- (a security definer function, so not running as `authenticated`) changes attended.

grant update (spark_id, user_id, status) on table public.rsvps to authenticated;

create or replace function private.rsvp_guard() returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if new.spark_id is distinct from old.spark_id or new.user_id is distinct from old.user_id then
      raise exception 'a reply can''t move to another event' using errcode = '42501';
    end if;
    if new.attended is distinct from old.attended then
      raise exception 'only the host checks people in' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists rsvp_guard on public.rsvps;
create trigger rsvp_guard before update on public.rsvps for each row execute function private.rsvp_guard();
