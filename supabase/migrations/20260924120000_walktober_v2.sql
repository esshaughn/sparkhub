-- Walktober v2 (design handoff "Spark Torrez - Full Site 2"):
-- dream-version lines + photos on sparks, "I'm interested", offers that wait for
-- the lead, removing date options, stepping back, deleting ideas, renaming yourself,
-- and merging an anonymous identity into a phone-verified account.

-- ---------------------------------------------------------------------------
-- sparks: bits → hopes (up to 3 × 30 chars), photos (up to 3 storage paths)
-- ---------------------------------------------------------------------------

create function public.all_short(arr text[], max_len int)
returns boolean language sql immutable as $$
  select coalesce(bool_and(char_length(x) <= max_len), true) from unnest(arr) as x;
$$;

alter table public.sparks rename column bits to hopes;
alter table public.sparks drop constraint sparks_bits_check;
alter table public.sparks
  add constraint sparks_hopes_check check (cardinality(hopes) <= 3 and public.all_short(hopes, 30));

alter table public.sparks
  add column photos text[] not null default '{}'
  constraint sparks_photos_check check (cardinality(photos) <= 3 and public.all_short(photos, 200));

-- The lead can delete their idea (dates, RSVPs, offers, interests cascade)
create policy "the lead deletes their spark" on public.sparks
  for delete to authenticated using (lead_id = auth.uid());

-- ---------------------------------------------------------------------------
-- interests: one "I'm interested" per person per spark
-- ---------------------------------------------------------------------------

create table public.interests (
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (spark_id, user_id)
);
alter table public.interests enable row level security;

create policy "interests are readable" on public.interests
  for select to authenticated using (true);
create policy "mark yourself interested" on public.interests
  for insert to authenticated with check (user_id = auth.uid());
create policy "unmark yourself" on public.interests
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- offers: spots/days from non-leads wait for the lead's call
-- ---------------------------------------------------------------------------

alter table public.offers
  add column status text not null default 'accepted'
  check (status in ('pending', 'accepted', 'declined'));

drop function public.add_offer(uuid, text, text, text);

-- Returns the new offer's status: 'pending' (waiting on the lead) or 'accepted'
create function public.add_offer(p_spark uuid, p_kind text, p_body text, p_who text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_lead uuid;
  v_status text := 'accepted';
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select lead_id into v_lead from sparks where id = p_spark;
  if not found then raise exception 'no such spark'; end if;
  if p_kind in ('spot', 'day') and v_lead is distinct from auth.uid() then v_status := 'pending'; end if;

  insert into offers (spark_id, user_id, who, kind, body, status)
  values (p_spark, auth.uid(), left(trim(p_who), 40), p_kind, left(trim(p_body), 300), v_status);

  if v_status = 'accepted' and p_kind = 'spot' then update sparks set spot = left(trim(p_body), 80) where id = p_spark; end if;
  if v_status = 'accepted' and p_kind = 'day'  then update sparks set day  = left(trim(p_body), 80) where id = p_spark; end if;
  return v_status;
end $$;

-- "Use this spot/day" / "Not this time"
create function public.resolve_offer(p_offer uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare o offers%rowtype;
begin
  select * into o from offers where id = p_offer for update;
  if not found or o.status <> 'pending' then raise exception 'that offer is no longer waiting'; end if;
  if not exists (select 1 from sparks where id = o.spark_id and lead_id = auth.uid()) then
    raise exception 'only the lead can decide';
  end if;
  if p_accept then
    update offers set status = 'accepted' where id = p_offer;
    if o.kind = 'spot' then update sparks set spot = left(o.body, 80) where id = o.spark_id; end if;
    if o.kind = 'day'  then update sparks set day  = left(o.body, 80) where id = o.spark_id; end if;
  else
    update offers set status = 'declined' where id = p_offer;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Lead actions that touch other people's rows
-- ---------------------------------------------------------------------------

-- Remove an unlocked date option and strip it from everyone's RSVP
create function public.remove_date_option(p_date uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_spark uuid;
begin
  select spark_id into v_spark from date_options where id = p_date;
  if not found then raise exception 'no such date'; end if;
  if not exists (select 1 from sparks where id = v_spark and lead_id = auth.uid()) then
    raise exception 'only the lead can remove dates';
  end if;
  if exists (select 1 from sparks where id = v_spark and locked_date_id = p_date) then
    raise exception 'a locked-in date can''t be removed';
  end if;
  update rsvps set date_ids = array_remove(date_ids, p_date) where spark_id = v_spark;
  delete from date_options where id = p_date;
end $$;

-- Step back: the idea goes back to "needs a lead"; dates, RSVPs and offers stay
create function public.step_back(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update sparks set lead_id = null, lead_name = null, basics = false
   where id = p_spark and lead_id = auth.uid();
  if not found then raise exception 'you''re not leading this one'; end if;
end $$;

-- Change your display name everywhere it's been stamped
create function public.rename_me(p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text := left(trim(p_name), 40);
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if char_length(v_name) < 1 then raise exception 'name required'; end if;
  update sparks set author_name = v_name where created_by = auth.uid();
  update sparks set lead_name   = v_name where lead_id    = auth.uid();
  update offers set who         = v_name where user_id    = auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- Text-code sign-in: carry an anonymous identity's ideas into the account
-- ---------------------------------------------------------------------------
-- Before signing in to an existing account on a new device, the anonymous
-- session calls prepare_merge() and keeps the token. After sign-in, the account
-- calls complete_merge(token). The token is the proof, so nobody can pull in
-- another person's identity by guessing their user id.

create table public.merge_tokens (
  token      uuid primary key default gen_random_uuid(),
  from_user  uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.merge_tokens enable row level security;   -- no policies: functions only

create function public.prepare_merge()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_token uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into merge_tokens (from_user) values (auth.uid()) returning token into v_token;
  return v_token;
end $$;

create function public.complete_merge(p_token uuid)
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare v_from uuid; v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not signed in'; end if;
  delete from merge_tokens
   where token = p_token and created_at > now() - interval '30 minutes'
  returning from_user into v_from;
  if v_from is null or v_from = v_me then return false; end if;
  if not exists (select 1 from auth.users where id = v_from and is_anonymous) then return false; end if;

  update sparks set created_by = v_me where created_by = v_from;
  update sparks set lead_id    = v_me where lead_id    = v_from;
  update offers set user_id    = v_me where user_id    = v_from;
  update rsvps r set user_id = v_me
   where r.user_id = v_from
     and not exists (select 1 from rsvps x where x.spark_id = r.spark_id and x.user_id = v_me);
  delete from rsvps where user_id = v_from;
  update interests i set user_id = v_me
   where i.user_id = v_from
     and not exists (select 1 from interests x where x.spark_id = i.spark_id and x.user_id = v_me);
  delete from interests where user_id = v_from;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke execute on function public.add_offer(uuid, text, text, text)  from public, anon;
revoke execute on function public.resolve_offer(uuid, boolean)       from public, anon;
revoke execute on function public.remove_date_option(uuid)           from public, anon;
revoke execute on function public.step_back(uuid)                    from public, anon;
revoke execute on function public.rename_me(text)                    from public, anon;
revoke execute on function public.prepare_merge()                    from public, anon;
revoke execute on function public.complete_merge(uuid)               from public, anon;
grant  execute on function public.add_offer(uuid, text, text, text)  to authenticated;
grant  execute on function public.resolve_offer(uuid, boolean)       to authenticated;
grant  execute on function public.remove_date_option(uuid)           to authenticated;
grant  execute on function public.step_back(uuid)                    to authenticated;
grant  execute on function public.rename_me(text)                    to authenticated;
grant  execute on function public.prepare_merge()                    to authenticated;
grant  execute on function public.complete_merge(uuid)               to authenticated;

-- ---------------------------------------------------------------------------
-- Photo storage: public bucket, each person writes only under their own folder
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spark-photos', 'spark-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "upload photos to your own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'spark-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete photos in your own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'spark-photos' and (storage.foldername(name))[1] = auth.uid()::text);
