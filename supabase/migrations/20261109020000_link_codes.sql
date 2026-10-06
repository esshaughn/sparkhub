-- Short links (Design HANDOFF v8-8, "Short links: must move this round"): every event gets a random code, made when it's
-- posted and never derived from its id; shares use https://sparkhub.wereallneighbors.org/e/{code}. Old /i/{id} links
-- keep working (they redirect to the code) for 6 months, until 2027-04-06, then show "This link has expired".
create extension if not exists pgcrypto with schema extensions;

create or replace function private.new_link_code() returns text language plpgsql volatile security definer set search_path = public as $$
declare v text; b bytea; i int;
begin
  loop
    b := extensions.gen_random_bytes(8); v := '';
    for i in 0..7 loop v := v || substr('abcdefghijkmnpqrstuvwxyz23456789', 1 + (get_byte(b, i) % 32), 1); end loop;
    exit when not exists (select 1 from sparks where link_code = v);
  end loop;
  return v;
end $$;
revoke all on function private.new_link_code() from public, anon, authenticated;

alter table public.sparks add column if not exists link_code text;
update public.sparks set link_code = private.new_link_code() where link_code is null;
alter table public.sparks alter column link_code set not null;
alter table public.sparks add constraint sparks_link_code_key unique (link_code);
alter table public.sparks add constraint sparks_link_code_ok check (link_code ~ '^[a-z0-9]{6,16}$');
-- Clients never set or change it (no update grant; inserts get the default)
-- Set on insert by this trigger (no column default: clients can't reach the private schema)
create or replace function private.sparks_link_code_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.link_code is null or coalesce(auth.role(), '') <> 'service_role' then new.link_code := private.new_link_code(); end if;
  elsif coalesce(auth.role(), '') = 'service_role' then return new;
  else new.link_code := old.link_code; end if;
  return new;
end $$;
drop trigger if exists sparks_link_code_guard on public.sparks;
create trigger sparks_link_code_guard before insert or update of link_code on public.sparks
  for each row execute function private.sparks_link_code_guard();

-- Open an event by its code (the app, for /e/{code}): records the link like open_idea() and returns the event's id;
-- a wrong or deleted code returns null (never says whether anything exists)
create or replace function public.open_event(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_code !~ '^[a-z0-9]{6,16}$' then return null; end if;
  select id into v from sparks where link_code = p_code;
  if v is null then return null; end if;
  insert into link_access (user_id, spark_id, via) values (auth.uid(), v, 'link') on conflict do nothing;
  return v;
end $$;
revoke all on function public.open_event(text) from public, anon;
grant execute on function public.open_event(text) to authenticated;

-- Old /i/{id} links: open_idea() works until 2027-04-06, then refuses (the app shows the expired screen)
create or replace function public.open_idea(p_spark uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if now() >= timestamptz '2027-04-06 00:00 America/Chicago' then return false; end if;
  if not exists (select 1 from sparks where id = p_spark) then return false; end if;
  insert into link_access (user_id, spark_id, via) values (auth.uid(), p_spark, 'link') on conflict do nothing;
  return true;
end $$;
-- …and the preview page redirects them: the code for an id (same 6 months)
create or replace function public.link_code_for(p_spark uuid) returns text
language sql stable security definer set search_path = public as $$
  select link_code from sparks where id = p_spark and now() < timestamptz '2027-04-06 00:00 America/Chicago';
$$;
revoke all on function public.link_code_for(uuid) from public;
grant execute on function public.link_code_for(uuid) to anon, authenticated;

-- Link preview tags by code: the event only (title, day, time, location, photo), no group name, member count or photo
-- of the group; invite-only events stay generic (nothing returned)
create or replace function public.event_preview(p_code text)
returns table (title text, day_date date, day_time time, spot text, photo text)
language sql stable security definer set search_path = public as $$
  select s.text, s.day_date, s.day_time, nullif(s.spot, ''),
         (select p from unnest(s.photos) p where p ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' limit 1)
    from sparks s
   where s.link_code = p_code and s.visibility = 'group' and s.cancelled_at is null;
$$;
revoke all on function public.event_preview(text) from public;
grant execute on function public.event_preview(text) to anon, authenticated;
