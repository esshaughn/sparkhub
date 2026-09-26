-- V5 update: a sign-up item can have a time ("Set up barriers · 8:30am"), set by the host.

alter table public.signup_items add column time time;

-- Only the lead sets "how many" or a time; anyone else adds a plain "something else"
drop policy "add a sign-up" on public.signup_items;
create policy "add a sign-up" on public.signup_items
  for insert to authenticated
  with check (created_by = auth.uid() and public.can_see_spark(spark_id)
              and exists (select 1 from sparks s where s.id = spark_id
                           and (s.lead_id = auth.uid() or (need is null and time is null))));
