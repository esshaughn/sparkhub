-- Removing a friend deletes the friendship and only the caller's own pending request; declined requests stay.
create or replace function public.remove_friend(p_other uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from friendships where user_a = least(auth.uid(), p_other) and user_b = greatest(auth.uid(), p_other);
  delete from friend_requests where from_id = auth.uid() and to_id = p_other and declined_at is null;
end $$;
