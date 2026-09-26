-- V5 phase 1: plans. An idea becomes a plan once the lead locks in a date and a time.
-- Plans get RSVPs (going / maybe / can't), open sign-up lists, updates from the host,
-- a private "before the day" checklist and, once it's happened, a shared album.
-- Ideas get date and location suggestions everyone can vote on, and organizers who help.

-- ---------------------------------------------------------------------------
-- Sparks: plan fields
-- ---------------------------------------------------------------------------
alter table public.sparks
  add column planned     boolean not null default false,
  add column visibility  text    not null default 'group' check (visibility in ('group', 'invite')),
  add column auto_remind boolean not null default true;   -- min_people is from the initial schema
-- A plan always has a day and a time
alter table public.sparks add constraint sparks_plan_has_when
  check (not planned or (day_date is not null and day_time is not null));

grant update (planned, visibility, auto_remind, min_people) on table public.sparks to authenticated;

-- ---------------------------------------------------------------------------
-- RSVPs (plans). Guests take part like with interest: an anonymous session + name/phone.
-- ---------------------------------------------------------------------------
create table public.rsvps (
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  status     text not null check (status in ('going', 'maybe', 'no')),
  created_at timestamptz not null default now(),
  primary key (spark_id, user_id)
);

-- Invite-only plans: members see them only if they lead, run the group, have replied or hold the link
create or replace function public.can_see_spark(p_spark uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from sparks s
     where s.id = p_spark
       and (exists (select 1 from link_access l where l.spark_id = s.id and l.user_id = auth.uid())
            or (exists (select 1 from memberships m where m.group_id = s.group_id and m.user_id = auth.uid())
                and (s.visibility = 'group' or s.lead_id = auth.uid() or public.is_admin(s.group_id)
                     or exists (select 1 from rsvps r where r.spark_id = s.id and r.user_id = auth.uid()))))
  );
$$;

drop policy "members and link holders see an idea" on public.sparks;
create policy "members and link holders see an idea" on public.sparks
  for select to authenticated using (public.can_see_spark(id));

alter table public.rsvps enable row level security;
create policy "rsvps follow the idea" on public.rsvps
  for select to authenticated using (public.can_see_spark(spark_id));
create policy "reply for yourself" on public.rsvps
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_spark(spark_id)
              and exists (select 1 from sparks s where s.id = spark_id and s.planned));
create policy "change your reply" on public.rsvps
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "take back your reply" on public.rsvps
  for delete to authenticated using (user_id = auth.uid());
revoke all on table public.rsvps from anon;
grant select, insert, delete on table public.rsvps to authenticated;
grant update (status) on table public.rsvps to authenticated;

-- ---------------------------------------------------------------------------
-- Idea boards: suggested dates and locations, one vote per person per option
-- ---------------------------------------------------------------------------
create table public.date_options (
  id         uuid primary key default gen_random_uuid(),
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  day_date   date not null,
  day_time   time,
  created_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  who        text not null check (char_length(who) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (spark_id, day_date, day_time)
);
create table public.date_votes (
  option_id uuid not null references public.date_options (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade default auth.uid(),
  primary key (option_id, user_id)
);
create table public.spot_options (
  id         uuid primary key default gen_random_uuid(),
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  address    text check (char_length(address) <= 200),
  lat        double precision,
  lon        double precision,
  created_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  who        text not null check (char_length(who) between 1 and 40),
  created_at timestamptz not null default now()
);
create table public.spot_votes (
  option_id uuid not null references public.spot_options (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade default auth.uid(),
  primary key (option_id, user_id)
);

alter table public.date_options enable row level security;
alter table public.date_votes   enable row level security;
alter table public.spot_options enable row level security;
alter table public.spot_votes   enable row level security;

create policy "date options follow the idea" on public.date_options
  for select to authenticated using (public.can_see_spark(spark_id));
create policy "suggest a date" on public.date_options
  for insert to authenticated with check (created_by = auth.uid() and public.can_see_spark(spark_id));
create policy "take back your date, or the lead removes it" on public.date_options
  for delete to authenticated
  using (created_by = auth.uid() or exists (select 1 from sparks s where s.id = spark_id and s.lead_id = auth.uid()));
create policy "date votes follow the idea" on public.date_votes
  for select to authenticated
  using (exists (select 1 from date_options o where o.id = option_id and public.can_see_spark(o.spark_id)));
create policy "vote for a date" on public.date_votes
  for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from date_options o where o.id = option_id and public.can_see_spark(o.spark_id)));
create policy "unvote a date" on public.date_votes
  for delete to authenticated using (user_id = auth.uid());

create policy "spot options follow the idea" on public.spot_options
  for select to authenticated using (public.can_see_spark(spark_id));
create policy "suggest a spot" on public.spot_options
  for insert to authenticated with check (created_by = auth.uid() and public.can_see_spark(spark_id));
create policy "take back your spot, or the lead removes it" on public.spot_options
  for delete to authenticated
  using (created_by = auth.uid() or exists (select 1 from sparks s where s.id = spark_id and s.lead_id = auth.uid()));
create policy "spot votes follow the idea" on public.spot_votes
  for select to authenticated
  using (exists (select 1 from spot_options o where o.id = option_id and public.can_see_spark(o.spark_id)));
create policy "vote for a spot" on public.spot_votes
  for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from spot_options o where o.id = option_id and public.can_see_spark(o.spark_id)));
create policy "unvote a spot" on public.spot_votes
  for delete to authenticated using (user_id = auth.uid());

revoke all on table public.date_options, public.date_votes, public.spot_options, public.spot_votes from anon;
grant select, insert, delete on table public.date_options, public.date_votes, public.spot_options, public.spot_votes to authenticated;

-- ---------------------------------------------------------------------------
-- Sign-ups (plans): things to bring or do. The lead adds items (optionally "how many");
-- anyone can add "something else" they're bringing, which signs them up for it.
-- ---------------------------------------------------------------------------
create table public.signup_items (
  id         uuid primary key default gen_random_uuid(),
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  item       text not null check (char_length(item) between 1 and 60),
  need       integer check (need between 1 and 999),
  created_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);
create table public.signup_claims (
  item_id    uuid not null references public.signup_items (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  note       text check (char_length(note) <= 60),
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);
alter table public.signup_items  enable row level security;
alter table public.signup_claims enable row level security;

create policy "sign-ups follow the idea" on public.signup_items
  for select to authenticated using (public.can_see_spark(spark_id));
create policy "add a sign-up" on public.signup_items
  for insert to authenticated
  with check (created_by = auth.uid() and public.can_see_spark(spark_id)
              and exists (select 1 from sparks s where s.id = spark_id
                           and (s.lead_id = auth.uid() or need is null)));
create policy "the lead or its author removes a sign-up" on public.signup_items
  for delete to authenticated
  using (created_by = auth.uid() or exists (select 1 from sparks s where s.id = spark_id and s.lead_id = auth.uid()));
create policy "claims follow the idea" on public.signup_claims
  for select to authenticated
  using (exists (select 1 from signup_items i where i.id = item_id and public.can_see_spark(i.spark_id)));
create policy "claim a sign-up" on public.signup_claims
  for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from signup_items i where i.id = item_id and public.can_see_spark(i.spark_id)));
create policy "edit your claim" on public.signup_claims
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "drop your claim" on public.signup_claims
  for delete to authenticated using (user_id = auth.uid());
revoke all on table public.signup_items, public.signup_claims from anon;
grant select, insert, delete on table public.signup_items, public.signup_claims to authenticated;
grant update (note) on table public.signup_claims to authenticated;

-- Full items can't take more claims (the lead's "how many")
create function public.check_signup_room() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_need integer; v_have integer;
begin
  select need into v_need from signup_items where id = new.item_id;
  if v_need is not null then
    select count(*) into v_have from signup_claims where item_id = new.item_id;
    if v_have >= v_need then raise exception 'that one''s covered' using errcode = '23514'; end if;
  end if;
  return new;
end $$;
create trigger signup_claims_room before insert on public.signup_claims
  for each row execute function public.check_signup_room();

-- ---------------------------------------------------------------------------
-- Updates from the host (shown on the plan; delivery comes with notifications)
-- ---------------------------------------------------------------------------
create table public.plan_updates (
  id         uuid primary key default gen_random_uuid(),
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 320),
  audience   text not null default 'all' check (audience in ('all', 'going', 'maybe', 'noreply')),
  created_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.plan_updates enable row level security;
create policy "updates follow the idea" on public.plan_updates
  for select to authenticated using (public.can_see_spark(spark_id));
create policy "the lead posts updates" on public.plan_updates
  for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from sparks s where s.id = spark_id and s.lead_id = auth.uid()));
create policy "the lead removes updates" on public.plan_updates
  for delete to authenticated using (created_by = auth.uid());
revoke all on table public.plan_updates from anon;
grant select, insert, delete on table public.plan_updates to authenticated;

-- ---------------------------------------------------------------------------
-- Organizers: people helping the lead get an idea over the line
-- ---------------------------------------------------------------------------
create table public.organizers (
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (spark_id, user_id)
);
alter table public.organizers enable row level security;
create policy "organizers follow the idea" on public.organizers
  for select to authenticated using (public.can_see_spark(spark_id));
create policy "offer to help organize" on public.organizers
  for insert to authenticated with check (user_id = auth.uid() and public.can_see_spark(spark_id));
create policy "stop helping" on public.organizers
  for delete to authenticated using (user_id = auth.uid());
revoke all on table public.organizers from anon;
grant select, insert, delete on table public.organizers to authenticated;

-- ---------------------------------------------------------------------------
-- The lead's private "before the day" checklist answers
-- ---------------------------------------------------------------------------
create table public.plan_prep (
  spark_id   uuid primary key references public.sparks (id) on delete cascade,
  answers    jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) < 4000),
  updated_at timestamptz not null default now()
);
alter table public.plan_prep enable row level security;
create policy "only the lead sees their prep" on public.plan_prep
  for select to authenticated using (exists (select 1 from sparks s where s.id = spark_id and s.lead_id = auth.uid()));
create policy "the lead writes their prep" on public.plan_prep
  for insert to authenticated with check (exists (select 1 from sparks s where s.id = spark_id and s.lead_id = auth.uid()));
create policy "the lead updates their prep" on public.plan_prep
  for update to authenticated using (exists (select 1 from sparks s where s.id = spark_id and s.lead_id = auth.uid()));
revoke all on table public.plan_prep from anon;
grant select, insert on table public.plan_prep to authenticated;
grant update (answers, updated_at) on table public.plan_prep to authenticated;

-- ---------------------------------------------------------------------------
-- The album (after it's happened): anyone who can see it adds their own photos
-- ---------------------------------------------------------------------------
create table public.album_photos (
  id         uuid primary key default gen_random_uuid(),
  spark_id   uuid not null references public.sparks (id) on delete cascade,
  path       text not null,
  created_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  constraint album_path_shape check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$')
);
alter table public.album_photos enable row level security;
create policy "the album follows the idea" on public.album_photos
  for select to authenticated using (public.can_see_spark(spark_id));
create policy "add your photo" on public.album_photos
  for insert to authenticated
  with check (created_by = auth.uid() and path ~ ('^' || auth.uid()::text || '/') and public.can_see_spark(spark_id));
create policy "remove your photo" on public.album_photos
  for delete to authenticated using (created_by = auth.uid());
revoke all on table public.album_photos from anon;
grant select, insert, delete on table public.album_photos to authenticated;

-- ---------------------------------------------------------------------------
-- Signing in moves a phone's anonymous activity (now including replies, votes, claims)
-- ---------------------------------------------------------------------------
create or replace function public.complete_merge(p_token uuid)
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
  update interests i set user_id = v_me
   where i.user_id = v_from
     and not exists (select 1 from interests x where x.spark_id = i.spark_id and x.user_id = v_me);
  delete from interests where user_id = v_from;
  update guest_contacts c set user_id = v_me
   where c.user_id = v_from
     and not exists (select 1 from guest_contacts x where x.spark_id = c.spark_id and x.user_id = v_me);
  delete from guest_contacts where user_id = v_from;
  update rsvps r set user_id = v_me
   where r.user_id = v_from and not exists (select 1 from rsvps x where x.spark_id = r.spark_id and x.user_id = v_me);
  delete from rsvps where user_id = v_from;
  update date_votes v set user_id = v_me
   where v.user_id = v_from and not exists (select 1 from date_votes x where x.option_id = v.option_id and x.user_id = v_me);
  delete from date_votes where user_id = v_from;
  update spot_votes v set user_id = v_me
   where v.user_id = v_from and not exists (select 1 from spot_votes x where x.option_id = v.option_id and x.user_id = v_me);
  delete from spot_votes where user_id = v_from;
  update signup_claims c set user_id = v_me
   where c.user_id = v_from and not exists (select 1 from signup_claims x where x.item_id = c.item_id and x.user_id = v_me);
  delete from signup_claims where user_id = v_from;
  update organizers o set user_id = v_me
   where o.user_id = v_from and not exists (select 1 from organizers x where x.spark_id = o.spark_id and x.user_id = v_me);
  delete from organizers where user_id = v_from;
  update date_options set created_by = v_me where created_by = v_from;
  update spot_options set created_by = v_me where created_by = v_from;
  update signup_items set created_by = v_me where created_by = v_from;
  update album_photos set created_by = v_me where created_by = v_from;
  insert into link_access (user_id, spark_id)
  select v_me, spark_id from link_access where user_id = v_from
  on conflict do nothing;
  delete from link_access where user_id = v_from;
  insert into profiles (id, name)
  select v_me, name from profiles where id = v_from and name is not null
  on conflict (id) do nothing;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Make it a plan / clear the date (the lead). Interested people become "going";
-- clearing the date turns "going" back into interested.
-- ---------------------------------------------------------------------------
create function public.make_plan(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from sparks where id = p_spark and lead_id = auth.uid()) then
    raise exception 'only the lead can make it a plan' using errcode = '42501';
  end if;
  update sparks set planned = true where id = p_spark;   -- the check constraint needs a day and a time
  insert into rsvps (spark_id, user_id, status)
  select spark_id, user_id, 'going' from interests where spark_id = p_spark
  on conflict (spark_id, user_id) do nothing;
end $$;

create function public.clear_plan(p_spark uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from sparks where id = p_spark and lead_id = auth.uid()) then
    raise exception 'only the lead can clear the date' using errcode = '42501';
  end if;
  insert into interests (spark_id, user_id)
  select spark_id, user_id from rsvps where spark_id = p_spark and status = 'going'
  on conflict do nothing;
  delete from rsvps where spark_id = p_spark;
  update sparks set planned = false, day_date = null, day_time = null, day = null where id = p_spark;
end $$;

revoke execute on function public.make_plan(uuid), public.clear_plan(uuid) from public, anon;
grant  execute on function public.make_plan(uuid), public.clear_plan(uuid) to authenticated;
