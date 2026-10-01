-- Rate limits on what people post. private.rate_ok() counts each person's (or event's) recent actions in a small table
-- and says no past the limit; before-insert triggers use it:
--   new events (sparks)                    10 an hour per person
--   date and location suggestions          10 an hour per person per event (each kind)
--   "I'm interested"                       20 an hour per person
--   host updates (plan_updates)            10 an hour per event
--   posting an event to more groups        20 an hour per person
-- Only rows a person writes for themselves count (auth.uid() is the row's own person): rows functions
-- write for others (clear_plan moving everyone going to interested, the demo seeding) and the service
-- role (seed scripts) are never limited. A refusal is SQLSTATE PT429, which PostgREST sends as HTTP 429;
-- the app shows "You're going a bit fast" for it.
-- private.rate_exempt lists accounts the limits skip: on TEST only, the e2e lead accounts (added by
-- scripts/test-leads.py), which post far more than 10 events an hour. Never add anyone on live.
-- The host notifications for suggestions and guests' replies now share one slot per event on the host's
-- phone (a new one replaces the last), so a stream of them can't fill the lock screen.

create table private.rate_hits (
  kind    text not null,
  user_id uuid,
  scope   uuid,
  at      timestamptz not null default now()
);
create index rate_hits_key on private.rate_hits (kind, user_id, scope, at);
create table private.rate_exempt (user_id uuid primary key references auth.users (id) on delete cascade);

-- true (and counts this one) while there have been fewer than p_max in the last p_window
create or replace function private.rate_ok(p_user uuid, p_kind text, p_max int, p_window interval, p_scope uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext(p_kind || ':' || coalesce(p_user::text, '') || ':' || coalesce(p_scope::text, '')));
  delete from private.rate_hits
   where kind = p_kind and user_id is not distinct from p_user and scope is not distinct from p_scope and at < now() - p_window;
  select count(*) into n from private.rate_hits
   where kind = p_kind and user_id is not distinct from p_user and scope is not distinct from p_scope;
  if n >= p_max then return false; end if;
  insert into private.rate_hits (kind, user_id, scope) values (p_kind, p_user, p_scope);
  return true;
end $$;
revoke all on function private.rate_ok(uuid, text, int, interval, uuid) from public, anon, authenticated;

create or replace function private.rate_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ok boolean := true;
begin
  if me is null then return new; end if;   -- service role, cron, seed scripts
  if exists (select 1 from private.rate_exempt where user_id = me) then return new; end if;
  case tg_table_name
    when 'sparks' then
      if new.created_by = me then ok := private.rate_ok(me, 'spark', 10, interval '1 hour'); end if;
    when 'date_options' then
      if new.created_by = me then ok := private.rate_ok(me, 'date_option', 10, interval '1 hour', new.spark_id); end if;
    when 'spot_options' then
      if new.created_by = me then ok := private.rate_ok(me, 'spot_option', 10, interval '1 hour', new.spark_id); end if;
    when 'interests' then
      if new.user_id = me then ok := private.rate_ok(me, 'interest', 20, interval '1 hour'); end if;
    when 'plan_updates' then
      ok := private.rate_ok(null, 'plan_update', 10, interval '1 hour', new.spark_id);
    when 'spark_groups' then
      ok := private.rate_ok(me, 'spark_group', 20, interval '1 hour');
  end case;
  if not ok then
    raise exception 'rate limit: too many at once, try again in a while' using errcode = 'PT429';
  end if;
  return new;
end $$;

create trigger rate_limit before insert on public.sparks       for each row execute function private.rate_limit();
create trigger rate_limit before insert on public.date_options for each row execute function private.rate_limit();
create trigger rate_limit before insert on public.spot_options for each row execute function private.rate_limit();
create trigger rate_limit before insert on public.interests    for each row execute function private.rate_limit();
create trigger rate_limit before insert on public.plan_updates for each row execute function private.rate_limit();
create trigger rate_limit before insert on public.spark_groups for each row execute function private.rate_limit();

-- Old counts go once a day
select cron.unschedule('rate-hits-cleanup') where exists (select 1 from cron.job where jobname = 'rate-hits-cleanup');
select cron.schedule('rate-hits-cleanup', '17 4 * * *', $$delete from private.rate_hits where at < now() - interval '1 day'$$);

-- Host notifications: anything a guest (anonymous session) does, and every suggestion, uses one tag per
-- event, so the newest replaces the last on the host's phone instead of stacking up
create or replace function private.push_host() returns trigger language plpgsql security definer set search_path = public as $$
declare s record; who uuid; msg text; tag text;
begin
  if auth.uid() is null then return null; end if;
  if tg_table_name = 'signup_claims' then
    select sp.id, sp.text, sp.lead_id, i.item into s from signup_items i join sparks sp on sp.id = i.spark_id where i.id = new.item_id;
  else
    select id, text, lead_id, null::text as item into s from sparks where id = new.spark_id;
  end if;
  if tg_table_name = 'rsvps' then
    if tg_op = 'UPDATE' and new.status = old.status then return null; end if;
    if new.user_id is distinct from auth.uid() then return null; end if;   -- moved by make_plan, not a reply
    -- Taking a job marks you Going: the sign-up's own notification covers it
    if new.status = 'going' and exists (select 1 from signup_claims c join signup_items i on i.id = c.item_id
                                         where i.spark_id = new.spark_id and c.user_id = new.user_id
                                           and c.created_at > now() - interval '2 minutes') then return null; end if;
    who := new.user_id;
    msg := private.person_name(who, s.id) || case new.status when 'going' then ' is going to ' when 'maybe' then ' might come to ' else ' can’t make it to ' end || s.text;
    tag := 'rv:' || s.id || ':' || who;
  elsif tg_table_name = 'interests' then
    if new.user_id is distinct from auth.uid() then return null; end if;   -- moved by clear_plan, not interest
    who := new.user_id;
    msg := private.person_name(who, s.id) || ' is interested in ' || s.text;
    tag := 'i:' || s.id || ':' || who;
  elsif tg_table_name = 'signup_claims' then
    who := new.user_id;
    msg := private.person_name(who, s.id) || ' signed up for “' || s.item || '” at ' || s.text;
    tag := 's:' || new.item_id || ':' || who;
  elsif tg_table_name = 'date_options' then
    who := new.created_by;
    msg := coalesce(nullif(new.who, ''), private.person_name(who, s.id)) || ' suggested ' || to_char(new.day_date, 'Dy, Mon FMDD') || ' for ' || s.text;
    tag := 'd:' || s.id;
  else
    who := new.created_by;
    msg := coalesce(nullif(new.who, ''), private.person_name(who, s.id)) || ' suggested ' || new.name || ' for ' || s.text;
    tag := 'p:' || s.id;
  end if;
  if who is null or who = s.lead_id then return null; end if;
  if who = auth.uid() and not public.is_signed_in() then tag := 'g:' || s.id; end if;   -- a guest
  perform private.push_send(array[s.lead_id], 'hosting', s.text, msg, '/#/idea/' || s.id, tag);
  return null;
end $$;
