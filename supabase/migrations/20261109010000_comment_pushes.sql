-- Comment notifications (Design HANDOFF v8-8, decided Oct 5): the hosts get a push for each comment or reply someone
-- else writes, grouped per event within an hour ("3 new comments"); whoever wrote a post (a comment or the lead's
-- update) gets a push when someone replies to it. Pushes only, no bell row. Test events stay quiet (push_send).
create or replace function private.push_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; hosts uuid[]; others uuid[]; n int; v_author uuid; v_who text;
begin
  select id, text into s from sparks where id = new.spark_id;
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
revoke all on function private.push_comment() from public, anon, authenticated;
create trigger event_comments_push after insert on public.event_comments for each row execute function private.push_comment();
