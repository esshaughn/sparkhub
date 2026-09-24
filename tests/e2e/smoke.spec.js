// The app loads for visitors and members, and its menus and links work.
const { test, expect } = require('@playwright/test');
const { newMember, newLead, button } = require('./helpers');

test('visitors land on Welcome, and group screens ask them to join or sign in', async ({ browser }) => {
  const { page, context, errors } = await newMember(browser);
  try {
    const welcome = page.locator('[data-screen-label=Welcome]');
    await expect(welcome.getByRole('heading', { name: /Small ideas\.\s*Done together\./ })).toBeVisible();
    await expect(welcome.getByText('Enter a group code')).toBeVisible();

    // Join stays grey until the code has 6 characters; letters are uppercased
    await expect(button(page, 'Join')).toHaveAttribute('aria-disabled', 'true');
    await page.getByLabel('Group code').fill('abc12');
    await expect(page.getByLabel('Group code')).toHaveValue('ABC12');
    await expect(button(page, 'Join')).toHaveAttribute('aria-disabled', 'true');

    // All ideas without a group: join or start one
    await page.getByRole('button', { name: 'All ideas' }).click();
    await expect(page).toHaveURL(/#\/ideas$/);
    await expect(page.getByText('You’re not in a group yet.')).toBeVisible();

    // How this works
    await page.getByRole('button', { name: 'How this works' }).click();
    await expect(page.getByRole('heading', { name: 'Ideas come to life when we build them together' })).toBeVisible();

    // Profile needs an account
    await page.getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByRole('dialog', { name: 'Sign in' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

    // "Sign in" from Welcome
    await page.getByRole('button', { name: 'Home' }).click();
    await page.locator('[data-screen-label=Welcome]').getByRole('button', { name: 'Sign in' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sign in' });
    await expect(dialog).toContainText('Your ideas, groups and name are saved to your account.');
    await expect(dialog.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy.html');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
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
    await expect(home.getByRole('heading', { name: /Got an idea\?\s*Spark it\./ })).toBeVisible();
    await expect(home.getByText('Your groups')).toBeVisible();
    await expect(home.getByRole('button', { name: /Torrez Fitness/ })).toBeVisible();

    // The switcher lists your groups and "Join a group"
    await page.getByRole('button', { name: 'Switch group' }).click();
    await expect(page.getByRole('button', { name: /^Torrez Fitness/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join a group' })).toBeVisible();
    await page.mouse.click(5, 400);   // clicking away closes it
    await expect(page.getByRole('button', { name: 'Join a group' })).toHaveCount(0);

    // Tapping the group tile opens its ideas
    await home.getByRole('button', { name: /Torrez Fitness/ }).click();
    const browse = page.locator('[data-screen-label=Browse]');
    await expect(browse.getByRole('heading', { name: 'All ideas' })).toBeVisible();
    await expect(browse).toContainText('Torrez Fitness');

    // Sort: Most popular first by default, then Newest, Oldest
    await expect(page.getByRole('button', { name: 'Sort' })).toContainText('Most popular');
    await page.getByRole('button', { name: 'Sort' }).click();
    const sortRows = page.getByRole('menu', { name: 'Order by' }).getByRole('button');
    await expect(sortRows).toHaveText(['Most popular', 'Newest', 'Oldest']);
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
