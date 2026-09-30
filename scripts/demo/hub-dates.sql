-- Hub on Hunters demo dates, mid-October into December (owner, 2026-09-30). Torrez pilot members join Hub on
-- Hunters too, so its demo events should still be ahead of them through the pilot. Garden work day stays in
-- September so the Past tab isn't empty. Only demo rows in Hub on Hunters change; times stay as they are.
-- Safe to re-run.
--   Test: supabase db query --linked -f scripts/demo/hub-dates.sql
--   Live: supabase db query --linked --project-ref xwrzfpgsazyrgieymtee -f scripts/demo/hub-dates.sql
update public.sparks s set day_date = v.d::date
  from (values
    ('Neighborhood photo walk', '2026-10-15'),
    ('Plant swap', '2026-10-17'),
    ('BYO Craft Night', '2026-10-21'),
    ('Hootenanny @ the Hub', '2026-10-25'),
    ('Front-yard movie night', '2026-10-30'),
    ('Mini Gras', '2026-10-31'),
    ('Driveway Dance', '2026-11-07'),
    ('Soup swap', '2026-11-11'),
    ('Bike tune-up clinic', '2026-11-14'),
    ('Paint a Hub mural!!!', '2026-11-21'),
    ('Friendsgiving potluck', '2026-11-22'),
    ('Lemonade stand for the kids', '2026-12-05'),
    ('Block party planning', '2026-12-12'),
    ('Kids’ bike parade', '2026-12-19')
  ) as v(t, d), public.groups g
 where g.id = s.group_id and g.name like 'Hub on Hunters%' and s.demo and s.text = v.t;
