-- One description for every event (owner, 2026-10-11). Since v8-14 a host edits an event's description as one box
-- (sparks.vision, light Markdown); older events still kept up to three quick-detail lines in sparks.hopes, which a
-- group admin edited as three fields and the page showed as bullets.

-- 1. Admins edit the description too: admin_edit_spark takes p_vision. Given (even ''), it becomes the description
--    and the old lines are cleared, as the host's save does; null leaves both as they are (the older calls).
drop function if exists public.admin_edit_spark(uuid, text, text[], text);
create function public.admin_edit_spark(p_spark uuid, p_text text, p_hopes text[], p_overview text default null, p_vision text default null)
returns void language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  select group_id into g from sparks where id = p_spark;
  if g is null or not public.is_admin(g) then
    raise exception 'only the group''s admins can edit this idea' using errcode = '42501';
  end if;
  update sparks set text = p_text,
    hopes = case when p_vision is null then coalesce(p_hopes, '{}') else '{}' end,
    vision = case when p_vision is null then vision else nullif(left(btrim(p_vision), 1000), '') end,
    overview = case when p_overview is null then overview else nullif(btrim(p_overview), '') end
  where id = p_spark;
end $$;

revoke execute on function public.admin_edit_spark(uuid, text, text[], text, text) from public, anon;
grant  execute on function public.admin_edit_spark(uuid, text, text[], text, text) to authenticated;

-- 2. Every older event's lines become its description, joined the way the app's editor joins them (descDraft):
--    each line trimmed, a full stop added when it doesn't end in . ! or ?, then one space between. A typed * is
--    escaped (\*) so it isn't read as Markdown. A description already in vision beside the lines was never shown
--    (the lines win), so it follows the lines after a blank line rather than being dropped.
update public.sparks s set
  vision = left(j.joined || case when coalesce(btrim(s.vision), '') <> '' then E'\n\n' || btrim(s.vision) else '' end, 1000),
  hopes = '{}'
from (
  select id, string_agg(case when l ~ '[.!?]$' then l else l || '.' end, ' ' order by n) as joined
  from public.sparks, unnest(hopes) with ordinality as h(raw, n), lateral (select replace(btrim(raw), '*', '\*') as l) x
  where cardinality(hopes) > 0 and btrim(raw) <> ''
  group by id
) j
where s.id = j.id;

-- Lines that were all blank
update public.sparks set hopes = '{}' where cardinality(hopes) > 0;
