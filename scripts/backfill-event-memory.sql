-- Event memory backfill (20261121030000_event_memory.sql): fills sparks.event_type and the journal and summaries for
-- events that already exist, from what today's tables still hold (created_at times, RSVPs, who came, cancellations).
-- Only existing data can be recovered: released claims, removed jobs and edits made before the migration are gone.
-- Safe to run twice (each row is added only if missing). TEST ONLY until the owner agrees to run it on live.
--   psql "$TEST_DB_URL" -f scripts/backfill-event-memory.sql        (or paste it into the Supabase SQL editor)
-- Backfilled journal rows carry data.backfilled = true and the time the thing really happened.

-- 1. Event types
update public.sparks set event_type = private.guess_event_type(text) where event_type is null;

-- 2. Journal rows from the tables (skipping test, demo and [E2E] events, as the triggers do)
with ok as (
  select id, group_id, created_at, cancelled_at, cancel_reason, planned, event_type, day_date, tags
    from public.sparks where not test and not demo and left(text, 5) <> '[E2E]'
), cutoff as (   -- rows the triggers wrote themselves are newer than this; don't duplicate them
  select coalesce((select min(at) from private.event_journal where not (data ? 'backfilled')), now()) as at
)
insert into private.event_journal (at, spark_id, group_id, kind, data)
select o.created_at, o.id, o.group_id, 'posted', jsonb_build_object('backfilled', true, 'planned', o.planned,
         'event_type', o.event_type, 'dated', o.day_date is not null, 'tags', to_jsonb(o.tags))
  from ok o where not exists (select 1 from private.event_journal j where j.spark_id = o.id and j.kind = 'posted')
union all
select o.cancelled_at, o.id, o.group_id, 'cancelled', jsonb_build_object('backfilled', true,
         'reason_given', nullif(btrim(o.cancel_reason), '') is not null, 'reason_len', char_length(coalesce(btrim(o.cancel_reason), '')))
  from ok o where o.cancelled_at is not null
   and not exists (select 1 from private.event_journal j where j.spark_id = o.id and j.kind = 'cancelled')
union all
select i.created_at, o.id, o.group_id, 'job_added', jsonb_build_object('backfilled', true, 'item', i.id, 'job', i.item,
         'spots', i.need, 'kind', i.kind, 'shift', i.shift_of is not null)
  from public.signup_items i join ok o on o.id = i.spark_id, cutoff
 where i.created_at < cutoff.at
   and not exists (select 1 from private.event_journal j where j.spark_id = o.id and j.kind = 'job_added' and j.data ->> 'item' = i.id::text)
union all
select c.created_at, o.id, o.group_id, 'job_claimed', jsonb_build_object('backfilled', true, 'item', i.id, 'job', i.item,
         'hours', round(extract(epoch from c.created_at - i.created_at) / 3600.0, 1))
  from public.signup_claims c join public.signup_items i on i.id = c.item_id join ok o on o.id = i.spark_id, cutoff
 where c.created_at < cutoff.at
   and not exists (select 1 from private.event_journal j where j.kind = 'job_claimed' and j.data ->> 'item' = i.id::text and j.at = c.created_at);

-- 3. Summaries for every event that has finished (a batch at a time, until none are left)
do $$ declare n integer; begin
  loop
    n := private.close_out_events(500);
    exit when n = 0;
  end loop;
end $$;

select (select count(*) from private.event_journal) as journal_rows, (select count(*) from private.event_summaries) as summaries,
       (select count(*) from public.sparks where event_type is null) as untyped_events;
