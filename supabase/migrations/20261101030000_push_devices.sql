-- Saving a device for push (save_push) gets limits:
-- * only the push services' own addresses (Google/Chrome, Apple, Mozilla, Microsoft) can be saved;
-- * an address saved by someone else moves to you only if you also have its keys (the browser makes
--   the address and keys together, so that's the same device signed in as someone new);
-- * at most 10 devices each (the oldest go), and 20 saves an hour.
-- api/push.js applies the same address rule before sending.

create or replace function public.push_endpoint_ok(p_endpoint text)
returns boolean language sql immutable as $$
  select coalesce(p_endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)/', false);
$$;
grant execute on function public.push_endpoint_ok(text) to anon, authenticated;

-- Devices already saved somewhere else are forgotten (none of the real push services are affected)
delete from public.push_subscriptions where not public.push_endpoint_ok(endpoint);
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_host check (public.push_endpoint_ok(endpoint));

create or replace function public.save_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
declare cur record;
begin
  if not public.is_signed_in() then raise exception 'sign in first' using errcode = '42501'; end if;
  if not public.push_endpoint_ok(p_endpoint) then raise exception 'not a push service address' using errcode = '22023'; end if;
  if not private.rate_ok(auth.uid(), 'save_push', 20, interval '1 hour') then
    raise exception 'rate limit: too many at once, try again in a while' using errcode = 'PT429';
  end if;
  select user_id, p256dh, auth into cur from push_subscriptions where endpoint = p_endpoint for update;
  if found and cur.user_id <> auth.uid() and (cur.p256dh <> p_p256dh or cur.auth <> p_auth) then
    raise exception 'that device is saved for someone else' using errcode = '42501';
  end if;
  delete from push_subscriptions where endpoint = p_endpoint;
  insert into push_subscriptions (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth);
  -- Keep the newest 10
  delete from push_subscriptions where user_id = auth.uid() and endpoint in (
    select endpoint from push_subscriptions where user_id = auth.uid() order by created_at desc, endpoint offset 10);
end $$;
