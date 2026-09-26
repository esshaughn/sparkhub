-- V5 phase 3: the Notifications feed. The feed itself is built in the app from what's already
-- stored (updates, replies, sign-ups, suggestions, new plans); this keeps each person's
-- read state and settings, so they follow you between your phone's app and the browser.

create table public.notif_state (
  user_id     uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  all_read_at timestamptz,                                          -- "Mark all read"
  read_keys   text[] not null default '{}' check (cardinality(read_keys) <= 400),
  topics      jsonb not null default '{}'::jsonb
              check (jsonb_typeof(topics) = 'object' and pg_column_size(topics) < 2000),
  email       boolean not null default true,                        -- used by phase 4 (email)
  updated_at  timestamptz not null default now()
);
alter table public.notif_state enable row level security;

create policy "your own notification state" on public.notif_state
  for select to authenticated using (user_id = auth.uid());
create policy "start your notification state" on public.notif_state
  for insert to authenticated with check (user_id = auth.uid());
create policy "change your notification state" on public.notif_state
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on table public.notif_state from anon;
grant select, insert on table public.notif_state to authenticated;
grant update (all_read_at, read_keys, topics, email, updated_at) on table public.notif_state to authenticated;
