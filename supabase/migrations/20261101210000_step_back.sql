-- Step back as lead (owner, 2026-10-01: from the Led by card's Edit → Leads sheet). Only the lead, on an event that
-- isn't cancelled. With a co-lead, the earliest one becomes the lead and nothing else changes (they get a note).
-- Without one, it goes back to being an idea that's looking for a lead: the date and place stay, everyone going
-- becomes interested (the old lead too, like a floater) and gets a note, and anyone who can see it can take it on.
-- Returns 'handed' or 'idea'.
create or replace function public.step_back(p_spark uuid)
returns text language plpgsql security definer set search_path = public as $$
declare s record; v_new uuid; v_me text;
begin
  select id, text, lead_id, planned, cancelled_at into s from sparks where id = p_spark for update;
  if s.id is null or s.lead_id is distinct from auth.uid() then
    raise exception 'only the lead can step back' using errcode = '42501';
  end if;
  if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '22023'; end if;
  v_me := private.person_name(auth.uid(), p_spark);
  select user_id into v_new from cohosts where spark_id = p_spark order by created_at, user_id limit 1;
  if v_new is not null then
    delete from cohosts where spark_id = p_spark and user_id = v_new;
    update sparks set lead_id = v_new, lead_name = coalesce((select nullif(name, '') from profiles where id = v_new), 'Someone')
     where id = p_spark;
    insert into notes (user_id, body, created_by)
      values (v_new, left(v_me || ' stepped back, so you’re leading ' || left(s.text, 120) || ' now.', 320), auth.uid());
    return 'handed';
  end if;
  if s.planned then
    insert into notes (user_id, body, created_by)
      select r.user_id, left(left(s.text, 120) || ' is an idea again: ' || v_me || ' stepped back as lead. Anyone can take it on.', 320), auth.uid()
        from rsvps r where r.spark_id = p_spark and r.status = 'going' and r.user_id <> auth.uid();
    insert into interests (spark_id, user_id)
    select spark_id, user_id from rsvps where spark_id = p_spark and status = 'going'
    on conflict do nothing;
    delete from rsvps where spark_id = p_spark;
  end if;
  update sparks set planned = false, wants_host = true where id = p_spark;
  return 'idea';
end $$;
revoke execute on function public.step_back(uuid) from public, anon;
grant execute on function public.step_back(uuid) to authenticated;
