-- "New accounts" list on the owner's Profile sheet (owner, 2026-09-30): everyone who has created an account,
-- newest first, so the owner can scroll back through who joined. Same definition as the new-account push
-- (20261020000000_new_account_push.sql): a confirmed email that isn't anonymous, never @example.com.
-- Only demo_admins get rows; everyone else gets none.

create or replace function public.new_accounts()
returns table (user_id uuid, name text, email text, avatar_path text, joined_at timestamptz, method text, groups jsonb)
language sql stable security definer set search_path = public as $$
  select u.id,
         left(coalesce(nullif(p.name, ''), nullif(u.raw_user_meta_data ->> 'display_name', ''), nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)), 40),
         u.email::text,
         p.avatar_path,
         coalesce(u.email_confirmed_at, u.created_at),
         case when exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google') then 'google' else 'email' end,
         coalesce((select jsonb_agg(jsonb_build_object('name', g.name, 'demo', coalesce(g.demo, false)) order by g.name)
                     from memberships m join groups g on g.id = m.group_id
                    where m.user_id = u.id), '[]'::jsonb)
    from auth.users u
    left join profiles p on p.id = u.id
   where exists (select 1 from demo_admins a where a.user_id = auth.uid())
     and u.email is not null and u.email_confirmed_at is not null
     and not coalesce(u.is_anonymous, false)
     and u.email not ilike '%@example.com'
   order by coalesce(u.email_confirmed_at, u.created_at) desc
   limit 1000;
$$;

revoke execute on function public.new_accounts() from public, anon;
grant  execute on function public.new_accounts() to authenticated;
