-- Event types chosen by the host (owner, 2026-09-30), replacing the app's title-keyword guesses:
-- up to two of active / outdoors / food / family / social. Existing events get a one-time guess from their titles.

alter table public.sparks add column if not exists tags text[] not null default '{}';
alter table public.sparks drop constraint if exists sparks_tags_ok;
alter table public.sparks add constraint sparks_tags_ok
  check (cardinality(tags) <= 2 and tags <@ array['active', 'outdoors', 'food', 'family', 'social']::text[]);
grant update (tags) on table public.sparks to authenticated;

-- One-time guess for what's already there (the old keyword lists, mapped onto the five)
update public.sparks s set tags = g.tags from (
  select id, (array_remove(array[
      case when text ~* '(activate|fitness|wake-up|wind-down|pickleball|basketball|soccer|meditation|run|5k|workout|yoga|spin|bootcamp|walk)' then 'active' end,
      case when text ~* '(trail|hike|park|creek|lake|garden|bonfire|loop|paintball|yard|cleanup|picnic)' then 'outdoors' end,
      case when text ~* '(potluck|ice cream|friendsgiving|picnic|brunch|coffee|bbq|dinner|taco|pie|chili|cook)' then 'food' end,
      case when text ~* '(egg hunt|pumpkin|youth|kids|family|4th of july|parade)' then 'family' end,
      case when text ~* '(hang|night|circle|party|dance|get-together|poker|game|music|craft|book club|swap)' then 'social' end
    ], null))[1:2] as tags
  from public.sparks) g
 where g.id = s.id and cardinality(s.tags) = 0;
