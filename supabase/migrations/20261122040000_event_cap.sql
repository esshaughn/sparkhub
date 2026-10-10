-- Design v8-17 clarity pass (1c): an optional attendance cap. Cards say "N spots left" only when an event has one, and
-- "Full" at the cap; with none they say nothing about how many are going. Nothing sets it yet (no screen for it), and
-- nothing enforces it: it's what the cards read.
alter table public.sparks add column if not exists cap integer check (cap is null or cap between 1 and 100000);
