-- Link previews: the title, photo and one line a chat app (iMessage, WhatsApp…) shows for a shared
-- link. api/preview.js reads these with the publishable key before anyone opens the link, so they
-- return only what's safe to show to whoever holds the link: an idea's title, when and where, one
-- photo and its group's name; a group's name and photo for its invite code. Invite-only plans
-- return nothing (the preview stays generic).

create or replace function public.link_preview(p_spark uuid)
returns table (title text, planned boolean, day_date date, day_time time, spot text, photo text, group_name text)
language sql stable security definer set search_path = public as $$
  select s.text, s.planned, s.day_date, s.day_time, nullif(s.spot, ''),
         coalesce((select p from unnest(s.photos) p where p ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' limit 1), g.photo),
         g.name
    from sparks s join groups g on g.id = s.group_id
   where s.id = p_spark and s.visibility = 'group';
$$;

create or replace function public.group_preview(p_code text)
returns table (name text, photo text)
language sql stable security definer set search_path = public as $$
  select g.name, g.photo from groups g where g.code = upper(p_code) and char_length(p_code) = 6;
$$;

revoke execute on function public.link_preview(uuid) from public;
revoke execute on function public.group_preview(text) from public;
grant execute on function public.link_preview(uuid) to anon, authenticated;
grant execute on function public.group_preview(text) to anon, authenticated;
