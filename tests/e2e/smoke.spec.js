// The app loads for visitors and members, and its menus and links work.
const { test, expect, devices } = require('@playwright/test');
const { newMember, newLead, button, asUser, pickView, openProfile } = require('./helpers');

test('visitors land on Welcome (no tab bar there) and sign in from there', async ({ browser }) => {
  const { page, context, errors } = await newMember(browser);
  try {
    const welcome = page.locator('[data-screen-label=Welcome]');
    await expect(welcome.getByRole('heading', { name: /Plans with\s*your people\./ })).toBeVisible();
    await expect(welcome.getByText('New here? Either one creates your account.')).toBeVisible();
    await expect(welcome.getByRole('listitem')).toHaveText(['1Create an event', '2RSVP & pitch in', '3Make it happen']);
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

test('web push: a push-only service worker registers, and Notifications offers phone notifications', async ({ browser, request }) => {
  const sw = await request.get('/sw.js');
  expect(sw.status()).toBe(200);
  const code = await sw.text();
  expect(code).toContain("addEventListener('push'");
  expect(code).not.toContain("addEventListener('fetch'");   // never caches the site
  const m = await newLead(browser, 1, 'Pia');
  try {
    const page = m.page;
    // Headless Chromium reports notifications as blocked; act like a phone that hasn't been asked yet
    await m.context.addInitScript(() => Object.defineProperty(Notification, 'permission', { get: () => 'default' }));
    await page.reload();
    await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/')))).toBe(true);
    await page.getByRole('button', { name: /^Notifications/ }).first().click();
    const card = page.locator('[data-push-card]');
    await expect(card).toContainText('Get these on your phone');
    await expect(card.getByRole('button', { name: 'Turn on notifications' })).toBeVisible();
    await card.getByLabel('Not now').click();
    await expect(card).toHaveCount(0);
    expect(m.errors).toEqual([]);
  } finally {
    await m.context.close();
  }
});

test('Add to Home Screen (Update 11): once a visit until Got it; Maybe later hides it for the visit; Android opens Chrome’s prompt, iPhone shows the Share steps', async ({ browser }) => {
  // Chrome hands an installable site a beforeinstallprompt event; stand in for it (or be an iPhone browser, which has none)
  const fake = () => {
    const iphone = localStorage.getItem('e2e-iphone');
    if (iphone) {
      const ua = iphone === 'chrome'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
      Object.defineProperty(navigator, 'userAgent', { get: () => ua });
      return;
    }
    document.addEventListener('DOMContentLoaded', () => {
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = async () => { window.__prompted = (window.__prompted || 0) + 1; };
      e.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
      window.dispatchEvent(e);
    });
  };
  const fresh = async (page, iphone) => {   // this device hasn't seen the pop-up yet
    await page.evaluate((iphone) => {
      localStorage.setItem('e2e-install', '1');
      localStorage.removeItem('sparkhub-a2hs');
      sessionStorage.removeItem('sparkhub-a2hs');
      if (iphone) localStorage.setItem('e2e-iphone', iphone); else localStorage.removeItem('e2e-iphone');
    }, iphone);
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
  };

  // Welcome (signed out), iPhone Safari: the steps; Got it means never again on this device
  const v = await newMember(browser);
  try {
    await v.context.addInitScript(fake);
    await fresh(v.page, 'safari');
    await expect(v.page.locator('[data-screen-label=Welcome]')).toBeVisible();
    const pop = v.page.getByRole('dialog', { name: 'Add to Home Screen' });
    await expect(pop).toContainText('Recommended');
    await expect(pop.getByRole('heading', { name: 'Make this an app (kinda)' })).toBeVisible();
    await expect(pop).toContainText('Add a shortcut icon on your home screen, no App Store needed.');
    await expect(pop).toContainText('Tap Share in your browser');
    await expect(pop).toContainText('Choose Add to Home Screen');
    await pop.getByRole('button', { name: 'Got it' }).click();
    await expect(pop).toHaveCount(0);
    await v.page.reload();
    await expect(v.page.locator('html[data-loaded=true]')).toHaveCount(1);
    await v.page.waitForTimeout(1200);
    expect(await v.page.evaluate(() => localStorage.getItem('sparkhub-a2hs'))).toBe('done');
    await v.page.evaluate(() => sessionStorage.removeItem('sparkhub-a2hs'));   // a new visit
    await v.page.reload();
    await expect(v.page.locator('html[data-loaded=true]')).toHaveCount(1);
    await v.page.waitForTimeout(1200);
    await expect(pop).toHaveCount(0);   // never again

    // iPhone Chrome, Maybe later: gone for this visit, back on the next
    await fresh(v.page, 'chrome');
    await expect(pop).toContainText('Choose Add to Home Screen');
    await pop.getByRole('button', { name: 'Maybe later' }).click();
    await expect(pop).toHaveCount(0);
    await v.page.reload();
    await expect(v.page.locator('html[data-loaded=true]')).toHaveCount(1);
    await v.page.waitForTimeout(1200);
    await expect(pop).toHaveCount(0);
    await v.page.evaluate(() => sessionStorage.removeItem('sparkhub-a2hs'));
    await v.page.reload();
    await expect(pop).toBeVisible();
    await v.page.mouse.click(200, 60);   // the scrim is Maybe later too
    await expect(pop).toHaveCount(0);
    expect(v.errors).toEqual([]);
  } finally {
    await v.context.close();
  }

  // Signed in, Android Chrome: once after signing in, and Install app opens Chrome's dialog
  const m = await newLead(browser, 1, 'Ivy');
  try {
    const page = m.page;
    await m.context.addInitScript(fake);
    await fresh(page, null);
    const pop = page.getByRole('dialog', { name: 'Add to Home Screen' });
    await expect(pop).toContainText('no App Store needed.');
    await expect(pop).not.toContainText('Choose Add to Home Screen');   // Android: Chrome's own dialog, no steps
    await expect(page.locator('[data-screen-label=Calendar] [data-install-card]')).toHaveCount(0);   // no card on the Calendar
    await pop.getByRole('button', { name: 'Add to Home Screen' }).click();
    await expect.poll(() => page.evaluate(() => window.__prompted)).toBe(1);
    await expect(pop).toHaveCount(0);
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await page.waitForTimeout(1200);
    await expect(pop).toHaveCount(0);   // installing counts as Got it

    // Profile keeps the way in (on Android it opens Chrome's dialog straight away)
    await openProfile(page);
    await page.getByRole('dialog', { name: 'Profile', exact: true }).getByRole('button', { name: /^Add to Home Screen/ }).click();
    await expect.poll(() => page.evaluate(() => window.__prompted)).toBe(1);
    expect(m.errors).toEqual([]);
  } finally {
    await m.context.close();
  }
});

test('Give feedback (Update 9): a Help & info tile opens the sheet; Send to Eric, then Thank you; Cancel closes it; group Plans suggestions', async ({ browser }) => {
  const m = await newLead(browser, 1, 'Fern');
  try {
    const page = m.page;
    await openProfile(page);
    const profile = page.getByRole('dialog', { name: 'Profile', exact: true });
    await expect(profile.getByRole('button', { name: 'Notification settings' })).toHaveCount(0);   // the tile it replaced
    await profile.getByRole('button', { name: 'Give feedback' }).click();
    const box = page.getByRole('dialog', { name: 'Give feedback' });
    await expect(box).toContainText('Tell Eric what you think about the app so far');
    await expect(box).toContainText('How useful does it feel?');
    await expect(box.getByRole('button', { name: 'Send to Eric' })).toHaveAttribute('aria-disabled', 'true');   // nothing typed yet
    await box.getByLabel('Your feedback').fill('[E2E] The Join button was easy to find');
    await expect(box.getByRole('button', { name: 'Send to Eric' })).toHaveAttribute('aria-disabled', 'false');
    await box.getByRole('button', { name: 'Send to Eric' }).click();
    await expect(box).toContainText('Thank you!');
    await expect(box).toContainText('Got it. This really helps me figure out what to build next.');
    await box.getByRole('button', { name: 'Done' }).click();
    await expect(box).toHaveCount(0);
    // Cancel closes without sending
    await profile.getByRole('button', { name: 'Give feedback' }).click();
    await box.getByRole('button', { name: 'Cancel' }).click();
    await expect(box).toHaveCount(0);
    await expect(profile).not.toContainText('Feedback inbox');   // only the owner sees the inbox
    await profile.getByRole('button', { name: 'Close' }).click();

    // A group's Plans tab (80a): the empty state, or "What else could happen?" under the plans; a chip starts an event with that title
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    await page.locator('[data-screen-label=Groups]').getByRole('button', { name: 'Torrez Fitness', exact: true }).click();
    const more = page.locator('[data-plans-more]'), empty = page.locator('[data-plans-empty]');
    await expect(more.or(empty)).toBeVisible();
    if (await more.count()) {
      await expect(more).toContainText('What else could happen?');
      await more.getByRole('button', { name: 'Taco night?' }).click();
      await expect(page.getByLabel('Event title')).toHaveValue('Taco night');
    } else {
      await expect(empty).toContainText('Somebody should fix that.');
    }
    expect(m.errors).toEqual([]);
  } finally {
    await m.context.close();
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
  let going = null, host = null;
  const PLAN = '[E2E] Schedule check';
  try {
    // Signed in, the app opens on the Calendar (the home screen)
    await expect(page.locator('[data-screen-label=Calendar]').getByRole('heading', { name: 'Calendar' })).toBeVisible();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Your schedule', exact: true }).click();
    const home = page.locator('[data-screen-label="Your schedule"]');
    await expect(home.getByRole('heading', { name: 'Your schedule' })).toBeVisible();
    await expect(home.getByRole('button', { name: 'Show groups' })).toHaveCount(0);   // no group picker in v6

    // With something on the schedule (going to another lead's plan in Torrez), the first month row carries the view picker.
    // Torrez is the real pilot group and has no demo events, so the test hosts its own.
    host = await newLead(browser, 2, 'Host');
    const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const planId = await asUser(host.page, async (c, _C, { day, title }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Host', lead_name: 'Host', lead_id: me, created_by: me, text: title, planned: true, day_date: day, day_time: '09:00', spot: 'The track' }).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, { day, title: PLAN });
    expect(planId).toMatch(/^[0-9a-f-]{36}$/);
    going = await asUser(page, async (c, _C, id) => {
      const me = (await c.auth.getUser()).data.user.id;
      await c.from('rsvps').upsert({ spark_id: id, user_id: me, status: 'going' });
      return { id, me };
    }, planId);
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Your schedule', exact: true }).click();
    await expect(home.getByRole('button', { name: 'View: Up next' })).toBeVisible();   // Up next by default (v6 Update 9)
    await expect(home.locator('[data-next]')).toHaveCount(1);   // the hero card
    await expect(home.locator(`[data-plan="${PLAN}"]`)).toContainText('Going');
    await pickView(home, 'Tiles');
    await expect(home.getByRole('heading', { name: new Date().toLocaleDateString('en-US', { month: 'long' }), exact: true }).or(home.getByRole('heading', { name: 'October', exact: true })).first()).toBeVisible();
    await expect(home.locator(`[data-plan="${PLAN}"]`)).toContainText('Going');   // the strip under the tile
    await expect(home.locator(`[data-plan="${PLAN}"]`)).toContainText('Change RSVP');
    await pickView(home, 'Month');
    await expect(home.getByRole('button', { name: 'Next month' })).toBeVisible();
    await pickView(home, 'Up next');

    // Calendar (the ringed center tab): the community calendar, List by default, then Month
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    const cal = page.locator('[data-screen-label=Calendar]');
    await expect(cal.getByRole('heading', { name: 'Calendar' })).toBeVisible();
    await expect(cal.getByRole('button', { name: 'Groups: All groups' })).toBeVisible();
    await expect(cal.getByRole('button', { name: 'Type of event: All types' })).toBeVisible();
    await expect(cal.locator(`[data-plan="${PLAN}"]`)).toContainText('Change RSVP');
    await cal.getByRole('button', { name: /^Sort: / }).click();
    await page.getByRole('menu', { name: 'Sort' }).getByRole('button', { name: 'Needs you' }).click();
    await expect(cal.getByRole('heading', { name: 'Could use a hand' }).or(cal.getByRole('heading', { name: 'All covered' })).first()).toBeVisible();
    await pickView(cal, 'Month');
    await expect(cal.getByRole('button', { name: 'Previous month' })).toBeVisible();
    await pickView(cal, 'List');

    // Hosting (Update 8): only through the Your tasks title switcher; scrim closes it; the switcher takes you back
    await page.goto('/#/tasks');
    await page.locator('[data-screen-label="Your tasks"]').getByRole('button', { name: 'Your tasks, switch view' }).click();
    const sw = page.getByRole('listbox', { name: 'Switch view' });
    await expect(sw.getByRole('option', { name: /^Your tasks/ })).toHaveAttribute('aria-selected', 'true');
    await expect(sw.getByRole('option', { name: /^Hosting/ })).toContainText('Everything you’re leading — drafts and ideas too');
    await page.mouse.click(200, 600);
    await expect(sw).toHaveCount(0);
    await page.locator('[data-screen-label="Your tasks"]').getByRole('button', { name: 'Your tasks, switch view' }).click();
    await sw.getByRole('option', { name: /^Hosting/ }).click();
    const own = page.locator('[data-screen-label="Hosting"]');
    await expect(own.getByRole('button', { name: 'Search events' })).toBeVisible();
    await expect(own.getByRole('button', { name: /^Notifications/ })).toHaveCount(0);
    await expect(own.locator('[data-host]').or(own.getByText('Nothing you’re hosting yet.')).first()).toBeVisible();
    await own.getByRole('button', { name: 'Hosting, switch view' }).click();
    await sw.getByRole('option', { name: /^Your tasks/ }).click();
    await expect(page.locator('[data-screen-label="Your tasks"]')).toBeVisible();

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
    // Notification settings (Settings → Notifications) opens above the Profile sheet
    await profile.getByRole('button', { name: /^Notifications/ }).click();
    await expect(page.getByRole('dialog', { name: 'Notification settings' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Notification settings' }).getByRole('button', { name: 'Close' }).click();
    await profile.getByRole('button', { name: 'Edit profile' }).click();
    const pe = page.getByRole('dialog', { name: 'Edit profile' });
    await pe.getByLabel('Place').fill('East Austin');
    await pe.getByLabel('About you').fill('Always up for a trail walk.');
    await pe.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(pe).toHaveCount(0);
    await expect(profile).toBeVisible();
    await page.getByRole('button', { name: 'How this works' }).click();
    await expect(page.getByRole('heading', { name: 'Ideas come to life when we build them together' })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    if (going) await asUser(page, async (c, _C, x) => { await c.from('rsvps').delete().eq('spark_id', x.id).eq('user_id', x.me); await c.from('profiles').update({ place: null, bio: null }).eq('id', x.me); }, going).catch(() => {});
    if (host) { await asUser(host.page, async (c) => { await c.from('sparks').delete().eq('text', '[E2E] Schedule check'); }).catch(() => {}); await host.context.close(); }
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
    await expect(page.locator('[data-sched-empty]')).toHaveCount(0);
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
