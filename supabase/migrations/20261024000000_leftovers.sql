-- Leftovers from the platform audit (owner, 2026-09-30)
--  1. Deleting an event tells everyone in it, not just people going: maybes and people signed up for a job too;
--     deleting an idea tells the people interested. Same note text as before.
--  2. The host can remove any photo from their event's album (the person who added one already could).

create or replace function public.delete_event(p_spark uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare s record; v_who text; n integer := 0;
begin
  select id, text, lead_id, group_id, planned into s from sparks where id = p_spark;
  if s.id is null then raise exception 'not found'; end if;
  if s.lead_id is distinct from auth.uid() and not public.is_admin(s.group_id) then
    raise exception 'not allowed';
  end if;
  select coalesce(nullif(p.name, ''), 'The lead') into v_who from profiles p where p.id = auth.uid();
  insert into notes (user_id, body, created_by)
    select u, left(left(s.text, 120) || ' is off. ' || coalesce(v_who, 'The lead') || ' took it down.', 320), auth.uid()
      from (select r.user_id as u from rsvps r where r.spark_id = p_spark and r.status in ('going', 'maybe')
            union select c.user_id from signup_claims c join signup_items i on i.id = c.item_id where i.spark_id = p_spark
            union select x.user_id from interests x where x.spark_id = p_spark and not s.planned) people
     where u <> auth.uid();
  get diagnostics n = row_count;
  delete from sparks where id = p_spark;
  return n;
end $$;

drop policy if exists "the lead removes album photos" on public.album_photos;
create policy "the lead removes album photos" on public.album_photos
  for delete to authenticated
  using (exists (select 1 from sparks s where s.id = album_photos.spark_id and s.lead_id = auth.uid()));
