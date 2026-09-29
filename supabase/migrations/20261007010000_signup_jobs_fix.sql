-- Fix for 20261007000000_signup_jobs.sql: inside the subquery on signup_items j, a bare shift_of
-- meant j.shift_of, so no shift could ever be added. Name the new row's column explicitly.
drop policy "add a sign-up" on public.signup_items;
create policy "add a sign-up" on public.signup_items
  for insert to authenticated
  with check (created_by = auth.uid() and public.can_see_spark(spark_id)
              and exists (select 1 from sparks s where s.id = spark_id
                           and (s.lead_id = auth.uid()
                                or (signup_items.need is null and signup_items.time is null and signup_items.end_time is null
                                    and signup_items.descr is null and signup_items.shift_of is null)))
              and (signup_items.shift_of is null
                   or exists (select 1 from signup_items j where j.id = signup_items.shift_of
                               and j.spark_id = signup_items.spark_id and j.shift_of is null)));
