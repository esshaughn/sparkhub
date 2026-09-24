// One member: post an idea through all six steps, see it everywhere, edit it, delete it.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, button, postIdea, openIdea, confirm } = require('./helpers');

test('post → browse → profile → edit → delete', async ({ browser }) => {
  const { page, errors, context } = await newLead(browser, 1, 'Tester');
  const title = uniqueTitle('Sunset hike');

  // Post it
  const id = await postIdea(page, {
    title, location: 'Radnor Lake trailhead', date: '2026-10-17', time: '17:30',
    hopes: ['tacos after', 'bring headlamps'], photo: true
  });

  // Idea page
  const detail = page.locator('[data-screen-label=Detail]');
  await expect(detail.getByText(title.charAt(0).toUpperCase() + title.slice(1))).toBeVisible();
  await expect(detail.getByText('The spot: Radnor Lake trailhead.')).toBeVisible();
  await expect(detail.getByText('The day: Sat, Oct 17, 5:30pm.')).toBeVisible();
  await expect(detail.getByText('Tacos after')).toBeVisible();
  await expect(detail.getByText('Bring headlamps')).toBeVisible();
  await expect(detail.getByText('Tester', { exact: true })).toBeVisible();   // poster shown by name, not "You"
  await expect(button(page, 'Edit')).toBeVisible();                          // poster is the lead

  // The photo was uploaded and is served
  const photo = detail.getByRole('img', { name: 'Photo' });
  await expect(photo).toHaveCount(1);
  const photoUrl = await photo.evaluate((el) => getComputedStyle(el).backgroundImage.match(/url\("([^"]+)"/)[1]);
  expect((await page.request.get(photoUrl)).status()).toBe(200);

  // Browse card
  await button(page, 'All sparks').click();
  const card = page.locator('[data-screen-label=Browse] [data-on]').filter({ hasText: title });
  await expect(card).toContainText('Radnor Lake trailhead');
  await expect(card).toContainText('Sat, Oct 17, 5:30pm');
  await expect(card).toContainText('Tester');

  // Profile lists it, and shows who's signed in
  await button(page, 'Profile').click();
  await expect(page.locator('[data-screen-label=Profile]')).toContainText(title);
  await expect(page.locator('[data-screen-label=Profile]')).toContainText('Signed in as e2e-lead-1@example.com');

  // Edit
  await openIdea(page, id);
  await button(page, 'Edit').click();
  await page.getByLabel('The idea').fill(title + ' plus stargazing');
  await page.getByLabel('Dream version, line 3').fill('hot cocoa');
  await button(page, 'Save changes').click();
  await expect(page.getByText('Saved')).toBeVisible();
  await expect(page.locator('[data-screen-label=Detail]')).toContainText('plus stargazing');
  await expect(page.locator('[data-screen-label=Detail]')).toContainText('Hot cocoa');

  // Delete: the idea and its photo both go
  await button(page, 'Edit').click();
  await button(page, 'Delete this idea').click();
  await confirm(page, 'Delete it');
  await expect(page.locator('[data-screen-label=Browse]')).not.toContainText(title);
  // The file is removed just after the idea; give storage a moment
  await expect.poll(async () => (await page.request.get(photoUrl + '?t=' + Date.now())).status(), { timeout: 20_000 }).toBeGreaterThanOrEqual(400);

  expect(errors).toEqual([]);
  await context.close();
});

test('post flow guards: required steps and going back', async ({ page }) => {
  await page.goto('/');
  await button(page, 'Post an idea').click();

  // Next is disabled until the event has a name
  await expect(button(page, 'Next')).toHaveAttribute('aria-disabled', 'true');
  await page.getByLabel('The event').fill('Anything');
  await expect(button(page, 'Next')).toHaveAttribute('aria-disabled', 'false');
  await button(page, 'Next').click();

  // Location: Next disabled until typed; "Decide later" skips
  await expect(button(page, 'Next')).toHaveAttribute('aria-disabled', 'true');
  await button(page, 'Decide location later').click();

  // Date: Next disabled until a date is picked
  await expect(button(page, 'Next')).toHaveAttribute('aria-disabled', 'true');
  await button(page, 'Decide date later').click();
  await button(page, 'Next').click();

  // Photos: Next disabled until a photo is added
  await expect(button(page, 'Next')).toHaveAttribute('aria-disabled', 'true');
  await button(page, 'Skip photos').click();

  // Review shows the choices and "Edit" jumps back
  const review = page.locator('[data-screen-label="New spark"]');
  await expect(review).toContainText('Decide later');
  await expect(review).toContainText('Nothing yet');
  await expect(review).toContainText('None');
  // Not signed in: "Put it up" asks for an email first, and closing keeps the draft
  await button(page, 'Put it up').click();
  const login = page.getByRole('dialog');
  await expect(login.getByRole('heading', { name: 'Sign in to post' })).toBeVisible();
  await expect(button(page, 'Email me a code')).toHaveAttribute('aria-disabled', 'true');
  await login.getByLabel('Email').fill('not-an-email');
  await expect(button(page, 'Email me a code')).toHaveAttribute('aria-disabled', 'true');
  await login.getByLabel('Email').fill('someone@example.com');
  await expect(button(page, 'Email me a code')).toHaveAttribute('aria-disabled', 'false');
  await login.getByRole('button', { name: 'Close' }).click();
  await expect(login).toBeHidden();
  await expect(review).toContainText('Anything');

  await review.getByRole('button', { name: 'Edit' }).first().click();
  await expect(page.getByRole('heading', { name: 'What’s the event?' })).toBeVisible();

  // Leaving the flow doesn't post anything
  await button(page, 'Back').last().click();
  await expect(page.locator('[data-screen-label=Home]')).toBeVisible();
});
