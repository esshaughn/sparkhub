-- Automated tests send feedback starting with [E2E]; those never notify the owner's phone.
create or replace function public.feedback_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.body like '[E2E]%' then return new; end if;
  begin
    perform private.push_send((select coalesce(array_agg(user_id), '{}') from demo_admins), 'feedback',
                              'Feedback from ' || coalesce(new.name, 'someone'), left(new.body, 140), '/', 'fb:' || new.id);
  exception when others then null;
  end;
  return new;
end $$;
