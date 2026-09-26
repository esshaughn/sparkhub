// The app loads for visitors and members, and its menus and links work.
const { test, expect } = require('@playwright/test');
const { newMember, newLead, button } = require('./helpers');

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
    await page.getByRole('button', { name: 'How this works' }).click();
    await expect(page.getByRole('heading', { name: 'Ideas come to life when we build them together' })).toBeVisible();
    await page.getByRole('button', { name: 'Home', exact: true }).click();
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

test('members: Home, group switcher, view and sort menus', async ({ browser }) => {
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  try {
    const home = page.locator('[data-screen-label=Home]');
    await expect(home.getByRole('heading', { name: /Turn your idea\s*into a plan\./ })).toBeVisible();
    await expect(home.getByText('Your groups')).toBeVisible();
    await expect(home.getByRole('button', { name: 'Switch group' })).toHaveCount(0);   // Home spans all your groups
    await expect(home.getByRole('button', { name: /^Torrez Fitness/ })).toBeVisible();

    // Coming up: "You're leading" by default, or "You're interested"; remembered after a reload
    await expect(home.getByRole('button', { name: 'Show' })).toHaveText('You’re leading');
    await home.getByRole('button', { name: 'Show' }).click();
    const show = page.getByRole('menu', { name: 'Show' }).getByRole('button');
    await expect(show).toHaveText(['You’re leading', 'You’re interested']);
    await show.filter({ hasText: 'You’re interested' }).click();
    await expect(home.getByRole('button', { name: 'Show' })).toHaveText('You’re interested');
    await page.reload();
    await expect(home.getByRole('button', { name: 'Show' })).toHaveText('You’re interested');
    await home.getByRole('button', { name: 'Show' }).click();
    await page.getByRole('menu', { name: 'Show' }).getByRole('button', { name: 'You’re leading' }).click();

    // Tapping the group tile opens its ideas
    await home.getByRole('button', { name: /^Torrez Fitness/ }).click();
    const browse = page.locator('[data-screen-label=Browse]');
    await expect(browse.getByRole('heading', { name: 'Plans' })).toBeVisible();   // plans first
    await expect(browse).toContainText('Torrez Fitness');
    const tabs = browse.getByRole('tablist', { name: 'Ideas, plans and what happened' }).getByRole('tab');
    await expect(tabs).toHaveText([/^Ideas\s*\d+$/, /^Plans\s*\d+$/, /^Happened\s*\d+$/]);
    await tabs.filter({ hasText: 'Ideas' }).click();
    await expect(browse.getByRole('heading', { name: 'Ideas' })).toBeVisible();
    await expect(tabs.filter({ hasText: 'Ideas' })).toHaveAttribute('aria-selected', 'true');

    // The switcher (group screens) lists your groups and "Join a group"
    await page.getByRole('button', { name: 'Switch group' }).click();
    await expect(page.getByRole('menu', { name: 'Your groups' }).getByRole('button', { name: /^Torrez Fitness/ })).toHaveText('Torrez Fitness');   // no role chips in menus
    await expect(page.getByRole('button', { name: 'Join a group' })).toBeVisible();
    await page.mouse.click(5, 600);   // clicking away closes it
    await expect(page.getByRole('button', { name: 'Join a group' })).toHaveCount(0);

    // Sort: Most popular first by default, then Happening soon, Newest, Oldest
    await expect(page.getByRole('button', { name: 'Sort' })).toContainText('Most popular');
    await page.getByRole('button', { name: 'Sort' }).click();
    const sortRows = page.getByRole('menu', { name: 'Order by' }).getByRole('button');
    await expect(sortRows).toHaveText(['Most popular', 'Happening soon', 'Newest', 'Oldest']);

    // Happening soon: ideas with upcoming dates first, soonest on top; undated ones after
    await sortRows.filter({ hasText: 'Happening soon' }).click();
    const cards = browse.locator('[role=button]').filter({ hasText: /Led by/ });
    const dates = await cards.evaluateAll(els => els.map(el => /(Date TBD)|((Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2} \d+)/.exec(el.textContent)?.[0] || ''));
    const firstTbd = dates.indexOf('Date TBD');
    const dated = firstTbd < 0 ? dates : dates.slice(0, firstTbd);
    expect(dated.length).toBeGreaterThan(1);
    const asTime = (d) => Date.parse(d.replace(/^\w+, /, '') + ' 2026');
    for (let i = 1; i < dated.length; i++) expect(asTime(dated[i])).toBeGreaterThanOrEqual(asTime(dated[i - 1]));
    if (firstTbd > -1) expect(dates.slice(firstTbd).every(d => d === 'Date TBD')).toBe(true);
    await page.getByRole('button', { name: 'Sort' }).click();
    await sortRows.filter({ hasText: 'Newest' }).click();
    await expect(page.getByRole('button', { name: 'Sort' })).toContainText('Newest');

    // View: Cards → Grid, remembered after a reload
    await page.getByRole('button', { name: 'Change view' }).click();
    await page.getByRole('menu', { name: 'View' }).getByRole('button', { name: 'Grid' }).click();
    await expect(page.getByRole('button', { name: 'Change view' })).toContainText('Grid');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Change view' })).toContainText('Grid');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
