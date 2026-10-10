-- Design v8-17 clarity pass (3a), Your role: "Hand it to {co-lead}", one tap. The lead hands the lead to one of their
-- co-leads and becomes a co-lead themselves; the new lead gets a note. (Handing it to someone who isn't a co-lead
-- stays an ask they answer, offer_lead.)
create or replace function public.hand_to_colead(p_spark uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_me text;
begin
  select id, text, lead_id, cancelled_at into s from sparks where id = p_spark for update;
  if s.id is null or s.lead_id is distinct from auth.uid() then
    raise exception 'only the lead can hand it on' using errcode = '42501';
  end if;
  if s.cancelled_at is not null then raise exception 'this event was cancelled' using errcode = '22023'; end if;
  if not exists (select 1 from cohosts where spark_id = p_spark and user_id = p_user) then
    raise exception 'hand it to one of your co-leads' using errcode = '22023';
  end if;
  v_me := private.person_name(auth.uid(), p_spark);
  delete from cohosts where spark_id = p_spark and user_id = p_user;
  insert into cohosts (spark_id, user_id, added_by) values (p_spark, auth.uid(), auth.uid()) on conflict (spark_id, user_id) do nothing;
  update sparks set lead_id = p_user, lead_name = coalesce((select nullif(name, '') from profiles where id = p_user), 'Someone') where id = p_spark;
  insert into notes (user_id, body, created_by)
    values (p_user, left(v_me || ' handed ' || left(s.text, 120) || ' to you. You’re leading it now, and ' || v_me || ' is a co-lead.', 320), auth.uid());
end $$;
revoke execute on function public.hand_to_colead(uuid, uuid) from public, anon;
grant execute on function public.hand_to_colead(uuid, uuid) to authenticated;
