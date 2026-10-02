-- View as a user (owner, 2026-10-01: "any type of user"): the owner can pick anyone who shares one of their groups,
-- not only people in a demo group (the groups stopped being demo groups), demo people (@example.com) included, so they
-- can see the app as a member, an admin or an owner. Still only for demo_admins, still look-only in the app.
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
     and exists (select 1 from memberships m
                  where m.user_id = u.id
                    and exists (select 1 from memberships mine where mine.user_id = auth.uid() and mine.group_id = m.group_id))
   order by 2;
$$;
