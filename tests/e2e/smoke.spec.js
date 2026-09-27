// The app loads for visitors and members, and its menus and links work.
const { test, expect, devices } = require('@playwright/test');
const { newMember, newLead, button, asUser, pickView } = require('./helpers');

test('visitors land on Welcome (no tab bar there) and sign in from there', async ({ browser }) => {
  const { page, context, errors } = await newMember(browser);
  try {
    const welcome = page.locator('[data-screen-label=Welcome]');
    await expect(welcome.getByRole('heading', { name: /Turn your idea\s*into a plan\./ })).toBeVisible();
    await expect(welcome.getByText('New here? Either one creates your account.')).toBeVisible();
    await expect(welcome.getByRole('listitem')).toHaveText(['1Post an idea', '2People pitch in', '3It happens']);
    await expect(welcome.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);   // no tab bar on Welcome

    // "Continue with email": the sign-in pop-up with the email field focused
    await welcome.getByRole('button', { name: 'Continue with email' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sign in' });
    await expect(dialog).toContainText('Your ideas, groups and name are saved to your account. Use Google, or we’ll email you a 6-digit code. No password.');
    await expect(dialog.getByLabel('Email')).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy.html');
    await expect(dialog.getByRole('button', { name: 'Email me a code' })).toHaveAttribute('aria-disabled', 'true');
    await dialog.getByLabel('Email').fill('someone@example.com');
    await expect(dialog.getByRole('button', { name: 'Email me a code' })).toHaveAttribute('aria-disabled', 'false');
    await dialog.getByRole('button', { name: 'Close' }).click();

    // Group screens reached by URL still ask signed-out visitors to join first
    await page.goto('/#/ideas');
    await expect(page.getByText('You’re not in a group yet.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();   // …but everywhere else, signed in or not
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button')).toHaveText(['', '', '', '', '']);
    for (const name of ['Your tasks', 'Your schedule', 'Calendar', 'Groups', 'Profile']) await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();   // the signed-in tabs show Welcome
    await expect(page.locator('[data-screen-label=Welcome]')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('installable: manifest, icons and the iOS home-screen tags', async ({ request }) => {
  const html = await (await request.get('/')).text();
  for (const tag of ['rel="manifest" href="/manifest.json"', 'name="apple-mobile-web-app-capable" content="yes"', 'name="apple-mobile-web-app-title" content="Spark Hub"', 'rel="apple-touch-icon" href="/icons/icon-180.png"']) {
    expect(html).toContain(tag);
  }
  const m = await (await request.get('/manifest.json')).json();
  expect(m).toMatchObject({ name: 'Spark Hub', short_name: 'Spark Hub', start_url: '/', display: 'standalone' });
  expect(m.icons.map(i => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const src of m.icons.map(i => i.src).concat('/icons/icon-180.png')) {
    const r = await request.get(src);
    expect(r.status(), src).toBe(200);
    expect((await r.body()).subarray(1, 4).toString(), src).toBe('PNG');
  }
});

test('privacy page is public', async ({ request }) => {
  const res = await request.get('/privacy.html');
  expect(res.status()).toBe(200);
  const html = await res.text();
  for (const must of ['Privacy', 'Spark Hub', 'Google', 'Geoapify', 'Resend', 'eric@ericscott-creative.com']) expect(html).toContain(must);
});

test('members: Your tasks, Your schedule, Calendar, view and sort menus', async ({ browser }) => {
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  let going = null;
  try {
    // Signed in, the app opens on Your tasks (v6)
    await expect(page.locator('[data-screen-label="Your tasks"]').getByRole('heading', { name: 'Your tasks' })).toBeVisible();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Your schedule', exact: true }).click();
    const home = page.locator('[data-screen-label="Your schedule"]');
    await expect(home.getByRole('heading', { name: 'Your schedule' })).toBeVisible();
    await expect(home.getByRole('button', { name: 'Show groups' })).toHaveCount(0);   // no group picker in v6

    // With something on the schedule (going to the demo "Activate"), the first month row carries the view picker
    going = await asUser(page, async (c) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const id = (await c.from('sparks').select('id').eq('text', 'Activate').eq('group_id', g).single()).data.id;
      await c.from('rsvps').upsert({ spark_id: id, user_id: me, status: 'going' });
      return { id, me };
    });
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Your schedule', exact: true }).click();
    await expect(home.getByRole('heading', { name: new Date().toLocaleDateString('en-US', { month: 'long' }), exact: true }).or(home.getByRole('heading', { name: 'October', exact: true })).first()).toBeVisible();
    await expect(home.getByRole('button', { name: 'View: Tiles' })).toBeVisible();   // Tiles by default
    await expect(home.locator('[data-plan="Activate"]')).toContainText('Going');   // the strip under the tile
    await expect(home.locator('[data-plan="Activate"]')).toContainText('Change RSVP');
    await pickView(home, 'List');
    await expect(home.locator('[data-plan="Activate"]')).toBeVisible();
    await pickView(home, 'Tiles');

    // Calendar (the ringed center tab): the community calendar, List by default, then Month
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    const cal = page.locator('[data-screen-label=Calendar]');
    await expect(cal.getByRole('heading', { name: 'Calendar' })).toBeVisible();
    await expect(cal.getByRole('button', { name: 'Groups: All groups' })).toBeVisible();
    await expect(cal.getByRole('button', { name: 'Type of event: All types' })).toBeVisible();
    await expect(cal.locator('[data-plan="Activate"]')).toContainText('Change RSVP');
    await cal.getByRole('button', { name: /^Sort: / }).click();
    await page.getByRole('menu', { name: 'Sort' }).getByRole('button', { name: 'Needs you' }).click();
    await expect(cal.getByRole('heading', { name: 'Could use a hand' }).or(cal.getByRole('heading', { name: 'All covered' })).first()).toBeVisible();
    await pickView(cal, 'Month');
    await expect(cal.getByRole('button', { name: 'Previous month' })).toBeVisible();
    await pickView(cal, 'List');

    // Your plans / Your ideas are off the tab bar but still open by link
    await page.goto('/#/own');
    const own = page.locator('[data-screen-label="Your plans & ideas"]');
    await expect(own.getByRole('tab', { name: 'Your plans' })).toHaveAttribute('aria-selected', 'true');
    await expect(own.getByRole('button', { name: 'Post an event' })).toBeVisible();
    await own.getByRole('tab', { name: 'Your ideas' }).click();
    await expect(own.getByRole('button', { name: 'Float an idea' })).toBeVisible();

    // Groups → the group card opens its page: cover, tabs, Tiles / List / Grid
    await page.getByRole('button', { name: 'Groups', exact: true }).click();
    const groups = page.locator('[data-screen-label=Groups]');
    await expect(groups.getByRole('heading', { name: 'Your groups' })).toBeVisible();
    await expect(groups.getByRole('button', { name: 'Torrez Fitness', exact: true })).not.toContainText(/members/);   // unpinned: a tile, no member count
    await groups.getByRole('button', { name: 'Torrez Fitness', exact: true }).click();
    const browse = page.locator('[data-screen-label=Browse]');
    await expect(browse.getByRole('heading', { name: 'Torrez Fitness' })).toBeVisible();
    await expect(browse).toContainText(/\d+ members/i);
    await expect(browse.getByRole('button', { name: 'I have an idea' })).toBeVisible();
    await expect(browse.getByRole('button', { name: 'Back to groups' })).toBeVisible();
    await expect(browse.getByRole('button', { name: 'Sort' })).toHaveCount(0);   // Plans first: no sort row
    await expect(browse.getByRole('button', { name: 'View: Tiles' })).toBeVisible();
    const tabs = browse.getByRole('tablist', { name: 'Ideas, plans and what happened' }).getByRole('tab');
    await expect(tabs).toHaveText([/^Ideas\s*\d+$/, /^Plans\s*\d+$/, /^Happened\s*\d+$/]);
    await tabs.filter({ hasText: 'Ideas' }).click();
    await expect(tabs.filter({ hasText: 'Ideas' })).toHaveAttribute('aria-selected', 'true');

    // Sort: Most popular first by default, then Happening soon, Newest, Oldest
    await expect(page.getByRole('button', { name: 'Sort' })).toContainText('Most popular');
    await page.getByRole('button', { name: 'Sort' }).click();
    const sortRows = page.getByRole('menu', { name: 'Order by' }).getByRole('button');
    await expect(sortRows).toHaveText(['Most popular', 'Happening soon', 'Newest', 'Oldest']);

    // Happening soon: ideas with upcoming dates first, soonest on top; undated ones after
    await sortRows.filter({ hasText: 'Happening soon' }).click();
    const cards = browse.locator('[data-card]');
    const dates = await cards.evaluateAll(els => els.map(el => /(no date yet)|((Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2} \d+)/.exec(el.textContent)?.[0] || ''));
    const firstTbd = dates.indexOf('no date yet');
    const dated = firstTbd < 0 ? dates : dates.slice(0, firstTbd);
    expect(dated.length).toBeGreaterThan(1);
    const asTime = (d) => Date.parse(d.replace(/^\w+, /, '') + ' 2026');
    for (let i = 1; i < dated.length; i++) expect(asTime(dated[i])).toBeGreaterThanOrEqual(asTime(dated[i - 1]));
    if (firstTbd > -1) expect(dates.slice(firstTbd).every(d => d === 'no date yet')).toBe(true);
    await page.getByRole('button', { name: 'Sort' }).click();
    await sortRows.filter({ hasText: 'Newest' }).click();
    await expect(page.getByRole('button', { name: 'Sort' })).toContainText('Newest');

    // View: Tiles → Grid, remembered after a reload
    await pickView(browse, 'Grid');
    await page.reload();
    await expect(browse.getByRole('button', { name: 'View: Grid' })).toBeVisible();
    await pickView(browse, 'Tiles');

    // Profile (your photo on Your tasks, a sheet): stats, Edit profile with a place line, Help & info → How Spark Hub works
    await page.getByRole('button', { name: /^Your tasks/ }).click();
    await page.locator('[data-screen-label="Your tasks"]').getByRole('button', { name: 'Profile' }).click();
    const profile = page.getByRole('dialog', { name: 'Profile', exact: true });
    await expect(profile).toContainText(/Member since \d{4}/);
    await expect(profile).toContainText('Groups');
    await expect(profile).not.toContainText('Your groups');
    await profile.getByRole('button', { name: 'Edit profile' }).click();
    const pe = page.getByRole('dialog', { name: 'Edit profile' });
    await pe.getByLabel('Place').fill('East Austin');
    await pe.getByLabel('About you').fill('Always up for a trail walk.');
    await pe.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(profile).toContainText('East Austin · Member since');
    await expect(profile).toContainText('Always up for a trail walk.');
    await page.getByRole('button', { name: 'How Spark Hub works' }).click();
    await expect(page.getByRole('heading', { name: 'Ideas come to life when we build them together' })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    if (going) await asUser(page, async (c, _C, x) => { await c.from('rsvps').delete().eq('spark_id', x.id).eq('user_id', x.me); await c.from('profiles').update({ place: null, bio: null }).eq('id', x.me); }, going).catch(() => {});
    await context.close();
  }
});

test('opening the app: loading placeholders (never "empty"), then the last screen straight away next time', async ({ browser }) => {
  const { page, context, errors } = await newLead(browser, 1, 'Tester');   // signed in, loaded once (so cached)
  const home = page.locator('[data-screen-label="Your tasks"]');
  const hold = async () => {   // hold every data request until released
    let release; const gate = new Promise(r => { release = r; });
    await page.route('**/rest/v1/**', async (route) => { await gate; await route.continue().catch(() => {}); });
    return release;
  };
  try {
    // No cache yet (cleared): placeholders, not Welcome and not the "empty" messages
    await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('spark-hub-cache')).forEach(k => localStorage.removeItem(k)));
    let release = await hold();
    await page.reload();
    await expect(home.getByRole('status', { name: 'Loading' })).toBeVisible();
    await expect(page.locator('[data-screen-label=Welcome]')).toHaveCount(0);
    await expect(page.getByText('You’re not in a group yet.')).toHaveCount(0);
    await expect(page.getByText('Nothing on the books yet.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Groups', exact: true }).click();
    await expect(page.locator('[data-screen-label=Groups]').getByRole('status', { name: 'Loading' })).toBeVisible();
    await page.getByRole('button', { name: /^Your tasks/ }).click();
    release();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await page.unroute('**/rest/v1/**');
    await expect(home.getByRole('status', { name: 'Loading' })).toHaveCount(0);
    await expect(home.getByRole('heading', { name: 'Your tasks' })).toBeVisible();

    // Next open: the cached screen shows at once, while the fresh data is still on its way
    release = await hold();
    await page.reload();
    await expect(home.getByRole('heading', { name: 'Your tasks' })).toBeVisible();
    await expect(home.getByRole('status', { name: 'Loading' })).toHaveCount(0);
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(0);
    release();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await page.unroute('**/rest/v1/**');

    // (Sign-out clears the cache too; not exercised here: the test leads are shared with parallel tests)
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('a Spark Hub loading screen shows until the app is ready', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  try {
    let release; const gate = new Promise(r => { release = r; });
    await page.route('**/js/sparks.js*', async (route) => { await gate; await route.continue(); });
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.getByRole('status', { name: 'Loading Spark Hub' })).toBeVisible();
    release();
    await expect(page.locator('[data-screen-label=Welcome]')).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading Spark Hub' })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('freeze log (temporary): a 2-second stall is noted and shows on the owner\'s Profile', async ({ browser }) => {
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  try {
    // Pretend this account is the owner (the only one who sees the log)
    await page.route('**/rest/v1/demo_admins*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user_id: 'x' }) }));
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await page.evaluate(() => { localStorage.removeItem('spark-hub-diag'); const end = Date.now() + 2000; while (Date.now() < end) { /* freeze */ } });
    await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('spark-hub-diag')) || []).map(e => e.kind))).toContain('stall');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Profile', exact: true }).click();
    const log = page.locator('[data-screen-label="Freeze log"]');
    await expect(log).toContainText(/stall [12]\.\d+s/);
    await log.getByRole('button', { name: 'Clear' }).click();
    await expect(log).toContainText('Nothing logged yet.');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('pull to refresh: the feed slides under a still header, and letting go reloads the data', async ({ browser }) => {
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  try {
    // Drag with real touch events (CDP), like a thumb: a short pull does nothing, a long one reloads
    const cdp = await context.newCDPSession(page);
    const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 200, y }] });
    const drag = async (dist) => { await touch('touchStart', 300); for (let y = 310; y <= 300 + dist; y += 10) await touch('touchMove', y); };
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    const screen = page.locator('[data-screen-label=Groups]');
    const head = screen.locator('header'), feed = screen.locator(':scope > header + *');
    const [h0, f0] = [await head.boundingBox(), await feed.boundingBox()];
    const unload = () => page.evaluate(() => { document.documentElement.removeAttribute('data-loaded'); });

    await unload();
    await drag(60);   // 30px after resistance: under the threshold
    expect((await head.boundingBox()).y).toBe(h0.y);
    expect((await feed.boundingBox()).y).toBeGreaterThan(f0.y + 20);
    await touch('touchEnd');
    await page.waitForTimeout(800);
    await expect(page.locator('html[data-loaded]')).toHaveCount(0);
    expect((await feed.boundingBox()).y).toBe(f0.y);

    await drag(200);
    await touch('touchEnd');
    await expect(page.locator('#app.ptr-busy')).toHaveCount(1);   // the spinner stays up while loading
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await expect(page.locator('#app.ptr-busy')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
