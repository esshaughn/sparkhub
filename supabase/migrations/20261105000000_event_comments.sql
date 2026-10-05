-- Discussion on a plan (Design v8-1, 2026-10-05): comments, and one level of replies under a comment or under a
-- lead's update (plan_updates). Anyone who can see the event reads them; the hosts and people who said Going or
-- Maybe write them. You can delete your own; a host can delete any on their event. No push yet: the notification a
-- lead gets for a comment isn't designed. The app reads them when a plan's page opens (not in load_all).

create table public.event_comments (
  id         uuid primary key default gen_random_uuid(),
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  parent_id  uuid references public.event_comments (id) on delete cascade,   -- a reply to a comment
  update_id  uuid references public.plan_updates (id) on delete cascade,     -- a reply to a lead's update
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  created_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  check (parent_id is null or update_id is null)
);
create index event_comments_spark on public.event_comments (spark_id, created_at);
create index event_comments_parent on public.event_comments (parent_id) where parent_id is not null;
create index event_comments_update on public.event_comments (update_id) where update_id is not null;
create index event_comments_by on public.event_comments (created_by, created_at);

-- Who can write: the hosts, and people coming (Going or Maybe)
create or replace function public.can_comment(p_spark uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_see_spark(p_spark)
     and (public.is_host(p_spark)
          or exists (select 1 from rsvps r where r.spark_id = p_spark and r.user_id = auth.uid() and r.status in ('going', 'maybe')));
$$;
revoke all on function public.can_comment(uuid) from public, anon;
grant execute on function public.can_comment(uuid) to authenticated;

alter table public.event_comments enable row level security;
create policy "comments follow the event" on public.event_comments
  for select to authenticated using (public.can_see_spark(spark_id));
create policy "people coming comment" on public.event_comments
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_comment(spark_id)
    -- one level of replies, on the same event
    and (parent_id is null or exists (select 1 from event_comments p
                                       where p.id = event_comments.parent_id and p.spark_id = event_comments.spark_id
                                         and p.parent_id is null and p.update_id is null))
    and (update_id is null or exists (select 1 from plan_updates u
                                       where u.id = event_comments.update_id and u.spark_id = event_comments.spark_id)));
create policy "authors and hosts remove comments" on public.event_comments
  for delete to authenticated using (created_by = auth.uid() or public.is_host(spark_id));
-- Supabase's default privileges give authenticated every column: revoke all, then grant what's used (no updates)
revoke all on table public.event_comments from anon, authenticated;
grant select, insert, delete on table public.event_comments to authenticated;

-- At most 30 comments an hour per person, across events (the shared limiter: SQLSTATE PT429, *You're going a bit
-- fast*; the e2e leads on TEST are exempt)
create or replace function private.comment_rate() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or exists (select 1 from private.rate_exempt where user_id = me) then return new; end if;
  if not private.rate_ok(me, 'comment', 30, interval '1 hour') then
    raise exception 'too many comments' using errcode = 'PT429';
  end if;
  return new;
end $$;
create trigger event_comments_rate before insert on public.event_comments
  for each row execute function private.comment_rate();
