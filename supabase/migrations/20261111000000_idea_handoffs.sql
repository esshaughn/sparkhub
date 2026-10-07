-- Ideas audit (2026-10-07), fixes 3–5: lead asks get an answer, offers to lead reach the starter, handoffs leave
-- someone in charge, and the people interested hear when the idea moves.
--
-- 1. answer_lead_ask(p_spark, p_yes): the person asked says yes (takes the lead) or no (the asker gets a note);
--    withdraw_lead_ask(p_spark, p_user): the asker or a host takes an ask back, quietly; asks lapse after 7 days
--    (lead-asks-expire, daily) with a note to the asker.
-- 2. Offer to lead (interests.can_help false → true, or an insert with it) pushes the hosts "X offered to lead T"
--    (the same tag as the "is interested" push, so it replaces it on their phone).
-- 3. A lead change or a cancel clears open offers to take over (they'd go stale); a cancel clears asks too.
--    answer_lead_offer refuses an offer the lead changed under, instead of quietly doing nothing.
-- 4. take_the_lead: "I'll decide" (lead_rule 'me', every idea since v8-8) needs an ask; the starter is thanked
--    only when they floated it; the people interested and anyone else asked get a note.
-- 5. step_back with no co-lead: someone who took over a floated idea hands it back to the starter (looking for a
--    lead again, so the starter can choose one), if they're still in its groups. The person stepping back stays
--    interested. Copy: "Anyone in its groups can offer to lead it."
-- 6. On an idea, a host picking or changing the date or place notes the people interested and the voters.
-- 7. make_plan's push asks "Are you going?"; push_made_plan skips the people make_plan already told.
-- 8. On an idea, a host's new top-level comment pushes the people interested (Discussion is on for every idea).
-- 9. Hosts read talk offers (a lead who took over sees who offered to talk it through).

-- 1. Answering and withdrawing asks ---------------------------------------------------------------------------
create or replace function public.answer_lead_ask(p_spark uuid, p_yes boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a record; v_text text;
begin
  select * into a from lead_asks where spark_id = p_spark and user_id = auth.uid();
  if a.spark_id is null then raise exception 'nobody asked you to lead this' using errcode = '22023'; end if;
  if coalesce(p_yes, false) then
    perform public.take_the_lead(p_spark);
    return;
  end if;
  delete from lead_asks where spark_id = p_spark and user_id = auth.uid();
  select text into v_text from sparks where id = p_spark;
  if a.asked_by is not null and a.asked_by <> auth.uid() then
    insert into notes (user_id, body, created_by)
      values (a.asked_by, left(private.person_name(auth.uid(), p_spark) || ' can’t lead ' || left(v_text, 120) || ' right now. You can ask someone else.', 320), auth.uid());
  end if;
end $$;
revoke execute on function public.answer_lead_ask(uuid, boolean) from public, anon;
grant execute on function public.answer_lead_ask(uuid, boolean) to authenticated;

create or replace function public.withdraw_lead_ask(p_spark uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from lead_asks a join sparks s on s.id = a.spark_id
                  where a.spark_id = p_spark and a.user_id = p_user
                    and (a.asked_by = auth.uid() or public.is_host(p_spark) or public.is_admin(s.group_id))) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from lead_asks where spark_id = p_spark and user_id = p_user;
end $$;
revoke execute on function public.withdraw_lead_ask(uuid, uuid) from public, anon;
grant execute on function public.withdraw_lead_ask(uuid, uuid) to authenticated;

create or replace function private.expire_lead_asks() returns void language plpgsql security definer set search_path = public as $$
begin
  with gone as (
    delete from lead_asks a where a.created_at < now() - interval '7 days'
    returning a.spark_id, a.user_id, a.asked_by)
  insert into notes (user_id, body, created_by)
    select g.asked_by, left(private.person_name(g.user_id, g.spark_id) || ' didn’t answer about leading ' || left(s.text, 120) || '. You can ask someone else.', 320), g.user_id
      from gone g join sparks s on s.id = g.spark_id
     where g.asked_by is not null and s.cancelled_at is null and not s.planned and s.wants_host
       and not s.demo and not coalesce(s.test, false);
end $$;
revoke all on function private.expire_lead_asks() from public, anon, authenticated;
do $$ begin
  perform cron.schedule('lead-asks-expire', '23 14 * * *', 'select private.expire_lead_asks()');
exception when others then raise warning 'lead-asks-expire schedule: %', sqlerrm;   -- no pg_cron (the local checks)
end $$;

-- 2. Offer to lead tells the hosts ----------------------------------------------------------------------------
create or replace function private.push_lead_offer() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; hosts uuid[];
begin
  if auth.uid() is null or new.user_id is distinct from auth.uid() or not new.can_help then return null; end if;
  if tg_op = 'UPDATE' and old.can_help then return null; end if;
  select id, text, planned, cancelled_at into s from sparks where id = new.spark_id;
  if s.id is null or s.planned or s.cancelled_at is not null then return null; end if;
  hosts := array(select h from unnest(private.host_ids(s.id)) h where h <> new.user_id);
  perform private.push_send(hosts, 'hosting', s.text, private.person_name(new.user_id, s.id) || ' offered to lead ' || s.text,
    '/#/idea/' || s.id, 'i:' || s.id || ':' || new.user_id);
  return null;
end $$;
revoke all on function private.push_lead_offer() from public, anon, authenticated;
drop trigger if exists push_lead_offer on public.interests;
create trigger push_lead_offer after insert or update of can_help on public.interests
  for each row execute function private.push_lead_offer();

-- 3. Stale offers and asks go when the lead changes or the event is cancelled -----------------------------------
create or replace function private.handoff_cleanup() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is distinct from old.lead_id or (new.cancelled_at is not null and old.cancelled_at is null) then
    delete from lead_offers where spark_id = new.id;
  end if;
  if new.cancelled_at is not null and old.cancelled_at is null then
    delete from lead_asks where spark_id = new.id;
  end if;
  return null;
end $$;
revoke all on function private.handoff_cleanup() from public, anon, authenticated;
drop trigger if exists sparks_handoff_cleanup on public.sparks;
create trigger sparks_handoff_cleanup after update of lead_id, cancelled_at on public.sparks
  for each row execute function private.handoff_cleanup();

create or replace function public.answer_lead_offer(p_spark uuid, p_yes boolean)
returns void language plpgsql security definer set search_path = public as $$
declare o record; s record; v_name text;
begin
  select * into o from lead_offers where spark_id = p_spark and user_id = auth.uid() for update;
  if o.spark_id is null then raise exception 'nobody offered you the lead' using errcode = '22023'; end if;
  select id, text, lead_id, planned, cancelled_at into s from sparks where id = p_spark for update;
  if coalesce(p_yes, false) and s.cancelled_at is null and s.lead_id is distinct from o.offered_by then
    delete from lead_offers where spark_id = p_spark;
    raise exception 'the lead changed since this offer' using errcode = '22023';
  end if;
  delete from lead_offers where spark_id = p_spark;
  v_name := private.person_name(auth.uid(), p_spark);
  if s.cancelled_at is not null then return; end if;   -- called off: nothing to take over, and no "can't" note
  if not coalesce(p_yes, false) then
    insert into notes (user_id, body, created_by)
      values (o.offered_by, left(v_name || ' can’t take over ' || left(s.text, 120) || ' right now.', 320), auth.uid());
    return;
  end if;
  delete from cohosts where spark_id = p_spark and user_id = auth.uid();
  update sparks set lead_id = auth.uid(), lead_name = coalesce((select nullif(p.name, '') from profiles p where p.id = auth.uid()), 'Someone'), wants_host = false where id = p_spark;
  insert into cohosts (spark_id, user_id, added_by) values (p_spark, o.offered_by, auth.uid()) on conflict (spark_id, user_id) do nothing;
  delete from interests where spark_id = p_spark and user_id = auth.uid();
  if s.planned then
    insert into rsvps (spark_id, user_id, status) values (p_spark, auth.uid(), 'going') on conflict (spark_id, user_id) do update set status = 'going';
  else
    insert into notes (user_id, body, created_by)
      select i.user_id, left(v_name || ' is leading ' || left(s.text, 120) || ' now.', 320), auth.uid()
        from interests i where i.spark_id = p_spark and i.user_id not in (auth.uid(), o.offered_by);
  end if;
  insert into notes (user_id, body, created_by)
    values (o.offered_by, left(v_name || ' is leading ' || left(s.text, 120) || ' now. You’re a co-lead.', 320), auth.uid());
end $$;

-- 4. Taking the lead --------------------------------------------------------------------------------------------
create or replace function public.take_the_lead(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_name text; v_asked uuid[];
begin
  select id, text, lead_id, created_by, lead_rule, wants_host, planned, cancelled_at into s from sparks where id = p_spark for update;
  if s.id is null or not public.can_see_spark(p_spark) or not public.is_signed_in() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not private.in_event_groups(p_spark, auth.uid()) then
    raise exception 'leads come from the event''s groups' using errcode = '42501';
  end if;
  if not s.wants_host or s.planned or s.cancelled_at is not null or s.lead_id = auth.uid() then
    raise exception 'this idea isn''t looking for a lead' using errcode = '23514';
  end if;
  -- "I'll decide": the starter picks, so only someone they (or a host) asked can take it
  if s.lead_rule = 'me' and auth.uid() is distinct from s.created_by
     and not exists (select 1 from lead_asks where spark_id = p_spark and user_id = auth.uid()) then
    raise exception 'the starter picks who leads this' using errcode = '42501';
  end if;
  select coalesce(nullif(p.name, ''), 'Someone') into v_name from profiles p where p.id = auth.uid();
  v_name := coalesce(v_name, 'Someone');
  select array_agg(user_id) into v_asked from lead_asks where spark_id = p_spark and user_id <> auth.uid();
  delete from cohosts where spark_id = p_spark and user_id = auth.uid();
  delete from lead_asks where spark_id = p_spark;
  update sparks set lead_id = auth.uid(), lead_name = v_name, wants_host = false where id = p_spark;
  if s.lead_id is not null and s.lead_id <> auth.uid() then
    insert into interests (spark_id, user_id) values (p_spark, s.lead_id) on conflict (spark_id, user_id) do nothing;
    insert into notes (user_id, body, created_by)
      values (s.lead_id, left(v_name || ' is leading ' || left(s.text, 120) || '.' || case when s.lead_id = s.created_by then ' Thanks for floating it!' else '' end, 320), auth.uid());
  end if;
  delete from interests where spark_id = p_spark and user_id = auth.uid();   -- the new lead isn't "interested" in their own idea
  -- Everyone else following it: the people interested, and anyone else who was asked
  insert into notes (user_id, body, created_by)
    select u, left(v_name || ' is leading ' || left(s.text, 120) || ' now.', 320), auth.uid()
      from (select user_id as u from interests where spark_id = p_spark union select unnest(coalesce(v_asked, '{}'))) x
     where u not in (auth.uid(), coalesce(s.lead_id, auth.uid()));
end $$;

-- 5. Stepping back ----------------------------------------------------------------------------------------------
create or replace function public.step_back(p_spark uuid)
returns text language plpgsql security definer set search_path = public as $$
declare s record; v_new uuid; v_me text; v_back boolean;
begin
  select id, text, lead_id, created_by, planned, cancelled_at into s from sparks where id = p_spark for update;
  if s.id is null or s.lead_id is distinct from auth.uid() then
    raise exception 'only the lead can step back' using errcode = '42501';
  end if;
  if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '22023'; end if;
  v_me := private.person_name(auth.uid(), p_spark);
  select user_id into v_new from cohosts where spark_id = p_spark order by created_at, user_id limit 1;
  if v_new is not null then
    delete from cohosts where spark_id = p_spark and user_id = v_new;
    update sparks set lead_id = v_new, lead_name = coalesce((select nullif(name, '') from profiles where id = v_new), 'Someone')
     where id = p_spark;
    insert into notes (user_id, body, created_by)
      values (v_new, left(v_me || ' stepped back, so you’re leading ' || left(s.text, 120) || ' now.', 320), auth.uid());
    return 'handed';
  end if;
  if s.planned then
    insert into notes (user_id, body, created_by)
      select r.user_id, left(left(s.text, 120) || ' is an idea again: ' || v_me || ' stepped back as lead. Anyone in its groups can offer to lead it.', 320), auth.uid()
        from rsvps r where r.spark_id = p_spark and r.status in ('going', 'maybe') and r.user_id <> auth.uid() and r.user_id is distinct from s.created_by;
    insert into interests (spark_id, user_id)
    select spark_id, user_id from rsvps where spark_id = p_spark and status in ('going', 'maybe')
    on conflict do nothing;
    delete from rsvps where spark_id = p_spark;
  end if;
  -- Someone who took it over hands it back to whoever started it, who can choose a new lead
  v_back := s.created_by is not null and s.created_by <> auth.uid() and private.in_event_groups(p_spark, s.created_by);
  if v_back then
    update sparks set planned = false, wants_host = true, lead_id = s.created_by,
      lead_name = coalesce((select nullif(name, '') from profiles where id = s.created_by), 'Someone') where id = p_spark;
    insert into interests (spark_id, user_id) values (p_spark, auth.uid()) on conflict do nothing;
    delete from interests where spark_id = p_spark and user_id = s.created_by;
    insert into notes (user_id, body, created_by)
      values (s.created_by, left(v_me || ' stepped back from leading ' || left(s.text, 120) || '. It’s looking for a lead again, and you can choose one.', 320), auth.uid());
  else
    update sparks set planned = false, wants_host = true where id = p_spark;
  end if;
  return 'idea';
end $$;

-- 6. A picked date or place on an idea tells the people following it --------------------------------------------
create or replace function private.idea_picked() returns trigger language plpgsql security definer set search_path = public as $$
declare v_date boolean; v_spot boolean; v_what text; v_me text;
begin
  if auth.uid() is null or new.planned or new.cancelled_at is not null or new.demo or coalesce(new.test, false) then return null; end if;
  v_date := new.day_date is not null and new.day_date is distinct from old.day_date;
  v_spot := new.spot is not null and new.spot is distinct from old.spot;
  if not (v_date or v_spot) then return null; end if;
  v_what := concat_ws(' and ',
    case when v_date then to_char(new.day_date, 'Dy, Mon FMDD') end,
    case when v_spot then left(new.spot, 60) end);
  v_me := private.person_name(auth.uid(), new.id);
  insert into notes (user_id, body, created_by)
    select u, left(v_me || ' picked ' || v_what || ' for ' || left(new.text, 120) || '.', 320), auth.uid()
      from (select i.user_id as u from interests i where i.spark_id = new.id
            union select v.user_id from date_votes v join date_options o on o.id = v.option_id where v_date and o.spark_id = new.id
            union select v.user_id from spot_votes v join spot_options o on o.id = v.option_id where v_spot and o.spark_id = new.id) x
     where u <> auth.uid() and u <> all(private.host_ids(new.id));
  return null;
end $$;
revoke all on function private.idea_picked() from public, anon, authenticated;
drop trigger if exists sparks_idea_picked on public.sparks;
create trigger sparks_idea_picked after update of day_date, spot on public.sparks
  for each row execute function private.idea_picked();

-- 7. make_plan asks; the group's "It's a plan" push skips the people it moved ------------------------------------
create or replace function public.make_plan(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; users uuid[];
begin
  if not public.is_host(p_spark) then
    raise exception 'only a host can make it a plan' using errcode = '42501';
  end if;
  if exists (select 1 from sparks where id = p_spark and wants_host) then
    raise exception 'find a lead first' using errcode = '23514';
  end if;
  if exists (select 1 from sparks where id = p_spark and day_date is null) then
    raise exception 'pick a date first' using errcode = '23514';
  end if;
  if exists (select 1 from sparks where id = p_spark and day_date < (now() at time zone 'America/Chicago')::date) then
    raise exception 'that date has passed' using errcode = '23514';
  end if;
  select id, text, planned, lead_id, day_date, day_time, spot, demo, test, cancelled_at into s from sparks where id = p_spark;
  if s.planned then return; end if;
  update sparks set planned = true where id = p_spark;
  insert into rsvps (spark_id, user_id, status)
  select s.id, s.lead_id, 'going' where s.lead_id is not null and s.cancelled_at is null
  on conflict (spark_id, user_id) do nothing;
  with moved as (
    insert into rsvps (spark_id, user_id, status)
    select i.spark_id, i.user_id, 'maybe' from interests i
     where i.spark_id = p_spark and i.user_id is distinct from s.lead_id
       and not exists (select 1 from cohosts c where c.spark_id = p_spark and c.user_id = i.user_id)
    on conflict (spark_id, user_id) do nothing
    returning user_id)
  select array_agg(user_id) into users from moved;
  if users is not null and not (s.demo or coalesce(s.test, false)) then
    perform private.push_send(users, 'updates', s.text || ' is on: ' || to_char(s.day_date, 'Dy, Mon FMDD'),
      private.when_text(s.day_date, s.day_time, s.spot) || '. Are you going? You’re a Maybe for now.', '/#/idea/' || s.id, 'mp:' || s.id);
  end if;
end $$;

create or replace function private.push_made_plan() returns trigger language plpgsql security definer set search_path = public as $$
declare g text; users uuid[];
begin
  if auth.uid() is null or new.visibility <> 'group' then return null; end if;
  select name into g from groups where id = new.group_id;
  select array_agg(distinct m.user_id) into users from memberships m
   where (m.group_id = new.group_id or m.group_id in (select group_id from spark_groups where spark_id = new.id))
     and m.user_id <> all(private.host_ids(new.id))
     and not exists (select 1 from interests i where i.spark_id = new.id and i.user_id = m.user_id);   -- make_plan told them
  perform private.push_send(users, 'newevents', 'It’s a plan in ' || coalesce(g, 'your group') || ': ' || new.text,
    private.when_text(new.day_date, new.day_time, new.spot) || '. RSVP in Spark Hub.', '/#/idea/' || new.id, 'e:' || new.id);
  return null;
end $$;

-- 8. Discussion on an idea: a host's new post reaches the people interested --------------------------------------
create or replace function private.push_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; hosts uuid[]; others uuid[]; fans uuid[]; n int; v_author uuid; v_who text;
begin
  select id, text, planned into s from sparks where id = new.spark_id;
  if s.id is null then return null; end if;
  hosts := private.host_ids(s.id);
  v_who := private.person_name(new.created_by, s.id);
  others := array(select h from unnest(hosts) h where h is distinct from new.created_by);
  if cardinality(others) > 0 then
    select count(*) into n from event_comments c
     where c.spark_id = s.id and c.created_at > now() - interval '1 hour' and c.created_by <> all(hosts);
    perform private.push_send(others, 'hosting', s.text,
      case when n > 1 then n || ' new comments' else v_who || ': ' || left(new.body, 120) end,
      '/#/idea/' || s.id, 'cm:' || s.id);
  end if;
  -- a host posting on an idea: everyone interested hears it (the lead's way to reach them before it's a plan)
  if not s.planned and new.parent_id is null and new.update_id is null and new.created_by = any(hosts) then
    fans := array(select i.user_id from interests i where i.spark_id = s.id and i.user_id <> all(hosts));
    perform private.push_send(fans, 'updates', s.text, v_who || ': ' || left(new.body, 120), '/#/idea/' || s.id, 'cf:' || s.id);
  end if;
  -- a reply: the post's author hears about it (once: a host already got the push above)
  if new.parent_id is not null then
    select created_by into v_author from event_comments where id = new.parent_id;
  elsif new.update_id is not null then
    select created_by into v_author from plan_updates where id = new.update_id;
  end if;
  if v_author is not null and v_author is distinct from new.created_by and not (v_author = any(hosts)) then
    perform private.push_send(array[v_author], 'updates', s.text, v_who || ' replied: ' || left(new.body, 120),
      '/#/idea/' || s.id, 'cr:' || coalesce(new.parent_id, new.update_id));
  end if;
  return null;
end $$;

-- 9. Hosts read the talk offers ---------------------------------------------------------------------------------
drop policy if exists "your talk offers, or the ones on your ideas" on public.talk_offers;
create policy "your talk offers, or the ones on your ideas" on public.talk_offers
  for select to authenticated
  using (user_id = auth.uid() or public.is_host(spark_id)
         or exists (select 1 from sparks s where s.id = spark_id and s.created_by = auth.uid()));
