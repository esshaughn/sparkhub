-- Design round "Full Site 4": pinned groups, photo framing (group headers and
-- idea covers), and owners renaming or deleting a group.

-- ---------------------------------------------------------------------------
-- Home → Your groups: pinned first, then most recently opened (last_seen_at)
-- ---------------------------------------------------------------------------
alter table public.memberships add column pinned boolean not null default false;
revoke update on table public.memberships from authenticated;
grant  update (last_seen_at, pinned) on table public.memberships to authenticated;

-- ---------------------------------------------------------------------------
-- Photo framing: {x, y, zoom}, x/y 0–100 (%), zoom 1–2.5
-- ---------------------------------------------------------------------------
create function public.valid_photo_pos(p jsonb)
returns boolean language sql immutable as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and (select count(*) from jsonb_object_keys(p)) = 3
    and jsonb_typeof(p->'x') = 'number' and (p->>'x')::numeric between 0 and 100
    and jsonb_typeof(p->'y') = 'number' and (p->>'y')::numeric between 0 and 100
    and jsonb_typeof(p->'zoom') = 'number' and (p->>'zoom')::numeric between 1 and 2.5
  );
$$;

alter table public.groups add column photo_pos jsonb constraint groups_photo_pos_check check (public.valid_photo_pos(photo_pos));
alter table public.sparks add column cover_pos jsonb constraint sparks_cover_pos_check check (public.valid_photo_pos(cover_pos));
grant select (photo_pos) on table public.groups to authenticated;

-- The lead can reframe their cover directly (the policy already limits updates to the lead)
grant update (cover_pos) on table public.sparks to authenticated;

-- Group photo: an admin sets a new photo (their own upload) and/or its framing.
-- p_photo null keeps the current photo and only changes the framing.
drop function public.set_group_photo(uuid, text);
create function public.set_group_photo(p_group uuid, p_photo text, p_pos jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_group) then
    raise exception 'only the group''s admins can change its photo' using errcode = '42501';
  end if;
  if p_photo is not null and p_photo !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$') then
    raise exception 'photo must be your own upload' using errcode = '22023';
  end if;
  update groups set photo = coalesce(p_photo, photo), photo_pos = p_pos where id = p_group;
end $$;
revoke execute on function public.set_group_photo(uuid, text, jsonb) from public, anon;
grant  execute on function public.set_group_photo(uuid, text, jsonb) to authenticated;

-- Idea cover: the lead swaps the first photo (their own upload) and sets its framing.
-- Returns the replaced photo's path so the app can delete the old file.
create function public.set_idea_cover(p_spark uuid, p_photo text, p_pos jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not exists (select 1 from sparks where id = p_spark and lead_id = auth.uid()) then
    raise exception 'only the lead can change the cover' using errcode = '42501';
  end if;
  if p_photo !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$') then
    raise exception 'photo must be your own upload' using errcode = '22023';
  end if;
  select photos[1] into v_old from sparks where id = p_spark;
  update sparks
     set photos = case when cardinality(photos) = 0 then array[p_photo] else array[p_photo] || photos[2:] end,
         cover_pos = p_pos
   where id = p_spark;
  return v_old;
end $$;
revoke execute on function public.set_idea_cover(uuid, text, jsonb) from public, anon;
grant  execute on function public.set_idea_cover(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Owners rename and delete a group
-- ---------------------------------------------------------------------------
create function public.rename_group(p_group uuid, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text := left(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 40);
begin
  if not public.is_owner(p_group) then
    raise exception 'only the group''s owners can rename it' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 then raise exception 'a group needs a name' using errcode = '22023'; end if;
  update groups set name = v_name where id = p_group;
  return v_name;
end $$;

-- Deletes the group with its ideas and memberships (cascades). You can't delete
-- the only group you're in.
create function public.delete_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_group) then
    raise exception 'only the group''s owners can delete it' using errcode = '42501';
  end if;
  if (select count(*) from memberships where user_id = auth.uid()) < 2 then
    raise exception 'you need to be in at least one group' using errcode = '23514';
  end if;
  delete from groups where id = p_group;
end $$;

revoke execute on function public.rename_group(uuid, text) from public, anon;
revoke execute on function public.delete_group(uuid)       from public, anon;
grant  execute on function public.rename_group(uuid, text) to authenticated;
grant  execute on function public.delete_group(uuid)       to authenticated;
