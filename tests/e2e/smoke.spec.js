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
    // Signed in, the app opens on the Calendar (the home screen)
    await expect(page.locator('[data-screen-label=Calendar]').getByRole('heading', { name: 'Calendar' })).toBeVisible();
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

    // Groups (Update 2): photo header (YOUR PEOPLE · Groups · N groups), Join pill, Start a new group at the bottom
    await page.getByRole('button', { name: 'Groups', exact: true }).click();
    const groups = page.locator('[data-screen-label=Groups]');
    await expect(groups.getByRole('heading', { name: 'Groups', exact: true })).toBeVisible();
    await expect(groups).toContainText(/\d+ groups?/);
    await expect(groups.getByRole('button', { name: 'Join a group' })).toBeVisible();
    await expect(groups.getByRole('button', { name: 'Start a new group' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(groups.getByRole('button', { name: 'Torrez Fitness', exact: true })).not.toContainText(/members/);   // unpinned: a tile, no member count
    await groups.getByRole('button', { name: 'Torrez Fitness', exact: true }).click();
    const browse = page.locator('[data-screen-label=Browse]');
    await expect(browse.getByRole('heading', { name: 'Torrez Fitness' })).toBeVisible();
    await expect(browse).toContainText(/\d+ members/i);
    await expect(browse.getByRole('button', { name: 'I have an idea' })).toBeVisible();
    await expect(browse.getByRole('button', { name: 'Back to groups' })).toBeVisible();
    await expect(browse.getByRole('button', { name: 'Search this group' })).toBeVisible();
    // Inside a group the Groups tab isn't highlighted
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true })).not.toHaveAttribute('aria-current', 'page');

    // The world switcher: Ideas · Plans · Past, Plans first
    const tabs = browse.getByRole('tablist', { name: 'Ideas, plans and past events' }).getByRole('tab');
    await expect(tabs).toHaveText([/^Ideas\s*\d+$/, /^Plans\s*\d+$/, /^Past\s*\d+$/]);
    await expect(tabs.filter({ hasText: 'Plans' })).toHaveAttribute('aria-selected', 'true');

    // Swipe or tap the edge arrows to move between them
    await page.getByRole('button', { name: 'Go to Past' }).click();
    await expect(tabs.filter({ hasText: 'Past' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Go to Past' })).toHaveCount(0);   // no arrow past the last one
    const swipe = (dx) => page.evaluate((dx) => {
      const el = document.querySelector('[data-tabpane]'), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 40;
      const t = (cx) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: y });
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(x)], changedTouches: [t(x)] }));
      for (let i = 1; i <= 8; i++) el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [t(x + dx * i / 8)], changedTouches: [t(x + dx * i / 8)] }));
      const follows = el.style.transform;   // the page moves with the thumb, the neighbouring tab beside it
      const peek = !!el.querySelector('[data-peek]');
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(x + dx)] }));
      return { follows, peek };
    }, dx);
    const short = await swipe(20);    // a short drag follows the thumb, then springs back
    expect(short.follows).toMatch(/translateX\(\d/);
    expect(short.peek).toBe(true);
    await page.waitForTimeout(400);
    await expect(tabs.filter({ hasText: 'Past' })).toHaveAttribute('aria-selected', 'true');
    await swipe(220);    // swipe right past 40%: back to Plans
    await expect(tabs.filter({ hasText: 'Plans' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', { name: 'Go to Ideas' })).toBeVisible();

    // Plans: Sort · Filter · view on the first heading
    await expect(browse.getByRole('button', { name: 'Sort: Soonest' })).toBeVisible();
    await browse.getByRole('button', { name: 'Sort: Soonest' }).click();
    await expect(page.getByRole('menu', { name: 'Sort' }).getByRole('menuitemradio')).toHaveText(['Soonest', 'Most lively', 'Newest', 'Needs you']);
    await page.getByRole('menu', { name: 'Sort' }).getByRole('menuitemradio', { name: 'Needs you' }).click();
    await expect(browse.getByRole('heading', { name: 'Needs you' })).toBeVisible();   // one section, named after the sort
    await browse.getByRole('button', { name: 'Sort: Needs you' }).click();
    await page.getByRole('menu', { name: 'Sort' }).getByRole('menuitemradio', { name: 'Soonest' }).click();
    await browse.getByRole('button', { name: 'Filter' }).click();
    const show = page.getByRole('menu', { name: 'Show only' });
    await expect(show.getByRole('menuitemcheckbox')).toHaveText([/^Leading/, /^Helping/, /^Going/, /^Not joined yet/, /^Needs helpers/, /^This week/]);
    await show.getByRole('menuitemcheckbox', { name: /^Needs helpers/ }).click();
    await expect(browse.getByRole('button', { name: 'Filter, 1 on' })).toContainText('Filter · 1');
    await show.getByRole('button', { name: /^Show \d+ events?$/ }).click();
    await browse.getByRole('button', { name: 'Filter, 1 on' }).click();
    await page.getByRole('menu', { name: 'Show only' }).getByText('Clear', { exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(browse.getByRole('button', { name: 'Filter', exact: true })).toBeVisible();

    // View: Tiles → List, remembered after a reload
    await pickView(browse, 'List');
    await page.reload();
    await expect(browse.getByRole('button', { name: 'View: List' })).toBeVisible();
    await pickView(browse, 'Tiles');

    // Ideas: the board; Past: the scrapbook with the "SO FAR" recap
    await tabs.filter({ hasText: 'Ideas' }).click();
    await expect(tabs.filter({ hasText: 'Ideas' })).toHaveAttribute('aria-selected', 'true');
    await expect(browse.getByRole('button', { name: /^Sort/ })).toHaveCount(0);
    await tabs.filter({ hasText: 'Past' }).click();
    await expect(browse).toContainText('TORREZ FITNESS · SO FAR');

    // Group search: Browse chips and "Or something unexpected"
    await browse.getByRole('button', { name: 'Search this group' }).click();
    const gs = page.getByRole('dialog', { name: 'Group search' });
    await expect(gs.getByText('Browse', { exact: true })).toBeVisible();
    await expect(gs.locator('[data-magic]')).toHaveCount(6);
    await gs.getByRole('button', { name: 'Plans', exact: true }).click();
    await expect(gs.locator('[data-result]').first()).toBeVisible();
    await gs.getByText('Cancel', { exact: true }).click();
    await expect(gs).toHaveCount(0);

    // Profile (Update 2, compact): photo, name and a pencil; Help & info tiles first, then Settings
    // Update 3: no photo button on Your tasks; Profile is the last tab
    await page.getByRole('button', { name: /^Your tasks/ }).click();
    await expect(page.locator('[data-screen-label="Your tasks"]').getByRole('button', { name: 'Profile' })).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Profile', exact: true }).click();
    const profile = page.getByRole('dialog', { name: 'Profile', exact: true });
    await expect(profile.getByRole('heading', { name: 'Help & info' })).toBeVisible();
    await expect(profile).not.toContainText('Member since');
    await expect(profile).not.toContainText('Hosted');
    // Notification settings opens above the Profile sheet
    await profile.getByRole('button', { name: 'Notification settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Notification settings' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Notification settings' }).getByRole('button', { name: 'Close' }).click();
    await profile.getByRole('button', { name: 'Edit profile' }).click();
    const pe = page.getByRole('dialog', { name: 'Edit profile' });
    await pe.getByLabel('Place').fill('East Austin');
    await pe.getByLabel('About you').fill('Always up for a trail walk.');
    await pe.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(pe).toHaveCount(0);
    await expect(profile).toBeVisible();
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
  const home = page.locator('[data-screen-label=Calendar]');
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
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    release();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await page.unroute('**/rest/v1/**');
    await expect(home.getByRole('status', { name: 'Loading' })).toHaveCount(0);
    await expect(home.getByRole('heading', { name: 'Calendar' })).toBeVisible();

    // Next open: the cached screen shows at once, while the fresh data is still on its way
    release = await hold();
    await page.reload();
    await expect(home.getByRole('heading', { name: 'Calendar' })).toBeVisible();
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
