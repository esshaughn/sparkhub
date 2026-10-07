-- Idea discussions reach everyone interested (owner, 2026-10-07): when anyone posts a top-level comment on an idea (not a
-- reply), each person interested gets a line in their notifications (the bell), "Dee on Power point night: …". Until now
-- only a host's top-level post did, and only as a push. The phone still gets one push per idea that the next comment
-- replaces (tag cf:{idea}), so a busy discussion doesn't buzz for every line.
-- notes.quiet: a note for the bell only (push_note skips it); clients still can't write notes.
alter table public.notes add column if not exists quiet boolean not null default false;

create or replace function private.push_note() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.quiet then return null; end if;
  perform private.push_send(array[new.user_id], 'updates', 'Spark Hub', new.body, '/#/notifications', 'n:' || new.id);
  return null;
end $$;

-- Otherwise the same as 20261111000000_idea_handoffs.sql
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
