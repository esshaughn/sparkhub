-- "Lead" everywhere (owner, 2026-09-30, again 2026-10-01): the two notes still saying host now say lead / co-lead.
-- Same functions as 20261101130000_cohosts.sql; only the note text changes. Grants carry over (create or replace).

create or replace function public.add_cohost(p_spark uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_name text;
begin
  select id, text, lead_id, group_id, cancelled_at into s from sparks where id = p_spark;
  if s.id is null or not (public.is_host(p_spark) or public.is_admin(s.group_id)) then
    raise exception 'only a host can add co-hosts' using errcode = '42501';
  end if;
  if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '22023'; end if;
  if p_user is null or p_user = s.lead_id then raise exception 'they already lead it' using errcode = '22023'; end if;
  -- An account (not a guest) in one of the event's groups
  if not exists (select 1 from auth.users u where u.id = p_user and not coalesce(u.is_anonymous, false))
     or not exists (select 1 from memberships m where m.user_id = p_user
                     and (m.group_id = s.group_id or m.group_id in (select g.group_id from spark_groups g where g.spark_id = p_spark))) then
    raise exception 'co-hosts come from the event''s groups' using errcode = '22023';
  end if;
  if (select count(*) from cohosts where spark_id = p_spark) >= 5 then raise exception 'up to 5 co-hosts' using errcode = '22023'; end if;
  insert into cohosts (spark_id, user_id, added_by) values (p_spark, p_user, auth.uid()) on conflict do nothing;
  if found then
    v_name := private.person_name(auth.uid(), p_spark);
    insert into notes (user_id, body, created_by)
      values (p_user, left(v_name || ' made you a co-lead of ' || left(s.text, 120) || '.', 320), auth.uid());
  end if;
end $$;

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
  delete from cohosts where spark_id = p_spark and user_id = auth.uid();
  update sparks set lead_id = auth.uid(), lead_name = coalesce(v_name, 'Someone'), wants_host = false where id = p_spark;
  if s.lead_id is not null then
    insert into interests (spark_id, user_id) values (p_spark, s.lead_id) on conflict (spark_id, user_id) do nothing;
    insert into notes (user_id, body, created_by)
      values (s.lead_id, left(coalesce(v_name, 'Someone') || ' is leading ' || left(s.text, 120) || '. Thanks for floating it!', 320), auth.uid());
  end if;
  delete from interests where spark_id = p_spark and user_id = auth.uid();   -- the new lead isn't "interested" in their own idea
end $$;

