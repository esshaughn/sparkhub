-- Cancel vs delete (owner, 2026-09-30): "Cancel" tells everyone in the event that it's off (with the host's reason,
-- if they gave one); "Delete" takes it down quietly. Both remove it. One function, two optional arguments, so the
-- old one-argument call (delete_event(p_spark)) still cancels with a note, as before.

drop function if exists public.delete_event(uuid);
create or replace function public.delete_event(p_spark uuid, p_quiet boolean default false, p_reason text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare s record; v_who text; v_body text; n integer := 0;
begin
  select id, text, lead_id, group_id, planned into s from sparks where id = p_spark;
  if s.id is null then raise exception 'not found'; end if;
  if s.lead_id is distinct from auth.uid() and not public.is_admin(s.group_id) then
    raise exception 'not allowed';
  end if;
  if not coalesce(p_quiet, false) then
    select coalesce(nullif(split_part(trim(p.name), ' ', 1), ''), 'The host') into v_who from profiles p where p.id = auth.uid();
    v_body := left(s.text, 120) || ' is cancelled. ' ||
      case when nullif(btrim(p_reason), '') is null then coalesce(v_who, 'The host') || ' called it off.'
           else coalesce(v_who, 'The host') || ': “' || left(btrim(p_reason), 160) || '”' end;
    insert into notes (user_id, body, created_by)
      select u, left(v_body, 320), auth.uid()
        from (select r.user_id as u from rsvps r where r.spark_id = p_spark and r.status in ('going', 'maybe')
              union select c.user_id from signup_claims c join signup_items i on i.id = c.item_id where i.spark_id = p_spark
              union select x.user_id from interests x where x.spark_id = p_spark and not s.planned) people
       where u <> auth.uid();
    get diagnostics n = row_count;
  end if;
  delete from sparks where id = p_spark;
  return n;
end $$;
revoke all on function public.delete_event(uuid, boolean, text) from public, anon;
grant execute on function public.delete_event(uuid, boolean, text) to authenticated;
