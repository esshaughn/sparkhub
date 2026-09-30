-- A phone notification to the owner (demo_admins) whenever someone creates an account (owner, 2026-09-30).
-- "An account" = a confirmed email that isn't anonymous: an email-code sign-up, Google, or a guest who signs up.
-- Fires once per person, the moment they first qualify. Test and demo people (@example.com) never notify.

create or replace function private.notify_new_account() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text; v_total integer;
begin
  if new.email is null or new.email_confirmed_at is null or coalesce(new.is_anonymous, false) then return new; end if;
  if tg_op = 'UPDATE' and old.email is not null and old.email_confirmed_at is not null and not coalesce(old.is_anonymous, false) then
    return new;   -- already had an account (a later email change or sign-in)
  end if;
  if new.email ilike '%@example.com' then return new; end if;
  begin
    v_name := left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)), 40);
    select count(*) into v_total from auth.users
     where email is not null and email_confirmed_at is not null and not coalesce(is_anonymous, false) and email not ilike '%@example.com';
    perform private.push_send((select coalesce(array_agg(user_id), '{}') from demo_admins where user_id <> new.id), 'accounts',
                              'New account: ' || v_name, new.email || ' · ' || v_total || ' accounts now', '/', 'acct:' || new.id);
  exception when others then null;   -- a notification must never block a sign-up
  end;
  return new;
end $$;

revoke all on function private.notify_new_account() from public, anon, authenticated;

drop trigger if exists notify_new_account on auth.users;
create trigger notify_new_account
  after insert or update of email, email_confirmed_at, is_anonymous on auth.users
  for each row execute function private.notify_new_account();
