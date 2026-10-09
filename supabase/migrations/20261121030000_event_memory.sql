-- Community memory, step 1 (owner, 2026-10-09): RECORD what happens around each event so it survives the event, claim or
-- job being deleted, for suggestions much later. Database only: no screens, nothing in load_all(), no client can read it.
--   private.event_journal    append-only: one row per thing that happened (posted, date_changed, job_claimed, ...)
--   private.event_summaries  one row per finished event: type, day, lead time, jobs and how fast they filled, counts
-- Neither table has a foreign key (so a deleted event, group or person leaves them untouched) and neither holds a user
-- id, name or phone. `data` carries job names (text a lead typed), counts and dates only; place text, titles and
-- cancel reasons are NOT copied (a cancel stores only whether a reason was given and its length).
-- Writing is by security-definer triggers that swallow every error, so they can never block a person's own write.
-- Test, demo and "[E2E]" events write nothing.
-- DELETE RULE (owner, 2026-10-09): private.forget_event() is the one place it lives, called from delete_event():
--   a normal delete keeps the summary but clears its title_key; a quiet delete (a mistake or a test) discards both
--   the summary and the journal rows. To flip the rule, change that one function.

-- 1. The tables ------------------------------------------------------------------------------------------------
create table private.event_journal (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  spark_id uuid not null,
  group_id uuid,
  kind     text not null,
  data     jsonb not null default '{}'
);
create index event_journal_spark on private.event_journal (spark_id, at);

create table private.event_summaries (
  spark_id     uuid primary key,
  group_id     uuid,
  event_type   text,
  title_key    text,
  dow          int,
  start_time   time,
  duration_min int,
  lead_days    int,
  jobs         jsonb not null default '[]',
  going        int not null default 0,
  came         int not null default 0,
  cancelled    boolean not null default false,
  edits        int not null default 0,
  closed_at    timestamptz not null default now()
);
create index event_summaries_group_type on private.event_summaries (group_id, event_type);

alter table private.event_journal   enable row level security;
alter table private.event_summaries enable row level security;
revoke all on table private.event_journal, private.event_summaries from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;

-- 2. Event type without AI -------------------------------------------------------------------------------------
alter table public.sparks add column if not exists event_type text;
alter table public.sparks add constraint sparks_event_type_check check (event_type is null or event_type in
  ('pickleball', 'potluck', 'walk', 'game_night', 'party', 'workout', 'class', 'volunteer', 'meeting', 'other'));
grant update (event_type) on table public.sparks to authenticated;

-- Keyword matching on the lowercased title; the first list that matches wins, else 'other'
create or replace function private.guess_event_type(p_title text) returns text language sql immutable as $$
  select case
    when t ~ '\m(pickle ?ball)'                                                                 then 'pickleball'
    when t ~ '\m(meeting|committee|town hall|agenda|book club|hoa\M)'                              then 'meeting'
    when t ~ '\m(volunteer|clean ?-?up|service project|food drive|donation|work ?day|litter)'    then 'volunteer'
    when t ~ '\m(game night|games?\M|trivia|bingo|poker|euchre|bunco|mahjong|cards\M|board game)' then 'game_night'
    when t ~ '\m(workout|yoga|fitness|boot ?camp|hiit|pilates|zumba|spin\M|lift|stretch)'        then 'workout'
    when t ~ '\m(class\M|workshop|lesson|seminar|course\M|training|learn|craft)'                 then 'class'
    when t ~ '\m(walk|hike|stroll|trail|5k|run club)'                                            then 'walk'
    when t ~ '\m(potluck|pot luck|cook ?-?off|chili|bbq|cookout|picnic|brunch|supper|dinner|lunch|bake)' then 'potluck'
    when t ~ '\m(party|celebrat|birthday|bash\M|social\M|happy hour|mixer|gala|festival|halloween|holiday|block party)' then 'party'
    else 'other' end
  from (select lower(coalesce(p_title, '')) as t) x
$$;

-- "Pickleball Night 2" and "pickleball night" group together: lowercase, no digits, month or weekday words, or punctuation
create or replace function private.title_key(p_title text) returns text language sql immutable as $$
  select nullif(btrim(regexp_replace(regexp_replace(regexp_replace(lower(coalesce(p_title, '')),
    '\m(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\M|\m(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\M', ' ', 'g'),
    '[^[:alpha:] ]+', ' ', 'g'), '\s+', ' ', 'g')), '')
$$;

create or replace function private.sparks_fill_event_type() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.event_type is null then new.event_type := private.guess_event_type(new.text); end if;
  return new;
end $$;
create trigger sparks_fill_event_type before insert on public.sparks
  for each row execute function private.sparks_fill_event_type();

-- 3. The journal ----------------------------------------------------------------------------------------------
-- Every write goes through here: it skips test, demo and [E2E] events (and an event that is already gone, which is how a
-- cascading delete avoids logging every claim as released) and never raises.
create or replace function private.journal(p_spark uuid, p_kind text, p_data jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into private.event_journal (spark_id, group_id, kind, data)
  select s.id, s.group_id, p_kind, coalesce(p_data, '{}'::jsonb)
    from public.sparks s
   where s.id = p_spark and not s.test and not s.demo and left(s.text, 5) <> '[E2E]';
exception when others then null;
end $$;

create or replace function private.journal_spark() returns trigger language plpgsql security definer set search_path = public as $$
declare v_today date := (now() at time zone 'America/Chicago')::date;
begin
  if tg_op = 'INSERT' then
    perform private.journal(new.id, 'posted', jsonb_build_object('planned', new.planned, 'event_type', new.event_type,
      'dated', new.day_date is not null, 'tags', to_jsonb(new.tags),
      'lead_days', case when new.day_date is not null then new.day_date - v_today end));
    return null;
  end if;
  if new.day_date is distinct from old.day_date or new.day_time is distinct from old.day_time then
    perform private.journal(new.id, 'date_changed', jsonb_build_object('from', old.day_date, 'to', new.day_date,
      'time_from', old.day_time, 'time_to', new.day_time,
      'days_before', case when old.day_date is not null then old.day_date - v_today end));
  end if;
  if new.spot is distinct from old.spot then
    perform private.journal(new.id, 'spot_changed', jsonb_build_object('had', old.spot is not null, 'has', new.spot is not null,
      'days_before', case when new.day_date is not null then new.day_date - v_today end));
  end if;
  if new.planned and not old.planned then
    perform private.journal(new.id, 'plan_made', jsonb_build_object('days_before', case when new.day_date is not null then new.day_date - v_today end));
  end if;
  if new.cancelled_at is not null and old.cancelled_at is null then
    perform private.journal(new.id, 'cancelled', jsonb_build_object('reason_given', nullif(btrim(new.cancel_reason), '') is not null,
      'reason_len', char_length(coalesce(btrim(new.cancel_reason), '')),
      'days_before', case when new.day_date is not null then new.day_date - v_today end));
  end if;
  return null;
exception when others then return null;
end $$;
create trigger journal_sparks_insert after insert on public.sparks
  for each row execute function private.journal_spark();
create trigger journal_sparks_update after update of day_date, day_time, spot, planned, cancelled_at on public.sparks
  for each row execute function private.journal_spark();

create or replace function private.journal_item() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform private.journal(new.spark_id, 'job_added', jsonb_build_object('item', new.id, 'job', new.item, 'spots', new.need,
      'kind', new.kind, 'shift', new.shift_of is not null));
    return null;
  elsif tg_op = 'UPDATE' then
    if new.need is distinct from old.need then
      perform private.journal(new.spark_id, 'job_spots_changed', jsonb_build_object('item', new.id, 'job', new.item,
        'from', old.need, 'to', new.need));
    end if;
    return null;
  end if;
  -- before delete: the claims are still here to count, and a cascade from the event or the job finds the parent gone
  if old.shift_of is null or exists (select 1 from public.signup_items p where p.id = old.shift_of) then
    perform private.journal(old.spark_id, 'job_removed', jsonb_build_object('item', old.id, 'job', old.item, 'spots', old.need,
      'claimed', (select count(*) from public.signup_claims c where c.item_id = old.id)));
  end if;
  return old;
exception when others then
  if tg_op = 'DELETE' then return old; end if;
  return null;
end $$;
create trigger journal_items_insert after insert on public.signup_items
  for each row execute function private.journal_item();
create trigger journal_items_update after update of need on public.signup_items
  for each row execute function private.journal_item();
create trigger journal_items_delete before delete on public.signup_items
  for each row execute function private.journal_item();

create or replace function private.journal_claim() returns trigger language plpgsql security definer set search_path = public as $$
declare it record;
begin
  select i.id, i.spark_id, i.item, i.created_at into it from public.signup_items i where i.id = coalesce(new.item_id, old.item_id);
  if it.id is null then return null; end if;   -- the job (or its event) is being deleted: not a release
  if tg_op = 'INSERT' then
    perform private.journal(it.spark_id, 'job_claimed', jsonb_build_object('item', it.id, 'job', it.item,
      'hours', round(extract(epoch from now() - it.created_at) / 3600.0, 1)));
  else
    perform private.journal(it.spark_id, 'job_released', jsonb_build_object('item', it.id, 'job', it.item,
      'hours_held', round(extract(epoch from now() - old.created_at) / 3600.0, 1)));
  end if;
  return null;
exception when others then return null;
end $$;
create trigger journal_claims_insert after insert on public.signup_claims
  for each row execute function private.journal_claim();
create trigger journal_claims_delete after delete on public.signup_claims
  for each row execute function private.journal_claim();

-- 4. Summaries ------------------------------------------------------------------------------------------------
-- One row for an event; true if it wrote one. p_deleting: the event is being deleted before its day is over, so it
-- counts as cancelled. Idempotent.
create or replace function private.write_summary(p_spark uuid, p_deleting boolean default false)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer; v_today date := (now() at time zone 'America/Chicago')::date;
begin
  insert into private.event_summaries (spark_id, group_id, event_type, title_key, dow, start_time, duration_min, lead_days,
                                       jobs, going, came, cancelled, edits)
  select s.id, s.group_id, coalesce(s.event_type, private.guess_event_type(s.text)), private.title_key(s.text),
         extract(dow from s.day_date)::int, s.day_time,
         case when s.day_time is not null and s.day_end is not null
              then ((extract(epoch from (s.day_end - s.day_time))::int / 60) + 1440) % 1440 end,
         case when s.day_date is not null then s.day_date - (s.created_at at time zone 'America/Chicago')::date end,
         coalesce((select jsonb_agg(jsonb_build_object('name', i.item, 'spots', i.need, 'claimed', c.n, 'hours_to_fill', f.h)
                                    order by i.created_at, i.id)
                     from signup_items i
                     left join lateral (select count(*) as n from signup_claims where item_id = i.id) c on true
                     left join lateral (select round(extract(epoch from (select cl.created_at from signup_claims cl
                                                      where cl.item_id = i.id order by cl.created_at offset i.need - 1 limit 1)
                                                    - i.created_at) / 3600.0, 1) as h where i.need is not null) f on true
                    where i.spark_id = s.id
                      and not exists (select 1 from signup_items sh where sh.shift_of = i.id)), '[]'::jsonb),
         (select count(*) from rsvps r where r.spark_id = s.id and r.status = 'going'),
         (select count(*) from rsvps r where r.spark_id = s.id and r.attended is true),
         s.cancelled_at is not null or (p_deleting and coalesce(private.event_last_day(s.day_date, s.schedule), v_today) >= v_today),
         (select count(*) from private.event_journal j where j.spark_id = s.id
             and j.kind in ('date_changed', 'spot_changed', 'job_spots_changed', 'job_removed'))
    from sparks s
   where s.id = p_spark and not s.test and not s.demo and left(s.text, 5) <> '[E2E]'
  on conflict (spark_id) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Nightly: every planned event whose last day was at least a day ago (Chicago) and has no summary yet
create or replace function private.close_out_events(p_limit integer default 200)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in
    select s.id from sparks s
     where s.planned and s.day_date is not null and not s.test and not s.demo and left(s.text, 5) <> '[E2E]'
       and private.event_last_day(s.day_date, s.schedule) < (now() at time zone 'America/Chicago')::date
       and not exists (select 1 from private.event_summaries m where m.spark_id = s.id)
     order by s.day_date
     limit p_limit
  loop
    begin
      if private.write_summary(r.id) then n := n + 1; end if;
    exception when others then raise warning 'close_out_events %: %', r.id, sqlerrm;
    end;
  end loop;
  return n;
end $$;

-- 5. The delete rule: the one place to change it --------------------------------------------------------------
create or replace function private.forget_event(p_spark uuid, p_quiet boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_quiet then   -- a mistake or a test: nothing is kept
    delete from private.event_journal   where spark_id = p_spark;
    delete from private.event_summaries where spark_id = p_spark;
    return;
  end if;
  -- a normal delete: keep what it was like, lose what it was called. (An idea that never became a plan has no summary.)
  perform private.journal(p_spark, 'deleted', '{}');
  if exists (select 1 from sparks where id = p_spark and planned)
     or exists (select 1 from private.event_journal where spark_id = p_spark and kind = 'plan_made') then
    perform private.write_summary(p_spark, true);
  end if;
  update private.event_summaries set title_key = null where spark_id = p_spark;
exception when others then null;
end $$;

create or replace function public.delete_event(p_spark uuid, p_quiet boolean default false, p_reason text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare s record; v_who text; v_body text; n integer := 0;
begin
  select id, text, lead_id, group_id, planned into s from sparks where id = p_spark;
  if s.id is null then raise exception 'not found'; end if;
  if s.lead_id is distinct from auth.uid() and not public.is_admin(s.group_id) then
    raise exception 'not allowed';
  end if;
  if not coalesce(p_quiet, false) then
    select coalesce(nullif(split_part(trim(p.name), ' ', 1), ''), 'The lead') into v_who from profiles p where p.id = auth.uid();
    v_body := left(s.text, 120) || ' is cancelled. ' ||
      case when nullif(btrim(p_reason), '') is null then coalesce(v_who, 'The lead') || ' called it off.'
           else coalesce(v_who, 'The lead') || ': “' || left(btrim(p_reason), 160) || '”' end;
    insert into notes (user_id, body, created_by)
      select u, left(v_body, 320), auth.uid()
        from (select r.user_id as u from rsvps r where r.spark_id = p_spark and r.status in ('going', 'maybe')
              union select c.user_id from signup_claims c join signup_items i on i.id = c.item_id where i.spark_id = p_spark
              union select x.user_id from interests x where x.spark_id = p_spark and not s.planned
              union select unnest(private.host_ids(p_spark))) people
       where u <> auth.uid();
    get diagnostics n = row_count;
  end if;
  perform private.forget_event(p_spark, coalesce(p_quiet, false));   -- community memory (20261121030000)
  delete from sparks where id = p_spark;
  return n;
end $$;

-- Nobody calls these but the database
revoke all on function private.guess_event_type(text), private.title_key(text), private.sparks_fill_event_type(),
  private.journal(uuid, text, jsonb), private.journal_spark(), private.journal_item(), private.journal_claim(),
  private.write_summary(uuid, boolean), private.close_out_events(integer), private.forget_event(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.delete_event(uuid, boolean, text) from public, anon;
grant execute on function public.delete_event(uuid, boolean, text) to authenticated;

-- 6. Nightly at 8:30 UTC (2:30–3:30am Chicago), like push-daily
do $$ begin
  perform cron.unschedule('event-close-out') where exists (select 1 from cron.job where jobname = 'event-close-out');
  perform cron.schedule('event-close-out', '30 8 * * *', 'select private.close_out_events()');
exception when others then raise warning 'event-close-out schedule: %', sqlerrm;   -- no pg_cron (the local checks)
end $$;
