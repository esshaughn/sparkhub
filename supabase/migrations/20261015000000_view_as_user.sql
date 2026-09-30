-- "View as a user" (owner, 2026-09-30; was "View as a tester"): the demo admin can preview the app as anyone
-- with an account, not only people sharing a demo group. Real accounts only (signed in with Google or an email
-- code; not anonymous, not the @example.com demo and test people). Memberships are still limited to groups the
-- admin is in, since the preview reads with the admin's own access. Everyone else still gets no rows.
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
   order by 2;
$$;
