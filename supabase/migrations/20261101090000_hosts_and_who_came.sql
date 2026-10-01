-- Two changes from the social-science review (2026-10-01):
-- 1. Looking for a host. Floating an idea and hosting it are separate jobs. The person who floated an idea can say
--    they're looking for someone else to host; anyone signed in who can see it can take the lead. Until then the
--    floater stays the lead (every idea keeps a lead, see 20260924160000_every_idea_has_a_lead.sql).
--    Interested people can also say they could help make it happen (interests.can_help).
-- 2. Who came. RSVPs are not attendance. After the day, the host (or a group admin) taps who actually came.

-- 1. Looking for a host -------------------------------------------------------------------------------
alter table public.sparks add column wants_host boolean not null default false;
alter table public.interests add column can_help boolean not null default false;

-- Interested people can switch "I could help" on and off on their own row
drop policy if exists "change your interest" on public.interests;
create policy "change your interest" on public.interests
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant update (can_help) on table public.interests to authenticated;

-- The lead of an idea says they're looking for a host (or not any more)
create or replace function public.set_wants_host(p_spark uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from sparks where id = p_spark and lead_id = auth.uid() and not planned and cancelled_at is null) then
    raise exception 'only the lead of an idea can do that' using errcode = '42501';
  end if;
  update sparks set wants_host = coalesce(p_on, false) where id = p_spark;
end $$;

-- Someone else takes the lead of an idea that's looking for a host. The floater stays interested and hears about it
create or replace function public.take_the_lead(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_name text;
begin
  select id, text, lead_id, wants_host, planned, cancelled_at into s from sparks where id = p_spark for update;
  if s.id is null or not public.can_see_spark(p_spark) or not public.is_signed_in() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not s.wants_host or s.planned or s.cancelled_at is not null or s.lead_id = auth.uid() then
    raise exception 'this idea isn''t looking for a host' using errcode = '23514';
  end if;
  select coalesce(nullif(p.name, ''), 'Someone') into v_name from profiles p where p.id = auth.uid();
  update sparks set lead_id = auth.uid(), lead_name = coalesce(v_name, 'Someone'), wants_host = false where id = p_spark;
  if s.lead_id is not null then
    insert into interests (spark_id, user_id) values (p_spark, s.lead_id) on conflict (spark_id, user_id) do nothing;
    insert into notes (user_id, body, created_by)
      values (s.lead_id, left(coalesce(v_name, 'Someone') || ' is hosting ' || left(s.text, 120) || '. Thanks for floating it!', 320), auth.uid());
  end if;
  delete from interests where spark_id = p_spark and user_id = auth.uid();   -- the new lead isn't "interested" in their own idea
end $$;

revoke execute on function public.set_wants_host(uuid, boolean), public.take_the_lead(uuid) from public, anon;
grant  execute on function public.set_wants_host(uuid, boolean), public.take_the_lead(uuid) to authenticated;

-- 2. Who came -------------------------------------------------------------------------------------------
-- null = not checked yet; true = came; false = didn't
alter table public.rsvps add column attended boolean;

-- Nobody sets attended on their own reply: inserts and updates are limited to the reply itself
revoke insert on table public.rsvps from authenticated;
grant insert (spark_id, user_id, status) on table public.rsvps to authenticated;

-- The host (or a group admin) marks who came, from the day of the event on
create or replace function public.mark_attended(p_spark uuid, p_user uuid, p_came boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select id, lead_id, group_id, planned, day_date into s from sparks where id = p_spark;
  if s.id is null or not (s.lead_id = auth.uid() or public.is_admin(s.group_id)) then
    raise exception 'only the host can check people in' using errcode = '42501';
  end if;
  if not s.planned or s.day_date is null or s.day_date > (now() at time zone 'America/Chicago')::date then
    raise exception 'you can check people in once the day comes' using errcode = '23514';
  end if;
  update rsvps set attended = p_came where spark_id = p_spark and user_id = p_user;
  if not found then raise exception 'they didn''t RSVP' using errcode = '23514'; end if;
end $$;

revoke execute on function public.mark_attended(uuid, uuid, boolean) from public, anon;
grant  execute on function public.mark_attended(uuid, uuid, boolean) to authenticated;
