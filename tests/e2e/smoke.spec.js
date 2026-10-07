// The app loads for visitors and members, and its menus and links work.
const { test, expect, devices } = require('@playwright/test');
const { newMember, newLead, button, asUser, pickView, openProfile, postIdea, uniqueTitle, PNG, openAllGroups } = require('./helpers');

test('visitors land on Welcome (no tab bar there) and sign in from there', async ({ browser }) => {
  const { page, context, errors } = await newMember(browser);
  try {
    const welcome = page.locator('[data-screen-label=Welcome]');
    await expect(welcome.getByRole('heading', { name: /Plans with\s*your people\./ })).toBeVisible();
    await expect(welcome.getByText('New here? Either one creates your account.')).toBeVisible();
    await expect(welcome.getByRole('listitem')).toHaveText(['1Float an Idea', '2Everybody pitches in', '3Make it a Plan']);   // the intro's steps (owner, 2026-10-07)
    await expect(welcome.locator('[data-about-link]')).toBeVisible();
    await expect(welcome.locator('[data-beta]').first()).toHaveText('BETA');   // beside the wordmark (owner, 2026-10-07)
    await expect(welcome.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);   // no tab bar on Welcome

    // "Continue with email": the sign-in pop-up with just the email field, focused (no Google button there)
    await welcome.getByRole('button', { name: 'Continue with email' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sign in' });
    await expect(dialog).toContainText('Your Ideas, groups and name are saved to your account. We’ll email you a 6-digit code. No password.');
    await expect(dialog.getByLabel('Email')).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);
    await expect(dialog.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy.html');
    await expect(dialog.getByRole('button', { name: 'Email login code' })).toHaveAttribute('aria-disabled', 'true');
    await dialog.getByLabel('Email').fill('someone@example.com');
    await expect(dialog.getByRole('button', { name: 'Email login code' })).toHaveAttribute('aria-disabled', 'false');
    await dialog.getByRole('button', { name: 'Close' }).click();

    // Group screens reached by URL still ask signed-out visitors to join first
    await page.goto('/#/browse');
    await expect(page.getByText('You’re not in a group yet.')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();   // …but everywhere else, signed in or not
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button')).toHaveText(['Groups', 'Friends', 'Calendar', 'Ideas', 'Me']);   // v8-4's five flat tabs
    for (const name of ['Groups', 'Friends', 'Calendar', 'Ideas', 'Me']) await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name, exact: true })).toBeVisible();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();   // the signed-in tabs show Welcome
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

// Get the app (first-encounter audit 6, owner 2026-10-07): offered right after an RSVP, never on first load. An iPhone Safari
// guest gets the iOS 26 steps (⋯ → Share → Add to Home Screen) and the sign-in-once note; Not now puts it away
test('Get the app: after a guest RSVP, iPhone Safari gets the steps; Not now puts it away', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Lena Lead');
  const v = await newMember(browser);
  let id;
  try {
    id = await asUser(page, async (c, _C, { title, day }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      return (await c.from('sparks').insert({ group_id: g, author_name: 'Lena Lead', lead_name: 'Lena Lead', lead_id: me, created_by: me, text: title, planned: true, day_date: day }).select('id').single()).data.id;
    }, { title: uniqueTitle('App walk'), day: new Date(Date.now() + 8 * 864e5).toISOString().slice(0, 10) });
    await v.context.addInitScript(() => {
      if (!localStorage.getItem('e2e-iphone')) return;
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
      Object.defineProperty(navigator, 'userAgent', { get: () => ua });
    });
    await v.page.evaluate(() => { localStorage.setItem('e2e-install', '1'); localStorage.setItem('e2e-iphone', 'safari'); localStorage.removeItem('sparkhub-a2hs'); sessionStorage.removeItem('sparkhub-a2hs'); });
    await v.page.goto('/?iphone=1#/idea/' + id);   // a new address loads the page again (a hash change alone wouldn't), so the iPhone stand-in applies
    const P = v.page.locator('[data-screen-label="Plan page"]');
    await expect(P).toBeVisible();
    await v.page.waitForTimeout(1500);
    await expect(v.page.getByRole('dialog', { name: 'Add to Home Screen' })).toHaveCount(0);   // not on first load
    await P.locator('[data-rsvp]').getByRole('button', { name: 'Going', exact: true }).click();
    const d = v.page.getByRole('dialog', { name: 'RSVP as a guest' });
    await d.getByLabel('Your name').fill('Ash');
    await d.locator('[data-guest-rsvp]').click();
    await v.page.getByRole('dialog', { name: 'You’re on the list' }).locator('[data-plus-done]').click();
    const pop = v.page.getByRole('dialog', { name: 'Add to Home Screen' });
    await expect(pop).toContainText('Get the Spark Hub app');
    await expect(pop.locator('[data-a2hs-steps="safari"]')).toContainText('at the bottom of the screen');
    await expect(pop.locator('[data-a2hs-note]')).toContainText('You’ll sign in once there.');
    await pop.locator('[data-a2hs-later]').click();
    await expect(pop).toHaveCount(0);
    expect(v.errors).toEqual([]);
  } finally {
    if (id) await asUser(page, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    await context.close();
    await v.context.close();
  }
});

test('Add to Home Screen: never pops up on its own (owner, 2026-10-06); Me → Settings opens Chrome’s prompt or the iPhone steps', async ({ browser }) => {
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

  // Welcome (signed out), iPhone Safari: nothing pops up
  const v = await newMember(browser);
  try {
    await v.context.addInitScript(fake);
    await fresh(v.page, 'safari');
    await expect(v.page.locator('[data-screen-label=Welcome]')).toBeVisible();
    await v.page.waitForTimeout(1500);
    await expect(v.page.getByRole('dialog', { name: 'Add to Home Screen' })).toHaveCount(0);
    expect(v.errors).toEqual([]);
  } finally {
    await v.context.close();
  }

  // Signed in, Android Chrome: nothing pops up either; Me's Settings opens Chrome's dialog straight away
  const m = await newLead(browser, 1, 'Ivy');
  try {
    const page = m.page;
    await m.context.addInitScript(fake);
    await fresh(page, null);
    await page.waitForTimeout(1500);
    await expect(page.getByRole('dialog', { name: 'Add to Home Screen' })).toHaveCount(0);
    await openProfile(page);
    await page.locator('[data-me-settings]').click();
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: /^Get the Spark Hub app/ }).click();
    await expect.poll(() => page.evaluate(() => window.__prompted)).toBe(1);
    expect(m.errors).toEqual([]);
  } finally {
    await m.context.close();
  }
});

test('Give feedback (Update 9): a Help & info tile opens the sheet; Send to Eric, then Thank you; Cancel closes it; group Plans suggestions', async ({ browser }) => {
  const m = await newLead(browser, 2, 'Fern');
  try {
    const page = m.page;
    await openProfile(page);
    const profile = page.locator('[data-screen-label="Me"]');
    await expect(profile.getByRole('button', { name: 'Notification settings' })).toHaveCount(0);   // the tile it replaced
    await profile.getByRole('button', { name: 'Send feedback to Eric' }).click();
    const box = page.getByRole('dialog', { name: 'Give feedback' });
    await expect(box).toContainText('FEEDBACK WANTED');   // v8-2 (1a): eyebrow, title, one line, no prompt list
    await expect(box).toContainText('What do you think of the app so far?');
    await expect(box).toContainText('Tell me honestly: what’s working and what would make it better?');
    await expect(box).not.toContainText('How useful does it feel?');
    await expect(box.getByRole('button', { name: 'Send to Eric' })).toHaveAttribute('aria-disabled', 'true');   // nothing typed yet
    await box.getByLabel('Your feedback').fill('[E2E] The Join button was easy to find');
    await expect(box.getByRole('button', { name: 'Send to Eric' })).toHaveAttribute('aria-disabled', 'false');
    // It says what comes along, and takes a screenshot the person picks (owner, 2026-10-02)
    await expect(box.locator('[data-fb-sent-with]')).toContainText('Sent with:');
    await expect(box.locator('[data-fb-sent-with]')).toContainText('Your last few taps and any errors come along too');
    await box.getByLabel('Add a screenshot').setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG });
    await expect(box.locator('[data-fb-shot]')).toContainText('Screenshot added');
    await box.getByLabel('Your feedback').fill('[E2E] The Join button was easy to find, really');   // typing keeps the screenshot
    await expect(box.locator('[data-fb-shot]')).toBeVisible();
    await box.getByRole('button', { name: 'Send to Eric' }).click();
    await expect(box).toContainText('Thank you!');
    // Saved with its context (the last taps are labels, never anything typed) and the screenshot in the sender's own folder
    const mine = await asUser(page, async (c) => {
      const me = (await c.auth.getUser()).data.user.id;
      const files = (await c.storage.from('feedback-shots').list(me)).data || [];
      for (const f of files) await c.storage.from('feedback-shots').remove([me + '/' + f.name]);   // tidy up TEST
      return { files: files.length };
    });
    expect(mine.files).toBe(1);
    await expect(box).toContainText('Got it. This really helps me figure out what to build next.');
    await box.getByRole('button', { name: 'Done' }).click();
    await expect(box).toHaveCount(0);
    // Cancel closes without sending
    await profile.getByRole('button', { name: 'Send feedback to Eric' }).click();
    await box.getByRole('button', { name: 'Cancel' }).click();
    await expect(box).toHaveCount(0);
    await expect(profile).not.toContainText('Feedback inbox');   // only the owner sees the inbox
    await expect(profile).not.toContainText('New accounts');     // nor the accounts list

    // A group's Plans tab (80a): the empty state, or the plans with nothing under them (Design v8: the floating + adds an event)
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    await page.locator('[data-screen-label=Groups]').getByRole('button', { name: 'Torrez Fitness', exact: true }).click();
    await expect(page.locator('[data-plans-more]')).toHaveCount(0);
    const empty = page.locator('[data-plans-empty]');
    if (await empty.count()) await expect(empty).toContainText('Start one, or turn an Idea into a Plan.');
    expect(m.errors).toEqual([]);
  } finally {
    await m.context.close();
  }
});

// Owner, 2026-10-02: anyone can delete their own account from Profile, behind a typed DELETE (the deleting itself is
// checked in tests/db/checks.sql; the e2e leads' accounts are needed by every other test)
test('Profile: Delete my account asks for a typed DELETE', async ({ browser }) => {
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  try {
    await openProfile(page);
    await page.locator('[data-me-settings]').click();   // Delete my account is in Settings › ACCOUNT (Design v8 prototype)
    await page.getByRole('dialog', { name: 'Settings' }).locator('[data-delete-account]').click();
    const del = page.getByRole('dialog', { name: 'Delete account' });
    await expect(del).toContainText('Delete your account?');
    await expect(del).toContainText('It can’t be undone.');
    const go = del.getByRole('button', { name: 'Delete my account' });
    await expect(go).toHaveAttribute('aria-disabled', 'true');
    await del.getByLabel('Type DELETE to confirm').fill('delet');
    await expect(go).toHaveAttribute('aria-disabled', 'true');
    await del.getByLabel('Type DELETE to confirm').fill('delete');
    await expect(go).toHaveAttribute('aria-disabled', 'false');
    await del.getByRole('button', { name: 'Keep it' }).click();
    await expect(del).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// Owner, 2026-10-02: an event link shows the page's own shape while it loads, not a bare "Loading…"
test('an event link while it loads: the photo header and card placeholders', async ({ page }) => {
  // Every database read waits, not just load_all: the link's own lookup (sparks?id=eq…) answers "gone" at once on a
  // fast database (the local one, E2E_DB=local), before the placeholder shows; TEST's slow sign-in used to hide that
  await page.route('**/rest/v1/**', async r => { await new Promise(x => setTimeout(x, 3000)); r.continue(); });
  await page.goto('/#/idea/00000000-0000-4000-8000-000000000001');
  const ph = page.locator('[data-event-loading]');
  await expect(ph).toBeVisible();
  await expect(ph).toContainText('Spark Hub');
  await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0);
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
    // Signed in, the app opens on Your calendar (v7 Update 16, owner 2026-10-03)
    await expect(page.locator('[data-screen-label="Your calendar"]').getByRole('heading', { name: 'My calendar' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
    const home = page.locator('[data-screen-label="Your calendar"]');
    await expect(home.getByRole('heading', { name: 'My calendar' })).toBeVisible();
    await expect(home.getByRole('button', { name: 'Show groups' })).toHaveCount(0);   // no group picker in v6

    // With something on the schedule (going to another lead's plan in Torrez), the first month row carries the view picker.
    // Torrez is the real pilot group and has no demo events, so the test hosts its own.
    host = await newLead(browser, 2, 'Host');
    const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const planId = await asUser(host.page, async (c, _C, { day, title }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Host', lead_name: 'Host', lead_id: me, created_by: me, text: title, planned: true, day_date: day, day_time: '09:00', spot: 'The track' }).select('id').single();
      // And one that's over, so the Past tab has its SO FAR recap (TEST's Torrez can have no past events of its own)
      const past = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
      const p = await c.from('sparks').insert({ group_id: g, author_name: 'Host', lead_name: 'Host', lead_id: me, created_by: me, text: title + ' (past)', planned: true, day_date: past }).select('id').single();
      return r.error || p.error ? (r.error || p.error).message : r.data.id;
    }, { day, title: PLAN });
    expect(planId).toMatch(/^[0-9a-f-]{36}$/);
    going = await asUser(page, async (c, _C, id) => {
      const me = (await c.auth.getUser()).data.user.id;
      await c.from('rsvps').upsert({ spark_id: id, user_id: me, status: 'going' });
      return { id, me };
    }, planId);
    // Private once she's replied (she still sees it), for the Private chip on its photo (v8-10 item 2)
    expect(await asUser(host.page, async (c, _C, id) => (await c.from('sparks').update({ visibility: 'invite' }).eq('id', id)).error, planId)).toBeNull();
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
    await expect(home.getByRole('button', { name: 'View: Up next' })).toBeVisible();   // Up next by default (v6 Update 9)
    await expect(home.locator('[data-next]')).toHaveCount(1);   // the hero card
    await expect(home.locator('[data-next] [data-private-chip]')).toHaveText('Private');
    await expect(home.locator(`[data-plan="${PLAN}"]`)).toContainText('Going');
    await pickView(home, 'Tiles');
    await expect(home.getByRole('heading', { name: new Date().toLocaleDateString('en-US', { month: 'long' }), exact: true }).or(home.getByRole('heading', { name: 'October', exact: true })).first()).toBeVisible();
    await expect(home.locator(`[data-plan="${PLAN}"]`)).toContainText('Going');   // the strip under the tile
    await expect(home.locator(`[data-plan="${PLAN}"]`)).toContainText('Change RSVP');
    await expect(home.locator(`[data-plan="${PLAN}"] [data-private-chip]`)).toHaveCount(1);   // on the tile's photo too
    await pickView(home, 'Month');
    await expect(home.getByRole('button', { name: 'Next month' })).toBeVisible();
    await pickView(home, 'Up next');

    // Explore (the old Calendar, first tab): every event in your groups, List by default, then Month
    await openAllGroups(page);
    const cal = page.locator('[data-screen-label="All groups"]');
    await expect(cal.getByRole('heading', { name: 'All groups' })).toBeVisible();
    await expect(cal.getByRole('button', { name: 'Groups: All' })).toBeVisible();
    // One group picked is named, and the pick is kept for the next visit (Joseph, 2026-10-03).
    // The lead is only in Torrez on a fresh database, so a second group of their own makes the pick mean something
    const extra = await asUser(page, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0].id, '[E2E] Second group ' + Date.now().toString(36));
    try {
      await page.reload();
      await cal.getByRole('button', { name: 'Groups: All' }).click();
      const gMenu = page.getByRole('menu', { name: 'Groups' });
      await gMenu.getByText('Clear', { exact: true }).click();
      await gMenu.getByRole('menuitemcheckbox', { name: /Torrez Fitness/ }).click();
      await page.reload();
      await expect(cal.getByRole('button', { name: 'Groups: 1 group' })).toBeVisible();
      await expect(cal.getByRole('button', { name: 'Show all groups' })).toHaveText('Showing: Torrez Fitness');
      // Your calendar keeps a pick of its own (the group line under its title, option 1b), here still all groups
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
      const yc = page.locator('[data-screen-label="Your calendar"]');
      // Design v8: an icon-only pill on the title row (not a line under it), and no Filter on My calendar
      await expect(yc.locator('header').getByRole('button', { name: 'Groups: All groups' })).toBeVisible();
      await expect(yc.getByRole('button', { name: /^Filter/ })).toHaveCount(0);
      await yc.getByRole('button', { name: 'Groups: All groups' }).click();
      await page.getByRole('menu', { name: 'Groups' }).getByRole('menuitemcheckbox', { name: 'Torrez Fitness' }).click();
      await page.getByRole('menu', { name: 'Groups' }).getByRole('button', { name: 'Done' }).click();
      await page.reload();
      await expect(yc.getByRole('button', { name: 'Groups: Torrez Fitness' })).toBeVisible();
      await expect(yc.locator(`[data-plan="${PLAN}"]`)).toHaveCount(1);   // a Torrez plan stays
      await yc.getByRole('button', { name: 'Groups: Torrez Fitness' }).click();
      await page.getByRole('menu', { name: 'Groups' }).getByRole('menuitemcheckbox', { name: 'All groups' }).click();
      await expect(yc.getByRole('button', { name: 'Groups: All groups' })).toBeVisible();
      await openAllGroups(page);
      await cal.getByRole('button', { name: 'Show all groups' }).click();
      await expect(cal.getByRole('button', { name: 'Groups: All' })).toBeVisible();
    } finally {
      await asUser(page, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), extra).catch(() => {});
    }
    await expect(cal.getByRole('button', { name: /^Type of event:/ })).toHaveCount(0);   // gone (owner, 2026-10-02)
    await expect(cal.locator(`[data-plan="${PLAN}"]`)).toContainText('Change RSVP');
    await expect(cal.locator(`[data-plan="${PLAN}"] [data-demo-tag]`)).toHaveCount(0);   // real events: no DEMO pill
    // Seeded demo content gets a DEMO pill before its title (clients can't set the flag, so fake it in the response)
    const flagDemo = async (r) => {
      const res = await r.fetch(), d = await res.json();
      d.sparks.forEach(x => { if (x.text === PLAN) x.demo = true; });
      r.fulfill({ response: res, json: d });
    };
    await context.route('**/rest/v1/rpc/load_all', flagDemo);
    await page.reload();
    await pickView(cal, 'List');   // All groups opens on Month (owner, 2026-10-07)
    await expect(cal.locator(`[data-plan="${PLAN}"] [data-demo-tag]`)).toHaveText('DEMO');
    await context.unroute('**/rest/v1/rpc/load_all', flagDemo);
    await page.reload();
    await pickView(cal, 'List');
    await expect(cal.locator(`[data-plan="${PLAN}"]`)).toContainText('Change RSVP');
    await cal.getByRole('button', { name: /^Sort: / }).click();
    await page.getByRole('menu', { name: 'Sort' }).getByRole('menuitemradio', { name: 'Needs help' }).click();
    await expect(cal.getByRole('heading', { name: 'Needs help' }).or(cal.getByRole('heading', { name: 'All covered' })).first()).toBeVisible();
    await pickView(cal, 'Month');
    await expect(cal.getByRole('button', { name: 'Previous month' })).toBeVisible();
    await pickView(cal, 'List');

    // Leading (v8): Me's YOUR STUFF opens it as a list (My tasks has no title switcher any more)
    await openProfile(page);
    await page.locator('[data-stuff="Leading"]').click();
    const own = page.getByRole('dialog', { name: 'Leading' });
    await expect(own.locator('h2')).toContainText(/^Leading · \d+$/);
    await own.getByRole('button', { name: 'Close' }).click();
    await expect(own).toHaveCount(0);

    // My groups (v8): the white header with Search and the bell; Join or add a group under the tiles; friends have their own tab
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    const groups = page.locator('[data-screen-label=Groups]');
    await expect(groups.getByRole('heading', { name: 'My groups', exact: true })).toBeVisible();
    await expect(groups.locator('[data-all-groups]')).toContainText('All events, Plans & Ideas');
    await expect(groups.locator('[data-add-friend]')).toHaveCount(0);
    await groups.getByRole('button', { name: 'Join or add a group' }).click();
    const add = page.getByRole('dialog', { name: 'Add a group' });
    for (const name of ['Join a group', 'Start a group']) await expect(add.getByRole('button', { name })).toBeVisible();
    await expect(add.getByRole('button', { name: 'Add a friend' })).toHaveCount(0);
    await add.getByRole('button', { name: 'Start a group' }).click();
    // Groups start by request (owner, 2026-10-07): Request a group opens Give feedback as a group request
    const soon = page.getByRole('alertdialog', { name: 'Groups start by request' });
    await expect(soon).toContainText('Spark Hub is still new');
    await soon.getByRole('button', { name: 'Request a group' }).click();
    await expect(soon).toHaveCount(0);
    const askBox = page.getByRole('dialog', { name: 'Give feedback' });
    await expect(askBox).toContainText('GROUP REQUEST');
    await expect(askBox).toContainText('Who’s the group for?');
    await expect(askBox.getByLabel('Your feedback')).toHaveValue('I’d like a group for ');
    await expect(askBox.locator('[data-fb-add-shot]')).toHaveCount(0);   // no screenshot or Sent with line on a request
    await expect(askBox.locator('[data-fb-sent-with]')).toHaveCount(0);
    await askBox.getByRole('button', { name: 'Cancel' }).click();
    await expect(askBox).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(groups.getByRole('button', { name: 'Torrez Fitness', exact: true })).toContainText(/members/);   // tiles show the member count too (Update 13)
    // Search filters the side that's showing
    await groups.getByRole('button', { name: 'Search your groups' }).click();
    await groups.getByLabel('Search', { exact: true }).fill('zzqq');
    await expect(groups).toContainText('No groups match “zzqq”');
    await groups.getByText('Cancel', { exact: true }).click();
    await groups.getByRole('button', { name: 'Torrez Fitness', exact: true }).click();
    const browse = page.locator('[data-screen-label=Browse]');
    await expect(browse.getByRole('heading', { name: 'Torrez Fitness' })).toBeVisible();
    await expect(browse).toContainText(/\d+ members/i);
    await expect(browse.locator('[data-new-event]')).toHaveCount(0);   // Design v8: no inline + beside the tabs…
    await expect(page.locator('[data-add-fab]')).toHaveCount(1);       // …the floating + instead
    await expect(browse.getByRole('button', { name: 'Back to groups' })).toBeVisible();
    await expect(browse.getByRole('button', { name: 'Group options' })).toBeVisible();   // v7 Update 15: Search is in the ⋯ menu
    await expect(browse).toContainText(/your group/i);
    // Inside a group the Groups tab stays lit (v8: group pages and All groups live under Groups)
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true })).toHaveAttribute('aria-current', 'page');

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
    // Once someone has used an arrow or swiped, the arrows are gone for good (they only teach the first visits)
    await expect(page.getByRole('button', { name: 'Go to Ideas' })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('spark-hub-swipe-hint'))).toBe('99');
    // The bar's own ‹ › step one tab (faded at the ends)
    await browse.getByRole('button', { name: 'Next tab' }).click();
    await expect(tabs.filter({ hasText: 'Past' })).toHaveAttribute('aria-selected', 'true');
    await expect(browse.getByRole('button', { name: 'Next tab' })).toHaveAttribute('aria-disabled', 'true');
    await browse.getByRole('button', { name: 'Previous tab' }).click();
    await expect(tabs.filter({ hasText: 'Plans' })).toHaveAttribute('aria-selected', 'true');

    // Plans: Sort · Filter · view on the first heading
    await expect(browse.getByRole('button', { name: 'Sort: By date' })).toBeVisible();
    await browse.getByRole('button', { name: 'Sort: By date' }).click();
    await expect(page.getByRole('menu', { name: 'Sort' }).getByRole('menuitemradio')).toHaveText(['By date', 'Popular', 'Newest', 'Needs help']);
    await page.getByRole('menu', { name: 'Sort' }).getByRole('menuitemradio', { name: 'Needs help' }).click();
    await expect(browse.getByRole('heading', { name: 'Needs help' })).toBeVisible();   // one section, named after the sort
    await browse.getByRole('button', { name: 'Sort: Needs help' }).click();
    await page.getByRole('menu', { name: 'Sort' }).getByRole('menuitemradio', { name: 'By date' }).click();
    await browse.getByRole('button', { name: 'Filter' }).click();
    const show = page.getByRole('menu', { name: 'Show only' });
    await expect(show.getByRole('menuitemcheckbox')).toHaveText([/^Leading/, /^Helping/, /^Going/, /^Not joined yet/, /^Needs help/, /^This week/]);
    await show.getByRole('menuitemcheckbox', { name: /^Needs help/ }).click();
    await expect(browse.getByRole('button', { name: 'Filter, 1 on' })).toContainText('Filter · 1');
    await show.getByRole('button', { name: /^Show \d+ events?$/ }).click();
    await browse.getByRole('button', { name: 'Filter, 1 on' }).click();
    await page.getByRole('menu', { name: 'Show only' }).getByText('Clear', { exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(browse.getByRole('button', { name: 'Filter', exact: true })).toBeVisible();

    // View: Up next by default (v7 Update 15: Up next · Tiles · Month); Tiles is remembered after a reload
    await expect(browse.getByRole('button', { name: 'View: Up next' })).toBeVisible();
    await pickView(browse, 'Tiles');
    await page.reload();
    await expect(browse.getByRole('button', { name: 'View: Tiles' })).toBeVisible();
    await pickView(browse, 'Up next');

    // Ideas: the board; Past: the scrapbook with the "SO FAR" recap
    await tabs.filter({ hasText: 'Ideas' }).click();
    await expect(tabs.filter({ hasText: 'Ideas' })).toHaveAttribute('aria-selected', 'true');
    await expect(browse.getByRole('button', { name: /^Sort/ })).toHaveCount(0);
    await tabs.filter({ hasText: 'Past' }).click();
    await expect(browse).toContainText('TORREZ FITNESS · SO FAR');
    // Opening a group again always lands on Plans (owner, 2026-10-03), not the tab you left it on
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    await page.locator('[data-screen-label=Groups]').getByRole('button', { name: 'Torrez Fitness', exact: true }).click();
    await expect(tabs.filter({ hasText: 'Plans' })).toHaveAttribute('aria-selected', 'true');
    await tabs.filter({ hasText: 'Past' }).click();

    // Group search: Browse chips and "Or something unexpected"
    await browse.getByRole('button', { name: 'Group options' }).click();
    const gm = page.getByRole('dialog', { name: 'Group options' });
    await expect(gm.getByRole('button', { name: 'Members, see all' })).toBeVisible();
    await expect(gm.locator('[data-leave-group]')).toBeVisible();
    await gm.getByRole('button', { name: 'Search' }).click();
    const gs = page.getByRole('dialog', { name: 'Group search' });
    await expect(gs.getByText('Browse', { exact: true })).toBeVisible();
    await expect(gs.locator('[data-magic]')).toHaveCount(3);
    await gs.getByRole('button', { name: 'Plans', exact: true }).click();
    await expect(gs.locator('[data-result]').first()).toBeVisible();
    await gs.getByText('Cancel', { exact: true }).click();
    await expect(gs).toHaveCount(0);

    // Me (v8 11a, v8-9): a tab: the header with Edit profile and the bell, the impact pill, My tasks, the rows card, Help & info
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Ideas/ }).click();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Me', exact: true }).click();
    const profile = page.locator('[data-screen-label="Me"]');
    await expect(profile.locator('[data-impact]')).toContainText(/\d+ led·\d+ helped·\d+ attended/);
    await expect(profile).not.toContainText('YOUR STUFF');
    await expect(profile.locator('[data-stuff]')).toHaveCount(5);   // My tasks (v8-4), then Drafts · Ideas · Leading · Past
    await expect(profile).toContainText('HELP & INFO');
    await expect(profile).not.toContainText('Hosted');
    // Settings is a slide-up from Me's floating gear (v8-9)
    await expect(page.locator('[data-add-fab]')).toHaveCount(0);   // no + menu on Me
    await page.locator('[data-me-settings]').click();
    await expect(page.locator('[data-me-settings]')).toHaveCount(0);   // hidden while Settings is open
    const settings = page.getByRole('dialog', { name: 'Settings' });
    // What isn't built yet carries a REQUEST chip; a tap offers Request it, a feature request in Give feedback (owner, 2026-10-07)
    await expect(settings.locator('[data-me-row="Sync to your calendar"] [data-request-chip]')).toHaveText('REQUEST');
    await settings.getByRole('button', { name: 'Sync to your calendar' }).click();
    const req = page.getByRole('alertdialog', { name: 'Sync to your calendar isn’t here yet' });
    await expect(req).toContainText('we build what people ask for');
    await req.getByRole('button', { name: 'Request it' }).click();
    const freq = page.getByRole('dialog', { name: 'Give feedback' });
    await expect(freq).toContainText('FEATURE REQUEST');
    await expect(freq).toContainText('Sync to your calendar');
    await expect(freq.locator('[data-fb-add-shot]')).toHaveCount(0);
    await freq.getByRole('button', { name: 'Cancel' }).click();
    await expect(freq).toHaveCount(0);
    // Notification settings (Settings → Notifications) opens over Me
    await settings.locator('[data-me-row="Notifications"]').click();
    await expect(page.getByRole('dialog', { name: 'Notification settings' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Notification settings' }).getByRole('button', { name: 'Done' }).click();
    await settings.getByRole('button', { name: 'Close' }).click();
    await profile.getByRole('button', { name: 'Edit profile' }).click();
    const pe = page.getByRole('dialog', { name: 'Edit profile' });
    await expect(pe.getByLabel('Place')).toHaveCount(0);   // Place is dropped (HANDOFF-to-CODE v8-8 Q28)
    await pe.getByLabel(/^About you/).fill('Always up for a trail walk.');
    await expect(pe.locator('[data-pe-about-left]')).toHaveText('113 left');   // 140 characters, counted live (Design v8 prototype)
    await pe.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(pe).toHaveCount(0);
    await expect(profile).toBeVisible();
    // Your own face: how people see you, About you included
    await profile.getByRole('button', { name: 'See your profile' }).click();
    const me = page.locator('[data-screen-label="Person"]');
    await expect(me).toContainText('This is how people see you.');
    await expect(me).toContainText('Always up for a trail walk.');
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  } finally {
    if (going) await asUser(page, async (c, _C, x) => { await c.from('rsvps').delete().eq('spark_id', x.id).eq('user_id', x.me); await c.from('profiles').update({ place: null, bio: null }).eq('id', x.me); }, going).catch(() => {});
    if (host) { await asUser(host.page, async (c) => { await c.from('sparks').delete().in('text', ['[E2E] Schedule check', '[E2E] Schedule check (past)']); }).catch(() => {}); await host.context.close(); }
    await context.close();
  }
});

test('opening the app: loading placeholders (never "empty"), then the last screen straight away next time', async ({ browser }) => {
  const { page, context, errors } = await newLead(browser, 1, 'Tester');   // signed in, loaded once (so cached)
  const home = page.locator('[data-screen-label="Your calendar"]');
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
    await expect(home.getByRole('heading', { name: 'My calendar' })).toBeVisible();

    // Next open: the cached screen shows at once, while the fresh data is still on its way
    release = await hold();
    await page.reload();
    await expect(home.getByRole('heading', { name: 'My calendar' })).toBeVisible();
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

// The whole app loads from one request, load_all() (20261101220000_load_all.sql). Until 2026-10-02 it was about
// 24 (one per table), on every page load and after every write, which froze the free TEST database under a full
// test run. A database that doesn't have the function yet still loads the old way.
test('one request loads the app; a database without load_all still loads table by table', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Tester');
  const home = page.locator('[data-screen-label="Your calendar"]');
  const TABLES = /^GET (memberships|groups|sparks|offers|interests|guest_contacts|rsvps|date_options|date_votes|spot_options|spot_votes|signup_items|signup_claims|plan_updates|cohosts|album_photos|plan_prep|reactions|spark_groups|event_drafts|notes|profiles)$/;
  let seen = [];
  page.on('request', (r) => { const m = r.url().match(/\/rest\/v1\/([^?]+)/); if (m) seen.push(r.method() + ' ' + m[1]); });
  try {
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await expect(home.getByRole('heading', { name: 'My calendar' })).toBeVisible();
    expect(seen.filter(x => x === 'POST rpc/load_all')).toHaveLength(1);
    expect(seen.filter(x => TABLES.test(x))).toEqual([]);

    // No such function (what PostgREST answers for a database without the migration): the tables, one by one
    await page.route('**/rest/v1/rpc/load_all', (r) => r.fulfill({ status: 404, contentType: 'application/json',
      body: JSON.stringify({ code: 'PGRST202', details: null, hint: null, message: 'Could not find the function public.load_all without parameters in the schema cache' }) }));
    seen = [];
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await expect(home.getByRole('heading', { name: 'My calendar' })).toBeVisible();
    await expect(page.locator('[data-load-failed]')).toHaveCount(0);
    expect(seen.filter(x => x === 'POST rpc/load_all')).toHaveLength(1);   // asked once, then not again this visit
    expect(seen).toEqual(expect.arrayContaining(['GET sparks', 'GET memberships', 'GET rsvps', 'GET profiles']));
  } finally {
    await context.close();
  }
});

// View as a user (the owner only): the app redraws itself as that person and lets nothing but reads out.
// Its reload goes through load_all like every load, so load_all has to be on the look-only list (READ_RPCS).
test('View as a user (owner only): the app reloads as that person', async ({ browser }) => {
  const other = await newLead(browser, 2, 'Bo');
  const them = await asUser(other.page, async (c) => { const u = (await c.auth.getUser()).data.user; return { id: u.id, email: u.email }; });
  await other.context.close();
  const { page, context } = await newLead(browser, 1, 'Tester');
  try {
    const torrez = await page.evaluate(() => JSON.parse(localStorage.getItem('spark-hub-prefs')).groupId);
    // Pretend this account is the owner, with one person to pick
    await page.route('**/rest/v1/demo_admins*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user_id: 'x' }) }));
    await page.route('**/rest/v1/rpc/demo_testers*', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ user_id: them.id, name: 'Bo', email: them.email, memberships: [{ group_id: torrez, role: 'member', pinned: false, last_seen_at: null }] }]) }));
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await openProfile(page);
    const card = page.locator('[data-screen-label="View as a user"]');
    await card.getByRole('button', { name: 'Pick one' }).click();
    const loaded = page.waitForResponse(r => r.url().includes('/rest/v1/rpc/load_all'));
    await card.locator(`[data-tester="${them.email}"]`).click();
    expect((await loaded).status()).toBe(200);
    await expect(page.locator('[data-preview]')).toContainText('Viewing as Bo');
    await expect(page.locator('[data-screen-label="Your calendar"]').getByRole('heading', { name: 'My calendar' })).toBeVisible();
    await expect(page.locator('[data-load-failed]')).toHaveCount(0);
    await page.locator('[data-preview]').getByText('Exit').click();
    await expect(page.locator('[data-preview]')).toHaveCount(0);
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
    // Anyone else's device keeps no log
    await page.evaluate(() => { localStorage.removeItem('spark-hub-diag'); const end = Date.now() + 2000; while (Date.now() < end) { /* freeze */ } });
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => localStorage.getItem('spark-hub-diag'))).toBeNull();
    // Pretend this account is the owner (the only one who sees the log)
    await page.route('**/rest/v1/demo_admins*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user_id: 'x' }) }));
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await page.evaluate(() => { localStorage.removeItem('spark-hub-diag'); const end = Date.now() + 2000; while (Date.now() < end) { /* freeze */ } });
    await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('spark-hub-diag')) || []).map(e => e.kind))).toContain('stall');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Me', exact: true }).click();
    const log = page.locator('[data-screen-label="Freeze log"]');
    await expect(log).toContainText(/stall [12]\.\d+s/);
    await log.getByRole('button', { name: 'Clear' }).click();
    await expect(log).toContainText('Nothing logged yet.');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('New accounts (owner only): a card under the Feedback inbox counts accounts, badges the unseen ones, and opens the list', async ({ browser }) => {
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  try {
    // Pretend this account is the owner, and answer new_accounts() with two made-up accounts
    const now = Date.now();
    const rows = [
      { user_id: '00000000-0000-4000-8000-000000000001', name: 'Rosa Diaz', email: 'rosa@e2e.test', avatar_path: null, joined_at: new Date(now - 5 * 60000).toISOString(), method: 'google',
        groups: [{ name: 'Torrez Fitness', demo: false }, { name: 'Hub on Hunters', demo: true }] },
      { user_id: '00000000-0000-4000-8000-000000000002', name: 'Sam Lee', email: 'sam@e2e.test', avatar_path: null, joined_at: new Date(now - 3 * 86400000).toISOString(), method: 'email', groups: [] }
    ];
    await page.route('**/rest/v1/demo_admins*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user_id: 'x' }) }));
    await page.route('**/rest/v1/rpc/new_accounts*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }));
    await page.evaluate((t) => localStorage.setItem('spark-hub-accounts-seen', String(t)), now - 86400000);   // Sam joined before the last look
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await openProfile(page);
    const profile = page.locator('[data-screen-label="Me"]');
    const card = profile.getByRole('button', { name: 'New accounts, 1 new' });
    await expect(card).toContainText('2 accounts so far');
    await card.click();
    const sheet = page.getByRole('dialog', { name: 'New accounts' });
    await expect(sheet).toContainText('2 accounts, newest first');
    const items = sheet.locator('[data-account]');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText('Rosa Diaz');
    await expect(items.nth(0)).toContainText('rosa@e2e.test');
    await expect(items.nth(0)).toContainText('Joined 5m ago · Google');
    await expect(items.nth(0)).toContainText('Torrez Fitness · 1 demo group');
    await expect(items.nth(0)).toContainText('NEW');
    await expect(items.nth(1)).toContainText('Joined 3 days ago · Email');
    await expect(items.nth(1)).toContainText('No groups yet');
    await expect(items.nth(1)).not.toContainText('NEW');
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(profile.getByRole('button', { name: 'New accounts', exact: true })).toContainText('2 accounts so far');   // closing marks them seen
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

test('a failed first load says so (never "not in a group"), and an event taken down while open says it is gone', async ({ browser }) => {
  test.setTimeout(90000);
  const { page, context } = await newLead(browser, 1, 'Hope');
  let id;
  try {
    // No saved copy and the database unreachable: the load-failed card, not "You're not in a group yet"
    await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('spark-hub-cache')).forEach(k => localStorage.removeItem(k)));
    await page.route('**/rest/v1/**', r => r.abort());
    await page.reload();
    await expect(page.locator('[data-load-failed]').first()).toContainText('Couldn’t load your groups and events');
    await expect(page.getByText('You’re not in a group yet.')).toHaveCount(0);
    await page.unroute('**/rest/v1/**');
    await page.locator('[data-load-failed]').first().getByText('Try now').click();
    await expect(page.locator('[data-load-failed]')).toHaveCount(0);

    // An event deleted while you're on it: the next refresh says it's gone
    id = await postIdea(page, { title: uniqueTitle('Vanishing act') });
    await asUser(page, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.locator('[data-gone]')).toContainText('That event isn’t up anymore');
    id = null;
  } finally {
    if (id) await asUser(page, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    await context.close();
  }
});

// Asking for feedback (owner, 2026-10-02; v7 Update 15, 1c): after ~5 minutes of use (10 until 2026-10-03), once, a sheet with a text box;
// sending it (or Not now) leaves a dark tip pointing at Profile
// Since the first-encounter audit (owner, 2026-10-07) it also waits for something real: a plan they went to or led
test('after about 5 minutes and a plan they went to, the feedback ask: write, Send to Eric, a tip at Profile, once', async ({ browser }) => {
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  let past;
  try {
    const me = await asUser(page, async (c) => (await c.auth.getUser()).data.user.id);
    await expect(page.locator('[data-fb-nudge]')).toHaveCount(0);
    // Four minutes and fifty seconds so far: one more tick (after reopening) tips it over, but only once they've been to something
    await page.evaluate((me) => localStorage.setItem('spark-hub-fb-nudge-' + me, JSON.stringify({ used: 290000 })), me);
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await page.waitForTimeout(4000);
    await expect(page.locator('[data-fb-nudge]')).toHaveCount(0);
    past = await asUser(page, async (c, _C, day) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      return (await c.from('sparks').insert({ group_id: g, author_name: 'Tester', lead_name: 'Tester', lead_id: me, created_by: me, text: '[E2E] Went to it ' + Date.now().toString(36), planned: true, day_date: day }).select('id').single()).data.id;
    }, new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10));
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    const ask = page.getByRole('dialog', { name: 'Help Eric improve the app' });
    await expect(ask).toBeVisible({ timeout: 25000 });
    await expect(ask).toContainText(/feedback needed/i);
    await expect(ask.locator('[data-fb-intro]')).toContainText('Spark Hub is a new project by Eric');
    await expect(ask.getByRole('button', { name: 'Send to Eric' })).toHaveAttribute('aria-disabled', 'true');
    const note = '[E2E] the calendar is confusing ' + Date.now().toString(36);
    await ask.getByLabel('Your feedback').fill(note);
    await ask.getByRole('button', { name: 'Send to Eric' }).click();
    await expect(ask).toHaveCount(0);
    const tip = page.locator('[data-fb-tip]');
    await expect(tip).toContainText('Thanks, Eric got it.');
    await expect(tip).toContainText('Add more anytime in your profile.');
    // The tip sits over the Settings tab
    const tb = await tip.boundingBox(), tab = await page.getByRole('navigation', { name: 'Main' }).getByLabel('Me', { exact: true }).boundingBox();
    expect(tb.x + tb.width).toBeGreaterThan(tab.x + tab.width / 2);
    await tip.click();
    await expect(tip).toHaveCount(0);
    // Once: it doesn't come back
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await page.waitForTimeout(5000);
    await expect(page.locator('[data-fb-nudge]')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    if (past) await asUser(page, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, past).catch(() => {});
    await context.close();
  }
});
