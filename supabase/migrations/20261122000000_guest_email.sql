-- A guest can leave an email address instead of a phone number (owner, 2026-10-10: guests signing up for jobs
-- and spots give "a phone number or an email" so the hosts can reach them).
-- guest_contacts.phone holds either one, so nothing that reads it changes: load_all(), the RLS rules and
-- guest_can_take() (which only needs it to be non-empty) work as before. Only the shape check widens.

alter table public.guest_contacts drop constraint guest_contacts_phone_check;
alter table public.guest_contacts add constraint guest_contacts_phone_check
  check (phone is null
         or (phone ~ '^[0-9 ()+.-]{10,20}$' and char_length(regexp_replace(phone, '\D', '', 'g')) >= 10)
         or (char_length(phone) <= 120 and phone ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

comment on column public.guest_contacts.phone is 'A phone number or an email address (a guest''s way for the hosts to reach them).';
