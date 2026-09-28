-- Hardening after the 2026-09-27 security review.
--
-- 1. The demo-world trigger only acts on CONFIRMED emails. Roles in demo_roster are keyed by
--    email, so an unconfirmed password sign-up with a tester's address must not inherit their
--    owner/admin role. It also now fires when the confirmation lands (email_confirmed_at).
-- 2. Guests can't move their contact onto another idea (the update check matches the insert
--    check), and can withdraw it (delete policy).
-- 3. Clients can't post a spark as demo content or with a made-up created_at: a trigger resets
--    both for anyone but the service role (seed scripts and SQL keep working).

-- 1. Demo world: confirmed emails only
create or replace function public.on_account_signed_in() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and new.email_confirmed_at is not null and coalesce(new.is_anonymous, false) = false then
    perform public.apply_demo_world(new.id, new.email);
  end if;
  return new;
end $$;

drop trigger if exists demo_world_on_sign_in on auth.users;
create trigger demo_world_on_sign_in
  after insert or update of email, email_confirmed_at, is_anonymous on auth.users
  for each row execute function public.on_account_signed_in();

-- 2. Guest contacts stay on the idea they were left for; a guest may withdraw theirs
drop policy if exists "change your own contact" on public.guest_contacts;
create policy "change your own contact" on public.guest_contacts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_see_spark(spark_id));
create policy "withdraw your own contact" on public.guest_contacts
  for delete to authenticated using (user_id = auth.uid());

-- 3. Posting can't set the hidden demo flag or backdate the post
create or replace function public.sparks_insert_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.demo := false;
    new.created_at := now();
  end if;
  return new;
end $$;
drop trigger if exists sparks_insert_guard on public.sparks;
create trigger sparks_insert_guard before insert on public.sparks
  for each row execute function public.sparks_insert_guard();
