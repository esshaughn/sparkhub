-- Invite people (owner's mock, 2026-10-01): the Invite people sheet lists your friends and the people in the event's
-- groups, each with Invite / ✓ Invited. invite_friends() took only friends; now it also takes anyone who shares one
-- of the event's groups with you (home group or a group it's posted to). event_invited() tells whoever can invite
-- who already has an invite, so ✓ Invited survives closing the sheet. Same rules as before otherwise: the lead,
-- co-leads, a home-group admin, or (with guest invites on) someone going; people going or invited are skipped quietly.

create or replace function private.can_invite(p_spark uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_signed_in() and exists (
    select 1 from sparks s
     where s.id = p_spark and s.cancelled_at is null and public.can_see_spark(p_spark)
       and (public.is_host(p_spark) or public.is_admin(s.group_id)
            or (s.guest_invites and exists (select 1 from rsvps r where r.spark_id = p_spark and r.user_id = auth.uid() and r.status = 'going'))));
$$;
revoke all on function private.can_invite(uuid) from public, anon, authenticated;

-- Someone you could invite: a friend, or a member of one of the event's groups that you're in too
create or replace function private.invitable(p_spark uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_friend(p_user) or exists (
    select 1 from memberships m
     where m.user_id = p_user and public.is_member(m.group_id)
       and (m.group_id = (select group_id from sparks where id = p_spark)
            or m.group_id in (select g.group_id from spark_groups g where g.spark_id = p_spark)));
$$;
revoke all on function private.invitable(uuid, uuid) from public, anon, authenticated;

create or replace function public.invite_friends(p_spark uuid, p_people uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid(); s record; p uuid;
  v_invited uuid[] := '{}'; v_going uuid[] := '{}'; v_already uuid[] := '{}';
  v_name text;
begin
  if not public.is_signed_in() then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_people is null or cardinality(p_people) = 0 then return jsonb_build_object('invited', '[]'::jsonb, 'going', '[]'::jsonb, 'already', '[]'::jsonb); end if;
  if cardinality(p_people) > 30 then raise exception 'too many at once' using errcode = '22023'; end if;
  select id, text, lead_id, group_id, planned, guest_invites, cancelled_at, day_date, day_time, spot into s from sparks where id = p_spark;
  if s.id is null or not public.can_see_spark(p_spark) then raise exception 'no such event' using errcode = '22023'; end if;
  if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '22023'; end if;
  if not private.can_invite(p_spark) then raise exception 'the lead hasn''t turned on guest invites' using errcode = '42501'; end if;
  foreach p in array coalesce((select array_agg(distinct x) from unnest(p_people) x where x is not null), '{}') loop
    if p = v_me or not private.invitable(p_spark, p) then continue; end if;
    if p = any(private.host_ids(p_spark)) or exists (select 1 from rsvps r where r.spark_id = p_spark and r.user_id = p and r.status = 'going') then
      v_going := v_going || p;
    elsif exists (select 1 from event_invites i where i.spark_id = p_spark and i.user_id = p) then
      v_already := v_already || p;
    else
      insert into event_invites (spark_id, user_id, invited_by) values (p_spark, p, v_me);
      insert into link_access (user_id, spark_id, via) values (p, p_spark, 'invite')
        on conflict (user_id, spark_id) do update set via = 'invite';
      v_invited := v_invited || p;
    end if;
  end loop;
  if cardinality(v_invited) > 0 then
    v_name := private.person_name(v_me, p_spark);
    perform private.push_send(v_invited, 'friends', v_name || ' invited you to ' || s.text,
      private.when_text(s.day_date, s.day_time, s.spot) || '. RSVP in Spark Hub.', '/#/idea/' || s.id, 'fi:' || s.id);
  end if;
  return jsonb_build_object('invited', to_jsonb(v_invited), 'going', to_jsonb(v_going), 'already', to_jsonb(v_already));
end $$;

-- Who already has an invite to this event (only for someone who can invite to it)
create or replace function public.event_invited(p_spark uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select i.user_id from event_invites i where i.spark_id = p_spark and private.can_invite(p_spark);
$$;
revoke execute on function public.event_invited(uuid) from public, anon;
grant execute on function public.event_invited(uuid) to authenticated;
