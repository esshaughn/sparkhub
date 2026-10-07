-- Guests can send feedback (owner, 2026-10-07: "guests should be able to send me a feedback message just by clicking
-- Give feedback, without having to sign in"). Until now the insert policy required a signed-in account.
-- Guests (anonymous sessions) may send their own feedback, 3 an hour (accounts keep 10), with no screenshot (the
-- feedback-shots upload policy still needs an account). Their name is the first name they gave when they RSVP'd as a
-- guest, marked "(guest)", or just "Guest". Otherwise the same as 20261102060000_feedback_cap_exempt.sql.
drop policy if exists "send your own feedback" on public.feedback;
create policy "send your own feedback" on public.feedback for insert to authenticated
  with check (user_id = auth.uid());

create or replace function public.feedback_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare guest boolean;
begin
  select coalesce(u.is_anonymous, false) into guest from auth.users u where u.id = new.user_id;
  if not exists (select 1 from private.rate_exempt where user_id = new.user_id)
     and (select count(*) from feedback where user_id = new.user_id and created_at > now() - interval '1 hour') >= (case when guest then 3 else 10 end) then
    raise exception 'too much feedback in an hour' using errcode = 'P0001';
  end if;
  if new.shot is not null and (guest or split_part(new.shot, '/', 1) <> new.user_id::text) then
    raise exception 'that screenshot isn''t yours' using errcode = '42501';
  end if;
  if guest then
    select left(coalesce((select g.name || ' (guest)' from guest_contacts g where g.user_id = new.user_id and nullif(btrim(g.name), '') is not null
                          order by g.spark_id limit 1), 'Guest'), 40) into new.name;
  else
    select left(coalesce(nullif(p.name, ''), nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(u.email, '@', 1)), 40)
      into new.name from auth.users u left join profiles p on p.id = u.id where u.id = new.user_id;
  end if;
  new.body := btrim(new.body);
  return new;
end $$;
