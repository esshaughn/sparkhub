-- Hardening pass (audit 2026-09-24)
--
-- 1. Leads could UPDATE any column of their spark, including author_name,
--    created_by and photos. Restrict client updates to the fields the app edits.
-- 2. locked_date_id could point at another spark's date option.
-- 3. photos could hold arbitrary strings, which reached a CSS url() in the browser.
--    Paths must be <uploader uid>/<uuid>.jpg, and on insert the uid must be yours.
-- 4. merge_tokens grew forever; prune expired ones whenever a new one is minted.

-- ---------------------------------------------------------------------------
-- 1. Column-level update rights (security definer functions bypass these)
-- ---------------------------------------------------------------------------

revoke update on table public.sparks from authenticated;
grant  update (text, hopes, spot, spot_open, day, basics, locked_date_id, vision, answers)
    on table public.sparks to authenticated;

-- ---------------------------------------------------------------------------
-- 2. locked_date_id must be one of this spark's own date options
-- ---------------------------------------------------------------------------

create function public.sparks_check_locked_date()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.locked_date_id is not null and not exists (
    select 1 from date_options d where d.id = new.locked_date_id and d.spark_id = new.id
  ) then
    raise exception 'locked_date_id must be one of this spark''s date options';
  end if;
  return new;
end $$;

create trigger sparks_locked_date_check
  before insert or update of locked_date_id on public.sparks
  for each row execute function public.sparks_check_locked_date();

-- ---------------------------------------------------------------------------
-- 3. Photo paths: exact shape, and you can only attach files from your own folder
-- ---------------------------------------------------------------------------

create function public.all_match(arr text[], pattern text)
returns boolean language sql immutable as $$
  select coalesce(bool_and(x ~ pattern), true) from unnest(arr) as x;
$$;

alter table public.sparks drop constraint sparks_photos_check;
alter table public.sparks add constraint sparks_photos_check
  check (cardinality(photos) <= 3 and public.all_match(photos, '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'));

drop policy "post a spark as yourself" on public.sparks;
create policy "post a spark as yourself" on public.sparks
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (lead_id is null or lead_id = auth.uid())
    and public.all_match(photos, '^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$')
  );

-- ---------------------------------------------------------------------------
-- 4. Merge tokens: prune expired ones
-- ---------------------------------------------------------------------------

create or replace function public.prepare_merge()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_token uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from merge_tokens where created_at < now() - interval '30 minutes';
  insert into merge_tokens (from_user) values (auth.uid()) returning token into v_token;
  return v_token;
end $$;
