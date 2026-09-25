-- Group admins can edit (the idea and its basics) and delete any idea in their
-- group, not just their own. Edits go through a function so an admin can't
-- touch the lead's photos or anything else; deletes are a plain policy.

create policy "admins delete their group's ideas" on public.sparks
  for delete to authenticated using (public.is_admin(group_id));

create function public.admin_edit_spark(p_spark uuid, p_text text, p_hopes text[])
returns void language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  select group_id into g from sparks where id = p_spark;
  if g is null or not public.is_admin(g) then
    raise exception 'only the group''s admins can edit this idea' using errcode = '42501';
  end if;
  -- The table's own checks still apply (1–80 characters, up to 3 basics of ≤30)
  update sparks set text = p_text, hopes = coalesce(p_hopes, '{}') where id = p_spark;
end $$;

revoke execute on function public.admin_edit_spark(uuid, text, text[]) from public, anon;
grant  execute on function public.admin_edit_spark(uuid, text, text[]) to authenticated;
