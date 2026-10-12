-- Design v8-26 item 7: "People can contact you", per event, on by default. Off hides the event page's
-- Contact links (Led by → Contact, Questions? Contact {Lead}). The lead sets it (column grant, like guest_invites).
alter table public.sparks add column if not exists contact boolean not null default true;
grant update (contact) on public.sparks to authenticated;

-- Design v8-26 item 8 (1b named invite landing): a group link shared by a member carries ?by=<the first 8 characters
-- of their id>. Signed out, the landing shows the group (name, photo), its member count, how many of its public plans
-- fall in the next 7 days (America/Chicago), and the sharer's first name and photo, only when exactly one member of that
-- group matches (anyone holding the code can join and see its members anyway). Nothing else about the sharer.
create or replace function public.group_invite_landing(p_code text, p_by text default null)
returns table (name text, photo text, members int, week int, by_name text, by_avatar text)
language sql stable security definer set search_path = public as $$
  with g as (select g.id, g.name, g.photo from groups g where g.code = upper(p_code) and char_length(p_code) = 6),
  sharer as (
    select (array_agg(m.user_id))[1] as id from memberships m, g
     where m.group_id = g.id and p_by ~ '^[0-9a-f]{8}$' and left(m.user_id::text, 8) = p_by
    having count(*) = 1)
  select g.name, g.photo,
         (select count(*)::int from memberships m where m.group_id = g.id),
         (select count(*)::int from sparks s
           where (s.group_id = g.id or exists (select 1 from spark_groups sg where sg.spark_id = s.id and sg.group_id = g.id))
             and s.planned and s.cancelled_at is null and s.visibility = 'group' and not s.test
             and s.day_date between (now() at time zone 'America/Chicago')::date and (now() at time zone 'America/Chicago')::date + 6),
         case when (select id from sharer) is not null
              then coalesce((select nullif(split_part(p.name, ' ', 1), '') from profiles p where p.id = (select id from sharer)), 'Someone') end,
         (select p.avatar_path from profiles p where p.id = (select id from sharer))
    from g;
$$;
revoke execute on function public.group_invite_landing(text, text) from public;
grant execute on function public.group_invite_landing(text, text) to anon, authenticated;

-- Design v8-26 item 8 (lead edits days after posting): on an Each day event, people going (or maybe) who had picked a
-- day that's moved or taken off get rsvps.repick (no client grant; the app reads it with one small query when a
-- "taken off the schedule" note comes in, not in load_all) and their note adds "Pick your days again."; the app then
-- reopens When will you attend? for them. Saving their days (or changing their reply) clears it.
alter table public.rsvps add column if not exists repick boolean not null default false;

create or replace function private.sparks_schedule_days() returns trigger language plpgsql security definer set search_path = public as $$
declare v_each boolean; v_lost jsonb;
begin
  if new.schedule is not distinct from old.schedule and new.day_date is not distinct from old.day_date then return null; end if;
  v_each := new.schedule->>'kind' = 'days' and coalesce((new.schedule->>'each')::boolean, false);
  -- Who loses a day they'd picked or hold a job on (before anything changes), for the notes below
  if new.day_date is not null and new.cancelled_at is null then
    select jsonb_agg(jsonb_build_object('user_id', l.user_id, 'd', l.d)) into v_lost from (
      select r.user_id, d from rsvps r, unnest(coalesce(r.days, '{}') || coalesce(r.maybe_days, '{}')) d
       where r.spark_id = new.id and not private.event_has_day(new.day_date, new.schedule, d)
      union
      select c.user_id, i.day from signup_items i join signup_claims c on c.item_id = i.id
       where i.spark_id = new.id and i.day is not null and not private.event_has_day(new.day_date, new.schedule, i.day)) l;
  end if;

  -- Replies (a cancelled event's rows can't be updated, and don't need to be)
  if new.cancelled_at is null then
    if not v_each then
      update rsvps set days = null, maybe_days = null
       where spark_id = new.id and (days is not null or maybe_days is not null);
    else
      update rsvps x set days = nullif(y.nd, '{}'), maybe_days = nullif(y.nm, '{}')
        from (select r.user_id,
                     array(select d from unnest(r.days) d where private.event_has_day(new.day_date, new.schedule, d) order by d) as nd,
                     array(select d from unnest(r.maybe_days) d where private.event_has_day(new.day_date, new.schedule, d) order by d) as nm,
                     r.days, r.maybe_days
                from rsvps r where r.spark_id = new.id and (r.days is not null or r.maybe_days is not null)) y
       where x.spark_id = new.id and x.user_id = y.user_id
         and (y.nd is distinct from y.days or y.nm is distinct from y.maybe_days);
      -- Nothing left on a reply: both arrays null, i.e. the whole event (the status stays as it was)
      update rsvps set days = null, maybe_days = null
       where spark_id = new.id and coalesce(cardinality(days), 0) + coalesce(cardinality(maybe_days), 0) = 0
         and (days is not null or maybe_days is not null);
    end if;
  end if;

  -- Each day: whoever had picked a day that's gone picks again (v8-26 item 8); the app reopens When will you attend?
  if v_each and new.cancelled_at is null and v_lost is not null then
    update rsvps set repick = true
     where spark_id = new.id and status in ('going', 'maybe') and user_id is distinct from auth.uid()
       and user_id in (select l.user_id from jsonb_to_recordset(v_lost) as l(user_id uuid, d date));
  end if;

  -- Jobs and spots on a day that's gone: the whole event
  update signup_items set day = null
   where spark_id = new.id and day is not null and not coalesce(private.event_has_day(new.day_date, new.schedule, day), false);

  -- Tell them (not the person making the change); notes push as usual
  insert into notes (user_id, body, created_by)
  select l.user_id,
         left(left(new.text, 120) || ': ' || string_agg(to_char(l.d, 'Dy, Mon FMDD'), ', ' order by l.d) ||
              case when count(*) > 1 then ' were' else ' was' end || ' taken off the schedule.' ||
              case when v_each and exists (select 1 from rsvps r where r.spark_id = new.id and r.user_id = l.user_id and r.repick)
                   then ' Pick your days again.' else '' end, 320),
         auth.uid()
    from jsonb_to_recordset(coalesce(v_lost, '[]'::jsonb)) as l(user_id uuid, d date)
   where l.user_id is distinct from auth.uid()
   group by l.user_id;
  return null;
end $$;
revoke all on function private.sparks_schedule_days() from public, anon, authenticated;

create or replace function private.rsvp_repick_clear() returns trigger language plpgsql as $$
begin
  if new.repick and new.repick is not distinct from old.repick
     and (new.days is distinct from old.days or new.maybe_days is distinct from old.maybe_days or new.status is distinct from old.status) then
    new.repick := false;
  end if;
  return new;
end $$;
revoke all on function private.rsvp_repick_clear() from public, anon, authenticated;
drop trigger if exists rsvp_repick_clear on public.rsvps;
create trigger rsvp_repick_clear before update on public.rsvps for each row execute function private.rsvp_repick_clear();

-- Picking the same days again still clears it: the app sends this when the person saves without a change
create or replace function public.clear_repick(p_spark uuid) returns void
language sql security definer set search_path = public as $$
  update rsvps set repick = false where spark_id = p_spark and user_id = auth.uid() and repick;
$$;
revoke execute on function public.clear_repick(uuid) from public, anon;
grant execute on function public.clear_repick(uuid) to authenticated;
