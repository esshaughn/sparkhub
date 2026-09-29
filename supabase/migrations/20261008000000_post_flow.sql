-- v6 Update 6: the 5-step post flow and the host's edit pop-ups.
-- * A posted event (planned) may leave its date, time and place to be decided (or to a poll).
-- * Events get an optional end time.
-- * "Basic details": up to three lines of up to 40 characters (was 30).
-- * An event can post to several groups: its own group_id plus rows in spark_groups.
-- * Drafts: one row per unfinished event, only ever seen by the person who saved it.
-- * The lead edits a sign-up job in place (Edit what you need).

-- ---------------------------------------------------------------------------
-- Sparks
-- ---------------------------------------------------------------------------
alter table public.sparks drop constraint if exists sparks_plan_has_when;
alter table public.sparks add column day_end time;
grant update (day_end) on table public.sparks to authenticated;

alter table public.sparks drop constraint sparks_hopes_check;
alter table public.sparks add constraint sparks_hopes_check check (cardinality(hopes) <= 3 and public.all_short(hopes, 40));

-- ---------------------------------------------------------------------------
-- Posting to more than one group. group_id stays the event's home group (its admins
-- can delete it); each extra group is a row here. Members of any of them see it.
-- ---------------------------------------------------------------------------
create table public.spark_groups (
  spark_id uuid not null references public.sparks (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  primary key (spark_id, group_id)
);
create index spark_groups_group on public.spark_groups (group_id);
alter table public.spark_groups enable row level security;

create or replace function public.can_see_spark_row(p_id uuid, p_group uuid, p_lead uuid, p_visibility text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from link_access l where l.spark_id = p_id and l.user_id = auth.uid())
      or exists (select 1 from memberships m
                  where m.user_id = auth.uid()
                    and (m.group_id = p_group
                         or m.group_id in (select g.group_id from spark_groups g where g.spark_id = p_id))
                    and (p_visibility = 'group' or p_lead = auth.uid() or public.is_admin(m.group_id)
                         or exists (select 1 from rsvps r where r.spark_id = p_id and r.user_id = auth.uid())));
$$;

create policy "extra groups follow the event" on public.spark_groups
  for select to authenticated using (public.can_see_spark(spark_id));
-- The lead adds groups they belong to (not the home group again), and takes them off
create policy "the lead posts to their groups" on public.spark_groups
  for insert to authenticated
  with check (exists (select 1 from sparks s where s.id = spark_id and s.lead_id = auth.uid() and s.group_id <> spark_groups.group_id)
              and exists (select 1 from memberships m where m.group_id = spark_groups.group_id and m.user_id = auth.uid()));
create policy "the lead takes a group off" on public.spark_groups
  for delete to authenticated
  using (exists (select 1 from sparks s where s.id = spark_id and s.lead_id = auth.uid()));
revoke all on table public.spark_groups from anon;
grant select, insert, delete on table public.spark_groups to authenticated;

-- ---------------------------------------------------------------------------
-- Drafts of the post flow (the flow's own fields, as JSON). Private to their owner.
-- ---------------------------------------------------------------------------
create table public.event_drafts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  data       jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 16000),
  updated_at timestamptz not null default now()
);
create index event_drafts_user on public.event_drafts (user_id);
alter table public.event_drafts enable row level security;
create policy "your drafts only" on public.event_drafts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on table public.event_drafts from anon;
grant select, insert, update, delete on table public.event_drafts to authenticated;

-- A handful is plenty; stops a runaway client filling the table
create function public.check_draft_room() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from event_drafts where user_id = new.user_id) >= 20 then
    raise exception 'too many drafts' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger event_drafts_room before insert on public.event_drafts
  for each row execute function public.check_draft_room();

-- ---------------------------------------------------------------------------
-- Edit what you need: the lead changes a job's name, details, time and head count in place
-- ---------------------------------------------------------------------------
create policy "the lead edits sign-ups" on public.signup_items
  for update to authenticated
  using (exists (select 1 from sparks s where s.id = spark_id and s.lead_id = auth.uid()))
  with check (exists (select 1 from sparks s where s.id = spark_id and s.lead_id = auth.uid()));
grant update (item, need, time, end_time, descr) on table public.signup_items to authenticated;
