-- Starting groups: at most 10 per account per hour (was per day, which the
-- test accounts outgrew; an hour still stops a runaway script).

create or replace function public.create_group(p_name text)
returns table (id uuid, code text) language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text; v_name text := left(trim(regexp_replace(p_name, '\s+', ' ', 'g')), 40);
begin
  if not public.is_signed_in() then raise exception 'sign in to start a group'; end if;
  if char_length(v_name) < 2 then raise exception 'a group needs a name'; end if;
  if (select count(*) from groups g where g.created_by = auth.uid() and g.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'that''s a lot of new groups at once. Try again in a bit';
  end if;
  v_code := public.new_group_code();
  insert into groups (name, code, created_by) values (v_name, v_code, auth.uid()) returning groups.id into v_id;
  insert into memberships (group_id, user_id, role) values (v_id, auth.uid(), 'admin');
  return query select v_id, v_code;
end $$;
