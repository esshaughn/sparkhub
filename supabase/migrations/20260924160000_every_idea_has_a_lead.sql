-- Every idea has a lead (owner decision, 2026-09-24). An idea can't be posted
-- without one, and there's no way to leave one leaderless. "Needs a lead",
-- "take the lead" and "step back" may come back later as a new migration.
--
-- lead_id stays nullable on purpose: if a lead's account is ever deleted, the
-- idea keeps its content rather than vanishing (the app shows "The lead").

drop policy "post a spark as yourself" on public.sparks;
create policy "post a spark as yourself" on public.sparks
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and lead_id = auth.uid()
    and public.all_match(photos, '^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$')
  );

drop function public.claim_lead(uuid, text);
drop function public.step_back(uuid);
