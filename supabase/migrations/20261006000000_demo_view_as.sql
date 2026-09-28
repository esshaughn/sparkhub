-- "View as a tester" (owner, 2026-09-28): the demo admin can preview the app the way a tester sees it.
-- The app stays signed in as the admin and sends no writes while previewing; this only tells it who the
-- testers are and their roles in the groups the admin shares with them. Everyone else gets no rows.

create or replace function public.demo_testers()
returns table (user_id uuid, name text, email text, memberships jsonb)
language sql stable security definer set search_path = public as $$
  select u.id,
         coalesce(nullif(p.name, ''), nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(u.email, '@', 1)),
         u.email::text,
         coalesce((select jsonb_agg(jsonb_build_object('group_id', m.group_id, 'role', m.role, 'pinned', m.pinned, 'last_seen_at', m.last_seen_at))
                     from memberships m
                    where m.user_id = u.id
                      and exists (select 1 from memberships mine where mine.user_id = auth.uid() and mine.group_id = m.group_id)), '[]'::jsonb)
    from auth.users u
    left join profiles p on p.id = u.id
   where exists (select 1 from demo_admins a where a.user_id = auth.uid())
     and u.id <> auth.uid()
     and u.email is not null and coalesce(u.is_anonymous, false) = false
     and u.email not like '%@example.com'
     and exists (select 1 from memberships m join groups g on g.id = m.group_id
                  where m.user_id = u.id and g.demo
                    and exists (select 1 from memberships mine where mine.user_id = auth.uid() and mine.group_id = g.id))
   order by 2;
$$;

revoke execute on function public.demo_testers() from public, anon;
grant  execute on function public.demo_testers() to authenticated;
