-- Design v8-17 item 11: the starter picks a lead from the people who offered.
--
-- pick_lead(p_spark, p_user): a host (or a group admin) makes someone who offered to lead (interests.can_help) the lead of a
-- floated idea that's looking for one. The picked person is pushed; the others who offered and the people interested get a
-- quiet in-app note. The previous lead (the starter) stays on as interested, like take_the_lead does.
create or replace function public.pick_lead(p_spark uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_name text; v_who text; v_others uuid[];
begin
  select id, text, lead_id, group_id, created_by, wants_host, planned, cancelled_at into s from sparks where id = p_spark for update;
  if s.id is null or not (public.is_host(p_spark) or public.is_admin(s.group_id)) then
    raise exception 'only a lead can pick a lead' using errcode = '42501';
  end if;
  if not s.wants_host or s.planned or s.cancelled_at is not null then
    raise exception 'this idea isn''t looking for a lead' using errcode = '23514';
  end if;
  if p_user is null or p_user = s.lead_id or not exists (select 1 from interests where spark_id = p_spark and user_id = p_user and can_help) then
    raise exception 'pick someone who offered' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user and not coalesce(u.is_anonymous, false))
     or not private.in_event_groups(p_spark, p_user) then
    raise exception 'leads come from the event''s groups' using errcode = '22023';
  end if;
  v_name := private.person_name(auth.uid(), p_spark);
  v_who := private.person_name(p_user, p_spark);
  select array_agg(user_id) into v_others from interests where spark_id = p_spark and can_help and user_id <> p_user;
  delete from cohosts where spark_id = p_spark and user_id = p_user;
  delete from lead_asks where spark_id = p_spark;
  update sparks set lead_id = p_user, lead_name = coalesce((select nullif(p.name, '') from profiles p where p.id = p_user), 'Someone'), wants_host = false where id = p_spark;
  if s.lead_id is not null and s.lead_id <> p_user then
    insert into interests (spark_id, user_id) values (p_spark, s.lead_id) on conflict (spark_id, user_id) do nothing;
  end if;
  delete from interests where spark_id = p_spark and user_id = p_user;
  perform private.push_send(array[p_user], 'hosting', v_name || ' picked you to lead ' || left(s.text, 120),
    'You pick the date and make it happen.', '/#/idea/' || s.id, 'pl:' || s.id);
  -- The others who offered: you went another way
  insert into notes (user_id, body, created_by)
    select u, left(v_name || ' went another way on leading ' || left(s.text, 120) || '. ' || v_who || ' is leading it.', 320), auth.uid()
      from unnest(coalesce(v_others, '{}')) u where u <> auth.uid();
  -- Everyone else following it
  insert into notes (user_id, body, created_by)
    select i.user_id, left(v_who || ' is leading ' || left(s.text, 120) || ' now.', 320), auth.uid()
      from interests i where i.spark_id = p_spark and i.user_id not in (auth.uid(), p_user) and not (i.user_id = any(coalesce(v_others, '{}')));
end $$;
revoke execute on function public.pick_lead(uuid, uuid) from public, anon;
grant execute on function public.pick_lead(uuid, uuid) to authenticated;
