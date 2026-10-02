-- Owner, 2026-10-01 (questionnaire on how the demo works):
--  1. Test events are silent: no phone notification about a test event, for anyone. Every event push links to
--     /#/idea/<id>, so push_send checks that event once instead of each trigger checking on its own.
--     (Notes written when a test event is deleted or cancelled, or a job on one is removed, still push: notes
--     don't record their event.)
--  2. "Remove all demo content" is gone (the owner's Profile button and wipe_demo()). Hub on Hunters is a real
--     group that keeps demo events, so a wipe-everything button was a risk; the seed scripts manage demo content
--     group by group (seed-hub.py, seed-events.py).

-- 1. Test events never push
create or replace function private.push_send(p_users uuid[], p_topic text, p_title text, p_body text, p_url text, p_tag text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare c record; subs jsonb;
begin
  if p_url ~ '^/#/idea/[0-9a-f-]{36}' and exists (select 1 from sparks where id = substr(p_url, 9, 36)::uuid and test) then
    return;
  end if;
  select url, secret into c from private.push_config where id = 1;
  if c.url is null or p_users is null or cardinality(p_users) = 0 then return; end if;
  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)))
    into subs
    from push_subscriptions s
   where s.user_id = any(p_users)
     and not exists (select 1 from notif_state n where n.user_id = s.user_id and n.topics ->> p_topic = 'false');
  if subs is null then return; end if;
  perform net.http_post(
    url := c.url,
    body := jsonb_build_object('subs', subs, 'title', left(coalesce(p_title, 'Spark Hub'), 120), 'body', left(coalesce(p_body, ''), 240), 'url', p_url, 'tag', p_tag),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', c.secret),
    timeout_milliseconds := 8000);
exception when others then
  raise warning 'push_send: %', sqlerrm;   -- a push must never break the write that caused it
end $$;

-- 2. No more wipe
drop function if exists public.wipe_demo();
