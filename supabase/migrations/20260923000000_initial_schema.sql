-- Sparks — Torrez Fitness · initial schema (baseline migration)
--
-- Applied to production 2026-09-23. Later changes go in new files in this folder;
-- see CLAUDE.md → "Database changes".
--
-- Identity model: every visitor gets a Supabase *anonymous* session (no sign-up
-- screen). That session's user id is what makes someone the poster / lead of a
-- spark, and what keeps RSVP phone numbers visible only to the lead.
-- Requires anonymous sign-ins (supabase/config.toml → [auth] enable_anonymous_sign_ins).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.sparks (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  author_name    text not null check (char_length(author_name) between 1 and 40),
  text           text not null check (char_length(text) between 1 and 80),
  vibe           text check (char_length(vibe) <= 40),
  bits           text[] not null default '{}' check (cardinality(bits) <= 2),
  cat            text not null default 'events' check (cat in ('events', 'projects', 'aid', 'fresh')),
  answers        jsonb not null default '{}',
  lead_id        uuid references auth.users (id) on delete set null,
  lead_name      text check (char_length(lead_name) <= 40),
  basics         boolean not null default false,
  spot           text check (char_length(spot) <= 80),
  spot_open      boolean not null default false,
  day            text check (char_length(day) <= 80),
  locked_date_id uuid,
  vision         text check (char_length(vision) <= 1000),
  min_people     int check (min_people between 0 and 99)
);

-- Up to three date options a lead puts up for a vote
create table public.date_options (
  id         uuid primary key default gen_random_uuid(),
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 60),
  created_at timestamptz not null default now()
);

alter table public.sparks
  add constraint sparks_locked_date_fk
  foreign key (locked_date_id) references public.date_options (id) on delete set null;

-- One RSVP per person per spark. Name + phone are private to the lead.
create table public.rsvps (
  id         uuid primary key default gen_random_uuid(),
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  phone      text not null check (char_length(phone) between 7 and 20),
  date_ids   uuid[] not null default '{}',
  none_work  boolean not null default false,
  created_at timestamptz not null default now(),
  unique (spark_id, user_id)
);

-- "Who's already in": offered spots, floated days, offers to help
create table public.offers (
  id         uuid primary key default gen_random_uuid(),
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  who        text not null check (char_length(who) between 1 and 40),
  kind       text not null check (kind in ('spot', 'day', 'help')),
  body       text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);

create index on public.date_options (spark_id);
create index on public.rsvps (spark_id);
create index on public.offers (spark_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.sparks       enable row level security;
alter table public.date_options enable row level security;
alter table public.rsvps        enable row level security;
alter table public.offers       enable row level security;

-- sparks: everyone with a session reads; you post as yourself; only the lead edits
create policy "sparks are readable" on public.sparks
  for select to authenticated using (true);

create policy "post a spark as yourself" on public.sparks
  for insert to authenticated
  with check (created_by = auth.uid() and (lead_id is null or lead_id = auth.uid()));

create policy "the lead edits their spark" on public.sparks
  for update to authenticated
  using (lead_id = auth.uid()) with check (lead_id = auth.uid());

-- date_options: readable; only the lead adds, max three per spark
create policy "date options are readable" on public.date_options
  for select to authenticated using (true);

create policy "the lead adds date options" on public.date_options
  for insert to authenticated
  with check (
    exists (select 1 from public.sparks s where s.id = date_options.spark_id and s.lead_id = auth.uid())
    and (select count(*) from public.date_options d where d.spark_id = date_options.spark_id) < 3
  );

-- rsvps: you see your own; the lead sees all on their spark (names + phones)
create policy "own rsvp or lead can read" on public.rsvps
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.sparks s where s.id = rsvps.spark_id and s.lead_id = auth.uid())
  );

create policy "rsvp as yourself" on public.rsvps
  for insert to authenticated with check (user_id = auth.uid());

create policy "change your own rsvp" on public.rsvps
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- offers: readable; inserted through add_offer() below
create policy "offers are readable" on public.offers
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Functions for actions that touch a spark you don't lead
-- ---------------------------------------------------------------------------

-- "I'll take the lead on this" — only works while nobody leads it
create function public.claim_lead(p_spark uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update sparks
     set lead_id = auth.uid(), lead_name = left(trim(p_name), 40)
   where id = p_spark and lead_id is null;
  if not found then raise exception 'this spark already has a lead'; end if;
end $$;

-- Offer a spot / float a day / offer help. Spot and day also fill the spark's field.
create function public.add_offer(p_spark uuid, p_kind text, p_body text, p_who text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into offers (spark_id, user_id, who, kind, body)
  values (p_spark, auth.uid(), left(trim(p_who), 40), p_kind, left(trim(p_body), 300));
  if p_kind = 'spot' then update sparks set spot = left(trim(p_body), 80) where id = p_spark; end if;
  if p_kind = 'day'  then update sparks set day  = left(trim(p_body), 80) where id = p_spark; end if;
end $$;

-- RSVP counts everyone may see, without exposing names or numbers (one row per spark)
create function public.rsvp_counts()
returns table (spark_id uuid, going int, none_count int, dates jsonb)
language sql stable security definer set search_path = public as $$
  select r.spark_id,
         (count(*) filter (where not r.none_work))::int,
         (count(*) filter (where r.none_work))::int,
         coalesce((
           select jsonb_object_agg(x.d, x.c)
             from (select unnest(r2.date_ids) as d, count(*) as c
                     from rsvps r2 where r2.spark_id = r.spark_id group by 1) x
         ), '{}'::jsonb)
    from rsvps r
   group by r.spark_id;
$$;

revoke execute on function public.claim_lead(uuid, text)             from public, anon;
revoke execute on function public.add_offer(uuid, text, text, text)  from public, anon;
revoke execute on function public.rsvp_counts()                     from public, anon;
grant  execute on function public.claim_lead(uuid, text)             to authenticated;
grant  execute on function public.add_offer(uuid, text, text, text)  to authenticated;
grant  execute on function public.rsvp_counts()                      to authenticated;
