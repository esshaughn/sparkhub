-- Friend links: say up front when the link is your own ("That's your link"), instead of after Add friend
drop function public.friend_link_preview(text);
create function public.friend_link_preview(p_code text)
returns table (name text, avatar_path text, is_you boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(p.name, ''), 'Someone'), p.avatar_path, c.user_id = auth.uid()
    from friend_codes c left join profiles p on p.id = c.user_id
   where c.code = upper(p_code) and char_length(p_code) = 6;
$$;
revoke execute on function public.friend_link_preview(text) from public;
grant execute on function public.friend_link_preview(text) to anon, authenticated;
