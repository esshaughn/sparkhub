-- Guests (anonymous sessions, not signed in) can see the event they were sent and RSVP with a name, and
-- nothing else (owner, 2026-10-01). Everything else (interest, suggestions, votes, jobs and shifts, album
-- and profile photos, helping organize) needs an account; the app asks them to make one.
-- * A guest's RSVP needs their guest_contacts row for that event (their name); phone numbers are no
--   longer collected (the column stays for rows already saved, readable by the lead as before).
-- * Restrictive policies add "signed in" on top of each table's existing insert rules, so the rules for
--   members don't change. Functions that write for others (make_plan, the demo seeding) are unaffected.

alter table public.guest_contacts alter column phone drop not null;
alter table public.guest_contacts drop constraint guest_contacts_phone_check;
alter table public.guest_contacts add constraint guest_contacts_phone_check
  check (phone is null or (phone ~ '^[0-9 ()+.-]{10,20}$' and char_length(regexp_replace(phone, '\D', '', 'g')) >= 10));

do $$ declare t text; begin
  foreach t in array array['interests', 'date_options', 'spot_options', 'date_votes', 'spot_votes',
                           'signup_items', 'signup_claims', 'album_photos', 'organizers'] loop
    execute format('drop policy if exists "signed in only" on public.%I', t);
    execute format('create policy "signed in only" on public.%I as restrictive for insert to authenticated with check (public.is_signed_in())', t);
  end loop;
end $$;

-- RSVPs: an account, or a guest who has left their name for this event
drop policy if exists "guests rsvp with a name" on public.rsvps;
create policy "guests rsvp with a name" on public.rsvps as restrictive for insert to authenticated
  with check (public.is_signed_in()
              or exists (select 1 from public.guest_contacts g where g.spark_id = rsvps.spark_id and g.user_id = auth.uid()));
drop policy if exists "guests change their rsvp with a name" on public.rsvps;
create policy "guests change their rsvp with a name" on public.rsvps as restrictive for update to authenticated
  with check (public.is_signed_in()
              or exists (select 1 from public.guest_contacts g where g.spark_id = rsvps.spark_id and g.user_id = auth.uid()));

-- Profile photos need an account (a guest's profile is just a name)
drop policy if exists "photos need an account" on public.profiles;
create policy "photos need an account" on public.profiles as restrictive for insert to authenticated
  with check (avatar_path is null or public.is_signed_in());
drop policy if exists "photo changes need an account" on public.profiles;
create policy "photo changes need an account" on public.profiles as restrictive for update to authenticated
  with check (avatar_path is null or public.is_signed_in());

-- Photo uploads need an account (replaces the guests' 10 a day from 20261101010000_photo_limits.sql)
create or replace function public.photo_upload_ok()
returns boolean language sql stable security definer set search_path = public, storage as $$
  select public.is_signed_in()
     and (select count(*) from storage.objects o
           where o.bucket_id = 'spark-photos'
             and o.name like auth.uid()::text || '/%'
             and o.created_at > now() - interval '24 hours') < 50;
$$;

-- The old offers path (no longer used by the app) needs an account too
create or replace function public.add_offer(p_spark uuid, p_kind text, p_body text, p_who text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_lead uuid;
  v_status text := 'accepted';
begin
  if not public.is_signed_in() then raise exception 'sign in first' using errcode = '42501'; end if;
  if not public.can_see_spark(p_spark) then raise exception 'no such spark'; end if;
  select lead_id into v_lead from sparks where id = p_spark;
  if p_kind in ('spot', 'day') and v_lead is distinct from auth.uid() then v_status := 'pending'; end if;
  if p_kind = 'day' and p_body !~ '^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$' then raise exception 'a date looks like 2026-10-12T07:00'; end if;

  insert into offers (spark_id, user_id, who, kind, body, status)
  values (p_spark, auth.uid(), left(trim(p_who), 40), p_kind, left(trim(p_body), 300), v_status);

  if v_status = 'accepted' and p_kind = 'spot' then update sparks set spot = left(trim(p_body), 80) where id = p_spark; end if;
  if v_status = 'accepted' and p_kind = 'day'  then perform public.apply_day(p_spark, p_body); end if;
  return v_status;
end $$;
