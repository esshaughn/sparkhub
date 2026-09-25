-- Admins can replace their group's header photo. The photo must be one the
-- admin uploaded to their own folder ('<their uid>/<uuid>.jpg'); groups stay
-- non-updatable from the client, so this is the only way in.
create function public.set_group_photo(p_group uuid, p_photo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_group) then
    raise exception 'only the group''s admins can change its photo' using errcode = '42501';
  end if;
  if p_photo is null or p_photo !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$') then
    raise exception 'photo must be your own upload' using errcode = '22023';
  end if;
  update groups set photo = p_photo where id = p_group;
end $$;

revoke execute on function public.set_group_photo(uuid, text) from public, anon;
grant  execute on function public.set_group_photo(uuid, text) to authenticated;
