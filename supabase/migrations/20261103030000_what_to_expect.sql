-- What to expect (Design 8a, HANDOFF-to-CODE after Update 16): an optional one-line overview above an event's
-- up-to-three details (sparks.hopes). Up to 80 characters; empty is stored as null.

alter table public.sparks
  add column if not exists overview text;

alter table public.sparks drop constraint if exists sparks_overview_check;
alter table public.sparks add constraint sparks_overview_check
  check (overview is null or (char_length(overview) between 1 and 80));

-- The lead (and co-leads, through the update policy's is_host) edit it like the details
grant update (overview) on table public.sparks to authenticated;

-- Group admins edit an idea's title and details through admin_edit_spark; it now takes the overview too.
-- p_overview null leaves it as it is (the old three-argument call); '' clears it.
drop function if exists public.admin_edit_spark(uuid, text, text[]);
create function public.admin_edit_spark(p_spark uuid, p_text text, p_hopes text[], p_overview text default null)
returns void language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  select group_id into g from sparks where id = p_spark;
  if g is null or not public.is_admin(g) then
    raise exception 'only the group''s admins can edit this idea' using errcode = '42501';
  end if;
  update sparks set text = p_text, hopes = coalesce(p_hopes, '{}'),
    overview = case when p_overview is null then overview else nullif(btrim(p_overview), '') end
  where id = p_spark;
end $$;

revoke execute on function public.admin_edit_spark(uuid, text, text[], text) from public, anon;
grant  execute on function public.admin_edit_spark(uuid, text, text[], text) to authenticated;
