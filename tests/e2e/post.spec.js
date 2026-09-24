// One member: post an idea through all six steps, see it everywhere, edit it, delete it.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, button, postIdea, openIdea, confirm, deleteIdea } = require('./helpers');

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

test('location suggestions: pick a place, see its address and directions', async ({ browser }) => {
  const { page, errors, context } = await newLead(browser, 1, 'Tester');
  const title = uniqueTitle('Picnic');
  let id;
  try {
    await button(page, 'Post an idea').click();
    await page.getByLabel('The event').fill(title);
    await button(page, 'Next').click();

    // Two letters: no lookup yet. Three: suggestions for the Austin area
    await page.getByLabel('Location').fill('zi');
    await page.waitForTimeout(600);
    expect(context.placeRequests).toHaveLength(0);
    await page.getByLabel('Location').fill('zilk');
    const list = page.getByRole('group', { name: 'Suggested places' });
    await expect(list).toContainText('Zilker Metropolitan Park');
    await expect(list).toContainText('2100 Barton Springs Road, Austin, TX 78746');
    await expect(list).not.toContainText('United States');
    await expect(list).toContainText('OpenStreetMap');
    const url = new URL(context.placeRequests[0]);
    expect(url.searchParams.get('text')).toBe('zilk');
    expect(url.searchParams.get('filter')).toBe('circle:-97.7431,30.2672,60000');

    // Pick one: the name fills in, the address shows under it, the list closes
    await list.getByRole('button', { name: /Zilker Metropolitan Park/ }).click();
    await expect(page.getByLabel('Location')).toHaveValue('Zilker Metropolitan Park');
    await expect(list).toBeHidden();
    await expect(page.getByText('2100 Barton Springs Road, Austin, TX 78746')).toBeVisible();

    await button(page, 'Next').click();
    await button(page, 'Decide date later').click();
    await button(page, 'Next').click();
    await button(page, 'Skip photos').click();
    await button(page, 'Put it up').click();
    await expect(page.getByText('It’s up')).toBeVisible();
    id = page.url().match(/#\/idea\/([0-9a-f-]{36})$/)[1];

    // Idea page: spot, address and a directions link to that point
    const detail = page.locator('[data-screen-label=Detail]');
    await expect(detail.getByText('The spot: Zilker Metropolitan Park.')).toBeVisible();
    await expect(detail).toContainText('2100 Barton Springs Road, Austin, TX 78746');
    await expect(detail.getByRole('link', { name: 'Directions' })).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=30.2669,-97.7729');
    expect(errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(page, id).catch(() => {});
    await context.close();
  }
});

test('location suggestions: a search already made is answered instantly', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Tester');
  try {
    await button(page, 'Post an idea').click();
    await page.getByLabel('The event').fill('Anything');
    await button(page, 'Next').click();
    const list = page.getByRole('group', { name: 'Suggested places' });
    await page.getByLabel('Location').fill('zilk');
    await expect(list).toBeVisible();
    await page.getByLabel('Location').fill('zilker');
    await expect.poll(() => context.placeRequests.length).toBe(2);
    await page.getByLabel('Location').fill('zilk');          // backspaced: no new lookup
    await expect(list).toBeVisible();
    await page.waitForTimeout(400);
    expect(context.placeRequests).toHaveLength(2);
  } finally {
    await context.close();
  }
});

test('typing a location and changing it drops the picked address', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Tester');
  try {
    await button(page, 'Post an idea').click();
    await page.getByLabel('The event').fill('Anything');
    await button(page, 'Next').click();
    await page.getByLabel('Location').fill('congress');
    await page.getByRole('group', { name: 'Suggested places' }).getByRole('button', { name: /1100 Congress Avenue/ }).click();
    await expect(page.getByText('Austin, TX 78701')).toBeVisible();
    await page.getByLabel('Location').fill('1100 Congress Avenue, the steps');
    await expect(page.getByText('Austin, TX 78701')).toBeHidden();   // free text: no address
  } finally {
    await context.close();
  }
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
