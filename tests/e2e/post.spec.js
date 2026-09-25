// Posting an idea through every step, seeing it everywhere, editing and deleting it.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, button, postIdea, openIdea, confirm } = require('./helpers');

test('post → idea page → all three views → profile → edit → delete', async ({ browser }) => {
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  const title = uniqueTitle('Sunset hike');
  const Title = title.charAt(0).toUpperCase() + title.slice(1);
  try {
    const id = await postIdea(page, {
      title, location: 'zilk', pick: 'Zilker Metropolitan Park', date: '2026-10-17', time: '17:30',
      basics: ['tacos after', 'bring headlamps'], photo: true
    });

    // Idea page: date, time, location, address, directions, basics, lead
    const detail = page.locator('[data-screen-label="Idea page"]');
    await expect(detail.getByRole('heading', { name: Title })).toBeVisible();
    await expect(detail).toContainText('Torrez Fitness');
    await expect(detail).toContainText('Sat, Oct 17');
    await expect(detail).toContainText('5:30pm');
    await expect(detail).toContainText('Zilker Metropolitan Park');
    await expect(detail).toContainText('2100 Barton Springs Road, Austin, TX 78746');
    await expect(detail.getByRole('link', { name: 'Directions' })).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=30.2669,-97.7729');
    await expect(detail.getByText('Tacos after')).toBeVisible();
    await expect(detail.getByText('Bring headlamps')).toBeVisible();
    await expect(detail.getByText('Led by Tester')).toBeVisible();
    await expect(button(page, 'I’m interested')).toHaveCount(0);   // the lead doesn't get the button

    // The photo was uploaded and is served
    const url = await page.evaluate((id) => {
      const el = document.querySelector('[data-screen-label="Idea page"] > div > div[aria-hidden]');   // the framed cover layer
      return getComputedStyle(el).backgroundImage.match(/url\("([^"]+)"/)[1];
    }, id);
    expect((await page.request.get(url)).status()).toBe(200);

    // Home → Coming up (You're leading): group eyebrow, title, "You're leading · time"
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    const coming = page.locator('[data-screen-label=Home]').getByRole('button', { name: new RegExp(Title.replace(/[[\]]/g, '\\$&')) });
    await expect(coming).toContainText('Torrez Fitness');
    await expect(coming).toContainText('You’re leading · 5:30pm');
    await coming.click();

    // All ideas, in each view
    await page.getByRole('button', { name: 'All ideas' }).click();
    const browse = page.locator('[data-screen-label=Browse]');
    const card = browse.getByRole('button', { name: new RegExp(title.replace(/[[\]]/g, '\\$&')) });
    await expect(card).toContainText('Sat, Oct 17 · 5:30pm');
    await expect(card).toContainText('Zilker Metropolitan Park');
    await expect(card).toContainText('Led by Tester');
    await page.getByRole('button', { name: 'Change view' }).click();
    await page.getByRole('menu', { name: 'View' }).getByRole('button', { name: 'List' }).click();
    await expect(card).toContainText('Sat, Oct 17 · 5:30pm · Zilker Metropolitan Park');
    await page.getByRole('button', { name: 'Change view' }).click();
    await page.getByRole('menu', { name: 'View' }).getByRole('button', { name: 'Grid' }).click();
    await expect(card).toContainText('Tester');

    // Profile lists it with its group and date
    await page.getByRole('button', { name: 'Profile' }).click();
    await expect(page.locator('[data-screen-label=Profile]')).toContainText(Title);
    await expect(page.locator('[data-screen-label=Profile]')).toContainText('Torrez Fitness · Sat, Oct 17');

    // Edit the title and basics
    await openIdea(page, id);
    await detail.getByRole('button', { name: 'Edit' }).first().click();
    await page.getByLabel('The idea').fill(title + ' + stars');
    await page.getByLabel('The basics, line 3').fill('hot cocoa');
    await button(page, 'Save changes').click();
    await expect(page.getByText('Saved')).toBeVisible();
    await expect(detail).toContainText('+ stars');
    await expect(detail).toContainText('Hot cocoa');

    // Delete: the idea and its photo both go
    await detail.getByRole('button', { name: 'Edit' }).first().click();
    await button(page, 'Delete this idea').click();
    await confirm(page, 'Delete it');
    await expect(page.locator('[data-screen-label=Browse]')).not.toContainText(title);
    await expect.poll(async () => (await page.request.get(url + '?t=' + Date.now())).status(), { timeout: 20_000 }).toBeGreaterThanOrEqual(400);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('post flow guards, and "Put it up" asks visitors to sign in', async ({ browser }) => {
  const { page, context } = await newMember(browser);
  try {
    await page.getByRole('button', { name: 'Post an idea' }).click();
    await expect(button(page, 'Next')).toHaveAttribute('aria-disabled', 'true');
    // The event name is capped at 40; a count shows once 10 or fewer are left
    await page.getByLabel('The event').fill('A'.repeat(29));
    await expect(page.getByText(/\d+ left$/)).toHaveCount(0);
    await page.getByLabel('The event').fill('A'.repeat(35));
    await expect(page.getByText('5 left')).toBeVisible();
    await expect(page.getByLabel('The event')).toHaveAttribute('maxlength', '40');
    await page.getByLabel('The event').fill('Anything');
    await button(page, 'Next').click();

    await expect(button(page, 'Next')).toHaveAttribute('aria-disabled', 'true');   // location
    await button(page, 'Decide location later').click();
    await expect(button(page, 'Next')).toHaveAttribute('aria-disabled', 'true');   // date
    await button(page, 'Decide date later').click();
    await expect(page.getByRole('heading', { name: 'Paint the picture' })).toBeVisible();
    await button(page, 'Next').click();                                            // the basics are optional
    await expect(button(page, 'Next')).toHaveAttribute('aria-disabled', 'true');   // photos
    await button(page, 'Skip photos').click();

    const review = page.locator('[data-screen-label="New spark"]');
    await expect(review).toContainText('Decide later');
    await expect(review).toContainText('Nothing yet');
    await expect(review).toContainText('None');

    // Not signed in: "Sign in to post", and closing keeps the draft
    await button(page, 'Put it up').click();
    const login = page.getByRole('dialog', { name: 'Sign in' });
    await expect(login.getByRole('heading', { name: 'Sign in to post' })).toBeVisible();
    await expect(login).toContainText('Sign in to put your idea up. Use Google, or we’ll email you a 6-digit code. No password.');
    await expect(button(page, 'Email me a code')).toHaveAttribute('aria-disabled', 'true');
    await login.getByLabel('Email').fill('someone@example.com');
    await expect(button(page, 'Email me a code')).toHaveAttribute('aria-disabled', 'false');
    await login.getByRole('button', { name: 'Close' }).click();
    await expect(review).toContainText('Anything');

    // "Edit" jumps back; leaving the flow posts nothing
    await review.getByRole('button', { name: 'Edit the event' }).click();
    await expect(page.getByRole('heading', { name: 'What’s the event?' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).last().click();
    await expect(page.locator('[data-screen-label=Welcome]')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('location suggestions: 2 letters, 4 rows, Austin area, remembered, free text still works', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Tester');
  try {
    await page.getByRole('button', { name: 'Post an idea' }).click();
    await page.getByLabel('The event').fill('Anything');
    await button(page, 'Next').click();

    await page.getByLabel('Location').fill('z');
    await page.waitForTimeout(400);
    expect(context.placeRequests).toHaveLength(0);
    await page.getByLabel('Location').fill('zilk');
    const list = page.getByRole('group', { name: 'Suggested places' });
    await expect(list).toContainText('2100 Barton Springs Road, Austin, TX 78746');
    await expect(list).not.toContainText('United States');
    await expect(list).toContainText('OpenStreetMap');
    const url = new URL(context.placeRequests[0]);
    expect(url.searchParams.get('text')).toBe('zilk');
    expect(url.searchParams.get('filter')).toBe('circle:-97.7431,30.2672,60000');

    await page.getByLabel('Location').fill('zilker');
    await expect.poll(() => context.placeRequests.length).toBe(2);
    await page.getByLabel('Location').fill('zilk');             // already searched: no new lookup
    await expect(list).toBeVisible();
    await page.waitForTimeout(300);
    expect(context.placeRequests).toHaveLength(2);

    // Pick, then change the text: the address goes (free text is fine)
    await list.getByRole('button', { name: /1100 Congress Avenue/ }).click();
    await expect(page.getByText('Austin, TX 78701')).toBeVisible();
    await page.getByLabel('Location').fill('1100 Congress Avenue, the steps');
    await expect(page.getByText('Austin, TX 78701')).toBeHidden();
    await expect(button(page, 'Next')).toHaveAttribute('aria-disabled', 'false');
  } finally {
    await context.close();
  }
});
