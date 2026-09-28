// Posting an idea through every step, seeing it everywhere, editing and deleting it.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, button, postIdea, openIdea, confirm, startPost, openProfile, pickView } = require('./helpers');

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
    await expect(detail.getByRole('button', { name: 'Back to Torrez Fitness' })).toBeVisible();   // opened from posting: back goes to the group
    await expect(detail.getByLabel(/^Picked: Sat, Oct 17/)).toBeVisible();
    await expect(detail).toContainText('Make it a plan');                        // the lead has a date and time
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

    // Your tasks lists it under Ideas with its four checkpoints (date and location are set; no roles yet)
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Your tasks/ }).click();
    const mine = page.locator('[data-screen-label="Your tasks"] section[aria-label=Ideas] [data-task="' + Title + '"]');
    await expect(mine).toContainText('Idea · Sat, Oct 17');
    await expect(mine.getByRole('button', { name: 'Date: Date set' })).toBeVisible();
    await expect(mine.getByRole('button', { name: 'Location: Location set' })).toBeVisible();
    await expect(mine.getByRole('button', { name: 'Roles: Add essential roles' })).toBeVisible();
    // A checkpoint opens the idea at that part: Roles → its sign-ups
    await mine.getByRole('button', { name: 'Roles: Add essential roles' }).click();
    await expect(page.locator('[data-screen-label="Idea page"] #sec-tasks')).toBeInViewport();

    // Groups → Torrez Fitness → Ideas, in each view
    await page.getByRole('button', { name: 'Groups', exact: true }).click();
    await page.locator('[data-screen-label=Groups]').getByRole('button', { name: 'Torrez Fitness', exact: true }).click();
    const browse = page.locator('[data-screen-label=Browse]');
    await browse.getByRole('tab', { name: /^Ideas/ }).click();
    // Update 2: the Ideas board (tilted cards on graph paper, the four checkpoints as tiles; no sort or view)
    const card = browse.locator('[data-card="' + Title + '"]');
    await expect(card).toContainText(Title);
    await expect(card.getByLabel('Date: Date set')).toBeVisible();
    await expect(card.getByLabel('Location: Location set')).toBeVisible();
    await expect(card.getByLabel('Roles: Add essential roles')).toBeVisible();
    await expect(browse.getByRole('button', { name: /^View: / })).toHaveCount(0);

    // Profile (compact): Help & info first
    await openProfile(page);
    await expect(page.locator('[data-screen-label=Profile]')).toContainText('Help & info');

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

test('post flow guards: each step waits for an answer or a "later"', async ({ browser }) => {
  const { page, context } = await newLead(browser, 2, 'Guard');
  try {
    await startPost(page);
    // The event form comes first: it needs a name and a date
    const form = page.locator('[data-screen-label="New spark"]');
    await expect(form.getByRole('button', { name: 'Give it a name' })).toHaveAttribute('aria-disabled', 'true');
    await form.getByLabel('What', { exact: true }).fill('Chili cook-off');
    await expect(form.getByRole('button', { name: 'Pick a date' })).toHaveAttribute('aria-disabled', 'true');
    await expect(form.getByLabel('Time', { exact: true })).toHaveValue('18:00');
    await expect(form).toContainText('Shows up on the group’s calendar for everyone.');
    await form.getByRole('switch', { name: 'Invite only' }).click();
    await expect(form.getByRole('switch', { name: 'Invite only' })).toHaveAttribute('aria-checked', 'true');
    await expect(form).toContainText('Only people you invite, or who have the link, can see it.');
    // …or float it as an idea instead
    await form.getByRole('button', { name: /Not sure on the details/ }).click();
    await expect(page.getByRole('heading', { name: 'What’s the event?' })).toBeVisible();
    await expect(page.getByLabel('The event')).toHaveValue('Chili cook-off');       // the name comes along
    await page.getByLabel('The event').fill('');
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

    // "Edit" jumps back; leaving the flow posts nothing
    await review.getByRole('button', { name: 'Edit the event' }).click();
    await expect(page.getByRole('heading', { name: 'What’s the event?' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).last().click();   // idea steps → the event form
    await expect(page.locator('[data-screen-label="New spark"]').getByText('New event', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();   // → out of the flow
    await expect(page.locator('[data-screen-label=Calendar]')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('location suggestions: 2 letters, 4 rows, Austin area, remembered, free text still works', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Tester');
  try {
    await startPost(page);
    await page.getByRole('button', { name: /Not sure on the details/ }).click();
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
