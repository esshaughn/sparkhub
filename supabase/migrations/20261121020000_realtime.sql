-- Realtime (owner, 2026-10-09): the app listens for changes instead of asking every 30 seconds. Realtime only tells the app
-- that something changed (it then reloads what it can see, through the same rules as always); row-level security still
-- decides which changes a person is sent. Tables the app loads are added to the publication; a missing table is skipped.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then return; end if;
  foreach t in array array['sparks', 'rsvps', 'event_comments', 'post_likes', 'plan_updates', 'signup_items', 'signup_claims', 'signup_waits',
                           'date_options', 'date_votes', 'spot_options', 'spot_votes', 'interests', 'offers', 'lead_asks', 'lead_offers',
                           'job_asks', 'cohosts', 'album_photos', 'reactions', 'event_invites', 'spark_groups', 'memberships'] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
