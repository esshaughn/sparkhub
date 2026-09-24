-- Location suggestions (2026-09-24): when a poster picks a suggested place, keep
-- its address and map point next to the name, for a "Directions" link.
-- Set once when the idea is posted. Clients can't UPDATE these columns (no grant);
-- if the spot text changes later (an accepted "Know a spot?" offer), the trigger
-- clears them so an old address never sits under a new place.

alter table public.sparks
  add column spot_address text check (char_length(spot_address) <= 200),
  add column spot_lat double precision check (spot_lat between -90 and 90),
  add column spot_lon double precision check (spot_lon between -180 and 180),
  add constraint spot_point_complete check ((spot_lat is null) = (spot_lon is null));

create or replace function public.clear_stale_spot_place() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.spot is distinct from old.spot then
    new.spot_address := null;
    new.spot_lat := null;
    new.spot_lon := null;
  end if;
  return new;
end $$;

create trigger clear_stale_spot_place
  before update of spot on public.sparks
  for each row execute function public.clear_stale_spot_place();
