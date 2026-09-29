-- v6 Update 5: sign-up jobs get a description ("what's involved"), an end time ("5:00 – 6:00pm")
-- and shifts. A shift is its own signup_items row pointing at its job (shift_of); people claim
-- shifts, never the job row itself, so the room trigger and claims work per shift unchanged.

alter table public.signup_items
  add column descr    text check (char_length(descr) <= 400),
  add column end_time time,
  add column shift_of uuid references public.signup_items (id) on delete cascade;
create index signup_items_shift_of on public.signup_items (shift_of) where shift_of is not null;

-- Only the lead sets how many, times, a description or shifts; anyone else adds a plain
-- "something else". A shift belongs to a job on the same event, one level deep.
drop policy "add a sign-up" on public.signup_items;
create policy "add a sign-up" on public.signup_items
  for insert to authenticated
  with check (created_by = auth.uid() and public.can_see_spark(spark_id)
              and exists (select 1 from sparks s where s.id = spark_id
                           and (s.lead_id = auth.uid()
                                or (need is null and time is null and end_time is null and descr is null and shift_of is null)))
              and (shift_of is null or exists (select 1 from signup_items j where j.id = shift_of
                                                and j.spark_id = signup_items.spark_id and j.shift_of is null)));

-- Full items can't take more claims; a job split into shifts takes none itself (the insert is skipped,
-- so older helpers like demo_participate() that pick "need is null" rows just move on)
create or replace function public.check_signup_room() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_need integer; v_have integer;
begin
  if exists (select 1 from signup_items where shift_of = new.item_id) then return null; end if;
  select need into v_need from signup_items where id = new.item_id;
  if v_need is not null then
    select count(*) into v_have from signup_claims where item_id = new.item_id;
    if v_have >= v_need then raise exception 'that one''s covered' using errcode = '23514'; end if;
  end if;
  return new;
end $$;
