// The app loads, talks to the TEST database, and every tab and link works.
const { test, expect } = require('@playwright/test');
const { trackErrors, button, expectConnected } = require('./helpers');

test('home loads from the test database with no errors', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sparks', level: 1 })).toBeVisible();
  await expectConnected(page);   // also proves localhost never points at the live database
  expect(errors).toEqual([]);
});

test('tab bar and shareable links', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  await button(page, 'How this works').click();
  await expect(page).toHaveURL(/#\/how$/);
  await expect(page.getByRole('heading', { name: 'Ideas come to life when we build them together' })).toBeVisible();

  await button(page, 'All sparks').click();
  await expect(page).toHaveURL(/#\/ideas$/);
  await expect(page.locator('[data-screen-label=Browse]')).toBeVisible();

  await button(page, 'Profile').click();
  await expect(page).toHaveURL(/#\/me$/);
  await expect(page.getByText('Ideas you lead')).toBeVisible();

  // Back button walks the history
  await page.goBack();
  await expect(page.locator('[data-screen-label=Browse]')).toBeVisible();

  // Deep links open directly
  await page.goto('/#/me');
  await expect(page.locator('[data-screen-label=Profile]')).toBeVisible();

  // A link opened in the same tab (only the #hash changes) is followed, not ignored
  await page.evaluate(() => { location.hash = '#/how'; });
  await expect(page.locator('[data-screen-label="How this works"]')).toBeVisible();

  // An unknown idea falls back to Home instead of a blank screen
  await page.goto('/#/idea/00000000-0000-0000-0000-000000000000');
  await expect(page.locator('[data-screen-label=Home]')).toBeVisible();

  expect(errors).toEqual([]);
});

test('sort menu offers the four orders', async ({ page }) => {
  await page.goto('/#/ideas');
  await page.getByRole('button', { name: /Newest/ }).click();
  const menu = page.locator('div[data-menu] > div[data-menu] > div[data-on]');
  await expect(menu).toHaveText(['Newest', 'Oldest', 'Needs a lead', 'Almost there']);
  await menu.filter({ hasText: 'Needs a lead' }).click();
  await expect(page.getByRole('button', { name: /Needs a lead/ })).toBeVisible();
});
