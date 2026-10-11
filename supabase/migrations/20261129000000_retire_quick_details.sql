-- Retire the old quick-detail lines (sparks.hopes) for good. Every event uses one description (sparks.vision) since
-- 20261128000000_one_description.sql moved every older event's lines into it; the app no longer reads or writes them.
-- The column stays (empty, and still in the client update grant) so an older app still open on someone's phone, which
-- sends hopes: [] when it posts an event or saves What to expect, keeps working.

-- 1. Anything an older app wrote since the move goes over the same way (each line trimmed, a full stop added when it
--    doesn't end in . ! or ?, one space between, a typed * escaped), ahead of the existing description
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
update public.sparks set hopes = '{}' where cardinality(hopes) > 0;

-- 2. No row can hold a line: an insert or update that sends any is refused (23514). The client update grant on the
--    column stays for now: the app before this one sends hopes: [] with every host's What to expect save, and an
--    installed app can stay open for days without reloading, so revoking it would break those saves (permission
--    denied for the whole update). Writing [] is harmless; revoke it (and drop the column) once old copies are gone
alter table public.sparks drop constraint if exists sparks_hopes_check;
alter table public.sparks add constraint sparks_hopes_check check (cardinality(hopes) = 0);

-- 3. admin_edit_spark ignores p_hopes. It keeps its place in the signature (now optional) so an older app's calls,
--    which always send it, still work; p_vision given (even '') is the description, null leaves it as it is
drop function if exists public.admin_edit_spark(uuid, text, text[], text, text);
create function public.admin_edit_spark(p_spark uuid, p_text text, p_hopes text[] default null, p_overview text default null, p_vision text default null)
returns void language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  select group_id into g from sparks where id = p_spark;
  if g is null or not public.is_admin(g) then
    raise exception 'only the group''s admins can edit this idea' using errcode = '42501';
  end if;
  update sparks set text = p_text,
    vision = case when p_vision is null then vision else nullif(left(btrim(p_vision), 1000), '') end,
    overview = case when p_overview is null then overview else nullif(btrim(p_overview), '') end
  where id = p_spark;
end $$;

revoke execute on function public.admin_edit_spark(uuid, text, text[], text, text) from public, anon;
grant  execute on function public.admin_edit_spark(uuid, text, text[], text, text) to authenticated;
