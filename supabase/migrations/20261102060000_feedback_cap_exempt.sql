-- The 10-an-hour feedback cap skips the accounts in private.rate_exempt (the e2e leads, on TEST only), like the other
-- rate limits (20261101020000_rate_limits.sql). Several test runs in an hour filled the leads' cap and failed the
-- feedback tests (2026-10-02). On live the table is empty, so nothing changes there.
-- Otherwise the same as 20261102030000_feedback_context.sql
create or replace function public.feedback_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from private.rate_exempt where user_id = new.user_id)
     and (select count(*) from feedback where user_id = new.user_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too much feedback in an hour' using errcode = 'P0001';
  end if;
  if new.shot is not null and split_part(new.shot, '/', 1) <> new.user_id::text then
    raise exception 'that screenshot isn''t yours' using errcode = '42501';
  end if;
  select left(coalesce(nullif(p.name, ''), nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(u.email, '@', 1)), 40)
    into new.name from auth.users u left join profiles p on p.id = u.id where u.id = new.user_id;
  new.body := btrim(new.body);
  return new;
end $$;
