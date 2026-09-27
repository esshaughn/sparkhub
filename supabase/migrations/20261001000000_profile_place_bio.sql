-- v5.2 Profile: a place line and a short bio under your name. Your own row only (existing policies).
alter table public.profiles
  add column place text check (char_length(place) <= 40),
  add column bio   text check (char_length(bio) <= 160);
