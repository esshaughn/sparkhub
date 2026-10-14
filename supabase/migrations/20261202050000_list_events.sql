-- Events remember their list (owner, 2026-10-14): "Invite Dinner Crew" saves the list on the event, so a list can show
-- what's coming up with those people. It is the base for whatever a friend group becomes (an owned list now; maybe a
-- shared crew later), so it only records the link and adds no access: who sees the event is unchanged.
--   sparks.list_id: one of the lead's own lists. A friends list (group_id null) fits any event; a list inside a
--   community fits only an event whose home group is that community. Deleting the list leaves its events alone.
-- The column is readable like the rest of the event (an opaque id; nobody but the owner can read the list itself).

alter table public.sparks add column if not exists list_id uuid references public.lists (id) on delete set null;
create index if not exists sparks_list on public.sparks (list_id) where list_id is not null;
grant update (list_id) on public.sparks to authenticated;

create or replace function private.sparks_list_ok()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.list_id is null or (tg_op = 'UPDATE' and new.list_id is not distinct from old.list_id) then return new; end if;
  if auth.uid() is null then return new; end if;   -- the service role (scripts)
  if not exists (select 1 from lists l where l.id = new.list_id and l.owner_id = auth.uid()
                   and (l.group_id is null or l.group_id = new.group_id)) then
    raise exception 'list: not one of your lists for this event' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.sparks_list_ok() from public;

drop trigger if exists sparks_list_ok on public.sparks;
create trigger sparks_list_ok before insert or update of list_id on public.sparks
  for each row execute function private.sparks_list_ok();

-- Friends usage, counted, not limited (owner, 2026-10-14: let real numbers set the free-tier cap). For WAN's numbers
-- page, app owner only, per month: how many people hosted a private event (personal or community-private), how many
-- each hosted (avg, 90th percentile, max), how many hosts would have passed 4 or 8 a month, how many people each
-- private event invited and had going (avg, max), and how many came from a list. Counts only, never who.
create or replace function public.friend_usage(p_months integer default 6)
returns table (month date, hosts integer, per_host_avg numeric, per_host_p90 numeric, per_host_max integer,
               hosts_over_4 integer, hosts_over_8 integer, invited_avg numeric, invited_max integer,
               going_avg numeric, going_max integer, from_lists integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_app_owner() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  with months as (
    select generate_series(date_trunc('month', now()) - make_interval(months => greatest(1, least(p_months, 24)) - 1),
                           date_trunc('month', now()), interval '1 month')::date as m
  ), ev as (
    select date_trunc('month', s.created_at)::date as m, s.lead_id, s.list_id,
           (select count(*)::int from event_invites i where i.spark_id = s.id) as invited,
           (select coalesce(sum(1 + coalesce(r.plus_count, 0)), 0)::int from rsvps r where r.spark_id = s.id and r.status = 'going') as going
      from sparks s
     where s.visibility = 'invite' and not s.test and not s.demo and left(s.text, 5) <> '[E2E]'
  ), per as (
    select ev.m, ev.lead_id, count(*)::int as n from ev group by 1, 2
  )
  select months.m,
         (select count(*)::int from per where per.m = months.m),
         (select round(avg(n), 1) from per where per.m = months.m),
         (select round(percentile_cont(0.9) within group (order by n)::numeric, 1) from per where per.m = months.m),
         (select max(n) from per where per.m = months.m),
         (select count(*)::int from per where per.m = months.m and n > 4),
         (select count(*)::int from per where per.m = months.m and n > 8),
         (select round(avg(invited), 1) from ev where ev.m = months.m),
         (select max(invited) from ev where ev.m = months.m),
         (select round(avg(going), 1) from ev where ev.m = months.m),
         (select max(going) from ev where ev.m = months.m),
         (select count(*)::int from ev where ev.m = months.m and ev.list_id is not null)
    from months order by months.m;
end $$;
revoke all on function public.friend_usage(integer) from public, anon;
grant execute on function public.friend_usage(integer) to authenticated;
