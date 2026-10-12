-- Starting a group is a draft, a team and a review (owner, 2026-10-12). A group starts like an event: someone drafts
-- it (the place, what it's for, who can join, whether there's an association), recruits a co-lead (required), admins
-- and ambassadors who say yes in the app, agrees to what leading means, and sends it for review. The app owner (WAN)
-- reviews it, talks to them, and approves it, which opens the group with the team in their roles; or declines it.
-- Nobody else starts groups any more: create_group() is for the app owner (and the e2e test leads).
--   group_drafts: one draft per row; its starter edits it while it's a draft; status changes only through functions
--   group_draft_team: who's asked onto the team and their answer; written only through functions

create table public.group_drafts (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status          text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'declined')),
  name            text check (char_length(btrim(name)) between 2 and 40),
  place_name      text check (char_length(btrim(place_name)) between 1 and 60),
  place_kind      text check (place_kind in ('neighborhood', 'school', 'building', 'park', 'other')),
  place_lat       double precision check (place_lat between -90 and 90),
  place_lon       double precision check (place_lon between -180 and 180),
  place_radius_m  integer check (place_radius_m between 50 and 50000),
  purpose         text check (char_length(btrim(purpose)) between 1 and 200),
  join_rule       text not null default 'everyone' check (join_rule in ('everyone', 'nearby', 'neighbors')),
  association     text check (association in ('none', 'member', 'not_member', 'hoa', 'unsure')),
  association_name text check (char_length(association_name) <= 80),
  why             text check (char_length(why) <= 1000),
  spread          text check (char_length(spread) <= 1000),
  agreed_at       timestamptz,
  submitted_at    timestamptz,
  reviewed_at     timestamptz,
  review_note     text check (char_length(review_note) <= 500),
  group_id        uuid references public.groups (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint group_drafts_pin_whole check ((place_lat is null) = (place_lon is null))
);
create index group_drafts_by on public.group_drafts (created_by);

create table public.group_draft_team (
  draft_id    uuid not null references public.group_drafts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('colead', 'admin', 'ambassador')),
  status      text not null default 'invited' check (status in ('invited', 'accepted', 'declined')),
  invited_at  timestamptz not null default now(),
  answered_at timestamptz,
  primary key (draft_id, user_id)
);
create index group_draft_team_user on public.group_draft_team (user_id);

create or replace function private.draft_on_team(p_draft uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_draft_team t where t.draft_id = p_draft and t.user_id = p_user);
$$;
-- Who reads a draft and its team: its starter, anyone asked onto the team, and the app owner
create or replace function public.draft_visible(p_draft uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_drafts d where d.id = p_draft and d.created_by = auth.uid())
      or private.draft_on_team(p_draft, auth.uid()) or private.is_app_owner();
$$;
revoke all on function public.draft_visible(uuid) from public, anon;
grant execute on function public.draft_visible(uuid) to authenticated;

alter table public.group_drafts enable row level security;
alter table public.group_draft_team enable row level security;
revoke all on public.group_drafts, public.group_draft_team from anon, authenticated;
grant select, delete on public.group_drafts to authenticated;
grant insert (name, place_name, place_kind, place_lat, place_lon, place_radius_m, purpose, join_rule, association, association_name, why, spread, agreed_at)
  on public.group_drafts to authenticated;
grant update (name, place_name, place_kind, place_lat, place_lon, place_radius_m, purpose, join_rule, association, association_name, why, spread, agreed_at)
  on public.group_drafts to authenticated;
grant select on public.group_draft_team to authenticated;

-- The starter, the people asked onto its team, and the app owner read a draft
create policy "your drafts and the ones you're asked onto" on public.group_drafts for select to authenticated
  using (created_by = auth.uid() or public.draft_visible(id));
create policy "start a draft" on public.group_drafts for insert to authenticated
  with check (created_by = auth.uid() and public.is_signed_in());
create policy "edit your draft" on public.group_drafts for update to authenticated
  using (created_by = auth.uid() and status = 'draft') with check (created_by = auth.uid() and status = 'draft');
create policy "delete your draft" on public.group_drafts for delete to authenticated
  using (created_by = auth.uid() and status in ('draft', 'declined'));
create policy "a draft's team" on public.group_draft_team for select to authenticated
  using (public.draft_visible(draft_id));

-- Saving: three open drafts each; agreeing stamps the time (the app sends any time; it's set to now)
create or replace function private.group_drafts_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (select count(*) from group_drafts where created_by = new.created_by and status in ('draft', 'submitted')) >= 3 then
    raise exception 'up to 3 drafts at a time' using errcode = '23514';
  end if;
  if new.agreed_at is not null and (tg_op = 'INSERT' or old.agreed_at is null) then new.agreed_at := now(); end if;
  new.name := nullif(btrim(regexp_replace(coalesce(new.name, ''), '\s+', ' ', 'g')), '');
  new.place_name := nullif(btrim(coalesce(new.place_name, '')), '');
  new.purpose := nullif(btrim(coalesce(new.purpose, '')), '');
  new.association_name := nullif(btrim(coalesce(new.association_name, '')), '');
  new.updated_at := now();
  return new;
end $$;
create trigger group_drafts_guard before insert or update on public.group_drafts
  for each row execute function private.group_drafts_guard();

-- Ask someone onto the team (the starter, while it's a draft): an account that's a friend or shares a group, not
-- blocked either way. One co-lead or two, up to 5 admins and 10 ambassadors. Asking again changes the role.
create or replace function public.draft_invite(p_draft uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare d group_drafts; v_name text; v_new boolean;
begin
  select * into d from group_drafts where id = p_draft;
  if d.id is null or d.created_by <> auth.uid() then raise exception 'not your draft' using errcode = '42501'; end if;
  if d.status <> 'draft' then raise exception 'take it back from review to change the team' using errcode = '23514'; end if;
  if p_role is null or p_role not in ('colead', 'admin', 'ambassador') then raise exception 'pick a role' using errcode = '22023'; end if;
  if p_user is null or p_user = auth.uid() then raise exception 'ask someone else' using errcode = '22023'; end if;
  if not exists (select 1 from auth.users a where a.id = p_user and not coalesce(a.is_anonymous, false))
     or not (public.is_friend(p_user) or public.shares_group(p_user))
     or exists (select 1 from user_blocks b where (b.blocker = auth.uid() and b.blocked = p_user) or (b.blocker = p_user and b.blocked = auth.uid())) then
    raise exception 'you can ask friends and people in your groups' using errcode = '22023';
  end if;
  if (select count(*) from group_draft_team where draft_id = p_draft and role = p_role and user_id <> p_user and status <> 'declined')
     >= (case p_role when 'colead' then 2 when 'admin' then 5 else 10 end) then
    raise exception 'that''s as many as a team takes in that role' using errcode = '23514';
  end if;
  if not private.rate_ok(auth.uid(), 'draft_invite', 30, interval '1 hour') and not exists (select 1 from private.rate_exempt where user_id = auth.uid()) then
    raise exception 'You''re going a bit fast. Try again in a little while.' using errcode = 'PT429';
  end if;
  v_new := not exists (select 1 from group_draft_team where draft_id = p_draft and user_id = p_user and status <> 'declined');
  insert into group_draft_team (draft_id, user_id, role) values (p_draft, p_user, p_role)
    on conflict (draft_id, user_id) do update set role = excluded.role,
      status = case when group_draft_team.status = 'declined' then 'invited' else group_draft_team.status end,
      invited_at = case when group_draft_team.status = 'declined' then now() else group_draft_team.invited_at end,
      answered_at = case when group_draft_team.status = 'declined' then null else group_draft_team.answered_at end;
  if v_new then
    v_name := private.person_name(auth.uid(), null::uuid);
    insert into notes (user_id, body, created_by, quiet)
      values (p_user, left(v_name || ' asked you to be ' || case p_role when 'colead' then 'co-lead' when 'admin' then 'an admin' else 'an ambassador' end ||
                           ' of ' || coalesce(d.name, 'a new group') || '. Take a look.', 320), auth.uid(), true);
    perform private.push_send(array[p_user], 'friends', v_name || ' asked you onto a new group’s team',
      coalesce(d.name, 'A new group') || ': ' || case p_role when 'colead' then 'co-lead' when 'admin' then 'admin' else 'ambassador' end || '. Tap to see it.',
      '/#/request/' || p_draft, 'gd:' || p_draft);
  end if;
end $$;

create or replace function public.draft_uninvite(p_draft uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from group_drafts where id = p_draft and created_by = auth.uid() and status = 'draft') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from group_draft_team where draft_id = p_draft and user_id = p_user;
end $$;

-- The person asked says yes or not now; the starter hears either way
create or replace function public.answer_draft_invite(p_draft uuid, p_yes boolean)
returns void language plpgsql security definer set search_path = public as $$
declare d group_drafts; t group_draft_team; v_name text;
begin
  select * into t from group_draft_team where draft_id = p_draft and user_id = auth.uid();
  if t.draft_id is null then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into d from group_drafts where id = p_draft;
  if d.status not in ('draft', 'submitted') then raise exception 'this draft is closed' using errcode = '23514'; end if;
  update group_draft_team set status = case when p_yes then 'accepted' else 'declined' end, answered_at = now()
   where draft_id = p_draft and user_id = auth.uid();
  v_name := private.person_name(auth.uid(), null::uuid);
  insert into notes (user_id, body, created_by, quiet)
    values (d.created_by, left(v_name || case when p_yes then ' is in for ' else ' can’t join the team for ' end || coalesce(d.name, 'your new group') || '.', 320), auth.uid(), true);
  perform private.push_send(array[d.created_by], 'friends', v_name || case when p_yes then ' is on your team' else ' can’t join your team' end,
    coalesce(d.name, 'Your new group'), '/#/request/' || p_draft, 'gda:' || p_draft || ':' || auth.uid());
end $$;

-- Send for review: a name, a place, a purpose, the association question, the agreement and an accepted co-lead
create or replace function public.submit_group_draft(p_draft uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d group_drafts; v_owners uuid[];
begin
  select * into d from group_drafts where id = p_draft for update;
  if d.id is null or d.created_by <> auth.uid() then raise exception 'not your draft' using errcode = '42501'; end if;
  if d.status <> 'draft' then raise exception 'it''s already sent' using errcode = '23514'; end if;
  if d.name is null or d.place_name is null or d.purpose is null or d.association is null or d.agreed_at is null then
    raise exception 'fill in the group, the place, what it''s for, the association and the agreement first' using errcode = '23514';
  end if;
  if not exists (select 1 from group_draft_team where draft_id = p_draft and role = 'colead' and status = 'accepted') then
    raise exception 'a group needs a co-lead who has said yes' using errcode = '23514';
  end if;
  update group_drafts set status = 'submitted', submitted_at = now(), review_note = null where id = p_draft;
  select array_agg(user_id) into v_owners from demo_admins;
  insert into notes (user_id, body, created_by, quiet)
    select u, left('New group request: ' || d.name || ' (' || d.place_name || ').', 320), auth.uid(), true from unnest(coalesce(v_owners, '{}')) u;
  perform private.push_send(coalesce(v_owners, '{}'), 'hosting', 'New group request: ' || d.name, d.place_name || '. Tap to review.', '/#/request/' || p_draft, 'gdr:' || p_draft);
end $$;

-- Take it back from review to change it, or reopen a declined one to try again
create or replace function public.withdraw_group_draft(p_draft uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update group_drafts set status = 'draft', submitted_at = null where id = p_draft and created_by = auth.uid() and status in ('submitted', 'declined');
  if not found then raise exception 'not allowed' using errcode = '42501'; end if;
end $$;

-- The app owner's review
create or replace function public.approve_group_draft(p_draft uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare d group_drafts; v_id uuid; v_code text; v_team uuid[];
begin
  if not private.is_app_owner() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into d from group_drafts where id = p_draft for update;
  if d.id is null or d.status <> 'submitted' then raise exception 'only a draft sent for review can be approved' using errcode = '23514'; end if;
  if private.reserved_group_name(d.name, null) then raise exception 'that name is taken, change it first' using errcode = '23505'; end if;
  v_code := public.new_group_code();
  insert into groups (name, code, created_by, place_name, place_kind, place_lat, place_lon, place_radius_m, purpose, join_rule)
    values (d.name, v_code, d.created_by, d.place_name, d.place_kind, d.place_lat, d.place_lon, d.place_radius_m, d.purpose, d.join_rule)
    returning id into v_id;
  insert into memberships (group_id, user_id, role, connection) values (v_id, d.created_by, 'owner', null);
  insert into memberships (group_id, user_id, role)
    select v_id, t.user_id, case t.role when 'colead' then 'owner' when 'admin' then 'admin' else 'member' end
      from group_draft_team t where t.draft_id = p_draft and t.status = 'accepted'
    on conflict (group_id, user_id) do nothing;
  update group_drafts set status = 'approved', reviewed_at = now(), review_note = nullif(btrim(coalesce(p_note, '')), ''), group_id = v_id where id = p_draft;
  select array_agg(t.user_id) into v_team from group_draft_team t where t.draft_id = p_draft and t.status = 'accepted';
  insert into notes (user_id, body, created_by, quiet)
    select u, left(d.name || ' is open. Share its link to invite your neighbors.', 320), auth.uid(), true
      from unnest(array[d.created_by] || coalesce(v_team, '{}')) u;
  perform private.push_send(array[d.created_by] || coalesce(v_team, '{}'), 'hosting', d.name || ' is open', 'Share its link to invite your neighbors.', '/#/group/' || v_id, 'gdo:' || p_draft);
  return v_id;
end $$;

create or replace function public.decline_group_draft(p_draft uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare d group_drafts;
begin
  if not private.is_app_owner() then raise exception 'not allowed' using errcode = '42501'; end if;
  update group_drafts set status = 'declined', reviewed_at = now(), review_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_draft and status = 'submitted' returning * into d;
  if d.id is null then raise exception 'only a draft sent for review can be declined' using errcode = '23514'; end if;
  insert into notes (user_id, body, created_by, quiet)
    values (d.created_by, left('Your request for ' || d.name || ' wasn’t approved.' || coalesce(' “' || d.review_note || '”', ''), 320), auth.uid(), true);
  perform private.push_send(array[d.created_by], 'hosting', 'About your request for ' || d.name, coalesce(d.review_note, 'Tap to read more.'), '/#/request/' || p_draft, 'gdd:' || p_draft);
end $$;

revoke all on function public.draft_invite(uuid, uuid, text), public.draft_uninvite(uuid, uuid), public.answer_draft_invite(uuid, boolean),
  public.submit_group_draft(uuid), public.withdraw_group_draft(uuid), public.approve_group_draft(uuid, text), public.decline_group_draft(uuid, text) from public, anon;
grant execute on function public.draft_invite(uuid, uuid, text), public.draft_uninvite(uuid, uuid), public.answer_draft_invite(uuid, boolean),
  public.submit_group_draft(uuid), public.withdraw_group_draft(uuid), public.approve_group_draft(uuid, text), public.decline_group_draft(uuid, text) to authenticated;

-- Groups start by request now: create_group() is for the app owner, and for the e2e test leads (rate_exempt)
create or replace function public.create_group(p_name text)
returns table (id uuid, code text) language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text; v_name text := left(trim(regexp_replace(p_name, '\s+', ' ', 'g')), 40);
begin
  if not public.is_signed_in() then raise exception 'sign in to start a group'; end if;
  if not (private.is_app_owner() or exists (select 1 from private.rate_exempt where user_id = auth.uid())) then
    raise exception 'groups start by request' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 then raise exception 'a group needs a name'; end if;
  if private.reserved_group_name(v_name, null) then
    raise exception 'that name is taken, try another' using errcode = '23505';
  end if;
  if (select count(*) from groups g where g.created_by = auth.uid() and g.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'that''s a lot of new groups at once. Try again in a bit';
  end if;
  v_code := public.new_group_code();
  insert into groups (name, code, created_by) values (v_name, v_code, auth.uid()) returning groups.id into v_id;
  insert into memberships (group_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return query select v_id, v_code;
end $$;
