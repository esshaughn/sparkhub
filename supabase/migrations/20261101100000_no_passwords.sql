-- Nobody signs in with a password (owner, 2026-10-01; DB-10). Spark Hub signs people in with an email code,
-- Google or anonymously, but Auth still accepts a password at sign-up. A password set by whoever signs up
-- first with someone else's address survived the real owner confirming it (checked on TEST), so that person
-- could then sign in as them. Every password is blanked on its way in, except the TEST e2e leads'
-- (scripts/test-leads.py; on live nobody has those addresses, and example.com mail goes nowhere).

create or replace function private.no_passwords() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.encrypted_password, '') <> ''
     and coalesce(new.email, '') !~ '^e2e-lead-[1-6]@example\.com$' then
    new.encrypted_password := '';
  end if;
  return new;
end $$;

revoke all on function private.no_passwords() from public, anon, authenticated;

drop trigger if exists no_passwords on auth.users;
create trigger no_passwords
  before insert or update on auth.users
  for each row execute function private.no_passwords();

-- Clear the ones already set (the demo seed's unused random ones, and any pre-registered sign-up)
update auth.users set encrypted_password = ''
 where coalesce(encrypted_password, '') <> ''
   and coalesce(email, '') !~ '^e2e-lead-[1-6]@example\.com$';
