-- Anything to change for next time? (Design v8-21, item 2a + 2b). A lead or co-lead keeps a private note on a past
-- event (picked chips and/or a line of their own), shown again when they plan the next one. One row per event per
-- lead; only its writer ever sees it. "Not now" is kept as skipped = true so the card stays hidden for that event.

create table public.next_time_notes (
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  picks      text[] not null default '{}' check (cardinality(picks) <= 8),
  note       text check (char_length(note) <= 140),
  skipped    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (spark_id, user_id)
);
alter table public.next_time_notes enable row level security;

-- Only your own notes, and only on events you lead or co-lead
create policy "read your own next-time notes" on public.next_time_notes for select to authenticated
  using (user_id = auth.uid());
create policy "write a note on an event you lead" on public.next_time_notes for insert to authenticated
  with check (user_id = auth.uid() and public.is_host(spark_id));
create policy "change your own note" on public.next_time_notes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_host(spark_id));
create policy "delete your own note" on public.next_time_notes for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.next_time_notes from anon, authenticated;
grant select, insert, update, delete on table public.next_time_notes to authenticated;
