-- Leads sign in with email (owner decision, 2026-09-24). Anyone can still browse,
-- say they're interested, offer a spot or date, and RSVP from an anonymous
-- session, but posting an idea (and so becoming its lead) needs a real account.
--
-- is_anonymous comes from the JWT; a missing claim counts as anonymous.

drop policy "post a spark as yourself" on public.sparks;
create policy "post a spark as yourself" on public.sparks
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and lead_id = auth.uid()
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
    and public.all_match(photos, '^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$')
  );
