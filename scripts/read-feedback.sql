-- Read what people sent from the Profile sheet's Send feedback (newest first). Read-only.
--   Live: supabase db query --linked --project-ref xwrzfpgsazyrgieymtee -f scripts/read-feedback.sql -o table
--   Test: supabase db query --linked -f scripts/read-feedback.sql -o table
select created_at::timestamp(0) as sent, name, screen, body
  from public.feedback
 where body not like '[E2E]%'
 order by created_at desc limit 50;
