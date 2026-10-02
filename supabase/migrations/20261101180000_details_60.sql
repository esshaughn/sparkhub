-- Details lines (sparks.hopes) can be 60 characters, not 40 (owner, 2026-10-01). Still up to three.
alter table public.sparks drop constraint sparks_hopes_check;
alter table public.sparks add constraint sparks_hopes_check check (cardinality(hopes) <= 3 and public.all_short(hopes, 60));
