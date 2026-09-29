-- v6 Update 7 (Round 64b / 65b / 65c)
-- * Notes: a short message to one person that outlives the event it's about. Deleting an event
--   tells everyone going that it's off; removing a job tells the people signed up for it.
--   Only these functions write notes; each person reads and clears their own.
-- * Make home: the host moves an event's home group to another group it's posted to.

create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 320),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index notes_user on public.notes (user_id, created_at desc);
alter table public.notes enable row level security;
create policy "your own notes" on public.notes
  for select to authenticated using (user_id = auth.uid());
create policy "clear your own notes" on public.notes
  for delete to authenticated using (user_id = auth.uid());
revoke all on table public.notes from anon;
grant select, delete on table public.notes to authenticated;

-- Delete an event (the lead, or an admin of its home group). Everyone going (but the caller)
-- gets "{title} is off. {name} took it down." Returns how many were told.
create function public.delete_event(p_spark uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare s record; v_who text; n integer := 0;
begin
  select id, text, lead_id, group_id, planned into s from sparks where id = p_spark;
  if s.id is null then raise exception 'not found'; end if;
  if s.lead_id is distinct from auth.uid() and not public.is_admin(s.group_id) then
    raise exception 'not allowed';
  end if;
  if s.planned then
    select coalesce(nullif(p.name, ''), 'The host') into v_who from profiles p where p.id = auth.uid();
    insert into notes (user_id, body, created_by)
      select r.user_id, left(left(s.text, 120) || ' is off. ' || coalesce(v_who, 'The host') || ' took it down.', 320), auth.uid()
        from rsvps r where r.spark_id = p_spark and r.status = 'going' and r.user_id <> auth.uid();
    get diagnostics n = row_count;
  end if;
  delete from sparks where id = p_spark;
  return n;
end $$;
revoke all on function public.delete_event(uuid) from public, anon;
grant execute on function public.delete_event(uuid) to authenticated;

-- Remove a job (the lead, or whoever added it). The people signed up for it or any of its
-- shifts (but the caller) get "{job} is off the list for {title}."
create function public.remove_signup(p_item uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare it record; v_title text; v_lead uuid; n integer := 0;
begin
  select id, spark_id, item, created_by into it from signup_items where id = p_item;
  if it.id is null then raise exception 'not found'; end if;
  select text, lead_id into v_title, v_lead from sparks where id = it.spark_id;
  if it.created_by is distinct from auth.uid() and v_lead is distinct from auth.uid() then
    raise exception 'not allowed';
  end if;
  insert into notes (user_id, body, created_by)
    select distinct c.user_id, left('“' || left(it.item, 80) || '” is off the list for ' || left(v_title, 120) || '.', 320), auth.uid()
      from signup_claims c join signup_items i on i.id = c.item_id
     where (i.id = p_item or i.shift_of = p_item) and c.user_id <> auth.uid();
  get diagnostics n = row_count;
  delete from signup_items where id = p_item;
  return n;
end $$;
revoke all on function public.remove_signup(uuid) from public, anon;
grant execute on function public.remove_signup(uuid) to authenticated;

-- Make home: only the lead, only to a group the event is already posted to and they belong to.
-- The old home becomes an ordinary extra group (which the lead can then take off).
create function public.set_home_group(p_spark uuid, p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_old uuid;
begin
  select group_id into v_old from sparks where id = p_spark and lead_id = auth.uid();
  if v_old is null then raise exception 'not allowed'; end if;
  if v_old = p_group then return; end if;
  if not exists (select 1 from spark_groups where spark_id = p_spark and group_id = p_group)
     or not exists (select 1 from memberships where group_id = p_group and user_id = auth.uid()) then
    raise exception 'not allowed';
  end if;
  delete from spark_groups where spark_id = p_spark and group_id = p_group;
  update sparks set group_id = p_group where id = p_spark;
  insert into spark_groups (spark_id, group_id) values (p_spark, v_old) on conflict do nothing;
end $$;
revoke all on function public.set_home_group(uuid, uuid) from public, anon;
grant execute on function public.set_home_group(uuid, uuid) to authenticated;
