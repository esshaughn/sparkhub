-- Private (invite-only) events preview too (owner, 2026-10-07): a shared link shows the photo and the title with the date,
-- but not the time or the place (those stay for people who can open it). Cancelled events still get the generic card.
create or replace function public.event_preview(p_code text)
returns table (title text, day_date date, day_time time, spot text, photo text, schedule jsonb)
language sql stable security definer set search_path = public as $$
  select s.text, s.day_date,
         case when s.visibility = 'group' then s.day_time end,
         case when s.visibility = 'group' then nullif(s.spot, '') end,
         coalesce((select p from unnest(s.photos) with ordinality u(p, n) where p ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' order by n limit 1),
                  (select p from unnest(s.mood) with ordinality u(p, n) where p ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' order by n limit 1),
                  (select g.photo from groups g where g.id = s.group_id
                      and (g.photo ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' or g.photo ~ '^photos/[a-z0-9-]+\.(jpg|png)$'))),
         case when s.visibility = 'group' or s.schedule is null then s.schedule
              when s.schedule->>'kind' = 'days' then jsonb_set(s.schedule, '{days}',
                coalesce((select jsonb_agg(jsonb_build_object('d', x->>'d')) from jsonb_array_elements(s.schedule->'days') x), '[]'::jsonb))
              else s.schedule - 'to_time' end   -- dates only: no times for a private event
    from sparks s
   where s.link_code = p_code and s.cancelled_at is null;
$$;
revoke all on function public.event_preview(text) from public;
grant execute on function public.event_preview(text) to anon, authenticated;
