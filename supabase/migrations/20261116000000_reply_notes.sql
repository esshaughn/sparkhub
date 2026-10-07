-- Replies reach the person replied to (owner, 2026-10-07): when someone replies to your comment or your update in a
-- Discussion, you get a bell line ("Dee replied to you on {event}: …", a quiet note, so push_note doesn't push it twice)
-- and one push per thread that the next reply replaces (tag cr:{post}). Hosts included: a host whose post got a reply
-- hears it as a reply, and is left out of the hosts' "new comment" push for that one. Everything else is as in
-- 20261114000000_idea_comment_notes.sql.
create or replace function private.push_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; hosts uuid[]; others uuid[]; fans uuid[]; n int; v_author uuid; v_who text;
begin
  select id, text, planned into s from sparks where id = new.spark_id;
  if s.id is null then return null; end if;
  hosts := private.host_ids(s.id);
  v_who := private.person_name(new.created_by, s.id);
  -- a reply: whose post it answers
  if new.parent_id is not null then
    select created_by into v_author from event_comments where id = new.parent_id;
  elsif new.update_id is not null then
    select created_by into v_author from plan_updates where id = new.update_id;
  end if;
  if v_author = new.created_by then v_author := null; end if;
  others := array(select h from unnest(hosts) h where h is distinct from new.created_by and h is distinct from v_author);
  if cardinality(others) > 0 then
    select count(*) into n from event_comments c
     where c.spark_id = s.id and c.created_at > now() - interval '1 hour' and c.created_by <> all(hosts);
    perform private.push_send(others, 'hosting', s.text,
      case when n > 1 then n || ' new comments' else v_who || ': ' || left(new.body, 120) end,
      '/#/idea/' || s.id, 'cm:' || s.id);
  end if;
  -- anyone posting on an idea: everyone interested (but the writer and the hosts, who heard above) gets a bell line and
  -- one push per idea that the next comment replaces
  if not s.planned and new.parent_id is null and new.update_id is null then
    fans := array(select i.user_id from interests i where i.spark_id = s.id
                    and i.user_id is distinct from new.created_by and i.user_id <> all(hosts));
    if cardinality(fans) > 0 then
      insert into notes (user_id, body, created_by, quiet)
        select f, left(v_who || ' on ' || s.text || ': ' || new.body, 320), new.created_by, true from unnest(fans) f;
      perform private.push_send(fans, 'updates', s.text, v_who || ': ' || left(new.body, 120), '/#/idea/' || s.id, 'cf:' || s.id);
    end if;
  end if;
  -- the post's author: a bell line and a push
  if v_author is not null then
    insert into notes (user_id, body, created_by, quiet)
      values (v_author, left(v_who || ' replied to you on ' || s.text || ': ' || new.body, 320), new.created_by, true);
    perform private.push_send(array[v_author], 'updates', s.text, v_who || ' replied: ' || left(new.body, 120),
      '/#/idea/' || s.id, 'cr:' || coalesce(new.parent_id, new.update_id));
  end if;
  return null;
end $$;
revoke all on function private.push_comment() from public, anon, authenticated;
