-- Feedback from the Profile sheet (owner, 2026-09-29): a signed-in person sends a note, only the owner can read it,
-- and the owner's phone gets a notification. Nothing in the app reads this table back to anyone.

create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text,                                                     -- filled from their profile by the trigger
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  screen     text check (char_length(screen) <= 60),                   -- which screen they were on
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
revoke all on table public.feedback from anon, authenticated;
grant insert (body, screen) on table public.feedback to authenticated;   -- user_id and name are never chosen by the client
grant select on table public.feedback to authenticated;                  -- filtered to the owner by the policy below

create policy "send your own feedback" on public.feedback for insert to authenticated
  with check (user_id = auth.uid() and public.is_signed_in());
create policy "only the owner reads feedback" on public.feedback for select to authenticated
  using (exists (select 1 from public.demo_admins d where d.user_id = auth.uid()));

-- Before saving: put the sender's name on it, and stop floods (10 an hour per person)
create or replace function public.feedback_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from feedback where user_id = new.user_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too much feedback in an hour' using errcode = 'P0001';
  end if;
  select left(coalesce(nullif(p.name, ''), nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(u.email, '@', 1)), 40)
    into new.name from auth.users u left join profiles p on p.id = u.id where u.id = new.user_id;
  new.body := btrim(new.body);
  return new;
end $$;
create trigger feedback_before_insert before insert on public.feedback
  for each row execute function public.feedback_before_insert();

-- After saving: a phone notification to the owner (never blocks the feedback if a push fails)
create or replace function public.feedback_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform private.push_send((select coalesce(array_agg(user_id), '{}') from demo_admins), 'feedback',
                              'Feedback from ' || coalesce(new.name, 'someone'), left(new.body, 140), '/', 'fb:' || new.id);
  exception when others then null;
  end;
  return new;
end $$;
create trigger feedback_after_insert after insert on public.feedback
  for each row execute function public.feedback_after_insert();
