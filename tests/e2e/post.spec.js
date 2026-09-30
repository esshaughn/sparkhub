// Create event (v6 Update 6): the 5-step flow with "Decide later", polls, jobs, Review, drafts,
// then the host's edit pop-ups on the event page.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, button, postEvent, openIdea, confirm, startPost, asUser } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('post an event with every step filled, then edit it in the pop-ups and delete it', async ({ browser }) => {
  test.setTimeout(120000);
  const { page, errors, context } = await newLead(browser, 1, 'Tester');
  const title = uniqueTitle('Sunset hike');
  let id;
  try {
    id = await postEvent(page, {
      title, date: inDays(18), time: '17:30', where: 'zilk', pick: 'Zilker Metropolitan Park',
      details: ['Tacos after', 'Bring headlamps'], jobs: [{ item: 'Bring water', need: 3 }], photo: true
    });
    const P = page.locator('[data-screen-label="Plan page"]');
    await expect(P.locator('[data-chip]')).toHaveText('YOU’RE LEADING');
    await expect(P).toContainText('5:30pm');
    await expect(P).toContainText('Zilker Metropolitan Park');
    await expect(P).toContainText('2100 Barton Springs Road, Austin, TX 78746');
    await expect(P.locator('[data-basics]')).toContainText('Tacos after');
    await expect(P.locator('[data-basics]')).toContainText('Bring headlamps');
    await expect(P.locator('[data-signup="Bring water"]')).toContainText('0 of 3');
    await expect(P).not.toContainText('Before the day');
    await expect(P).not.toContainText('Remind everyone the day before');
    await expect(P.locator('[data-tbd]')).toHaveCount(0);                 // nothing left to decide
    await expect(P.locator('[data-vis]')).toContainText('Public');
    await expect(P.locator('[data-vis]')).toContainText('Torrez Fitness');

    // The cover was uploaded and is served
    const url = await page.evaluate(() => getComputedStyle(document.querySelector('[data-screen-label="Plan page"] > div > div[aria-hidden]')).backgroundImage.match(/url\("([^"]+)"/)[1]);
    expect((await page.request.get(url)).status()).toBe(200);

    // Your tasks (purple): only open spots are left
    const bar = P.locator('[data-host-tasks-bar]');
    await expect(bar).toContainText('1 task');
    await bar.click();
    await expect(P.locator('[data-screen-label="Your tasks"]')).toContainText('Fill open spots');

    // Title & photo pop-up
    await P.getByRole('button', { name: /edit the title$/ }).click();
    const sec = page.getByRole('dialog', { name: 'Title & photo' });
    await sec.getByLabel('Event title').fill(title + ' + stars');
    await sec.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(sec).toHaveCount(0);
    await expect(P.locator('h1')).toContainText('+ stars');

    // Basic details pop-up
    await P.getByRole('button', { name: 'Edit basic details' }).click();
    const bd = page.getByRole('dialog', { name: 'Basic details' });
    await bd.getByLabel('Basic details, line 3').fill('Hot cocoa');
    await bd.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(P.locator('[data-basics]')).toContainText('Hot cocoa');

    // Who can see it: Private
    await P.getByRole('button', { name: 'Edit who can see it' }).click();
    const vis = page.getByRole('dialog', { name: 'Who can see it' });
    await vis.getByRole('radio', { name: /^Private/ }).click();
    await vis.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(P).toContainText('PRIVATE');
    await expect(P.locator('[data-vis]')).toContainText('Private');

    // Edit what you need: rename the job and ask for one more
    await P.getByRole('button', { name: 'Edit what you need' }).click();
    const needs = page.getByRole('dialog', { name: 'Edit what you need' });
    await needs.getByLabel('Job name 1').fill('Bring cold water');
    await needs.getByRole('button', { name: 'More for how many people' }).click();
    // A job that arrives while the sheet is open (another device, or the sheet opened on cached data) survives Save
    await asUser(page, async (c, _C, id) => { await c.from('signup_items').insert({ spark_id: id, item: 'Folding chairs', need: 2 }); }, id);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));   // the background refresh
    await expect(P.locator('[data-signup="Folding chairs"]')).toHaveCount(1);
    await needs.getByRole('button', { name: 'Save changes' }).click();
    await expect(needs).toHaveCount(0);
    await expect(P.locator('[data-signup="Bring cold water"]')).toContainText('0 of 4');
    await expect(P.locator('[data-signup="Folding chairs"]')).toContainText('0 of 2');

    // Share link: copy, and the share intents
    await P.getByRole('button', { name: 'Share link' }).click();
    const share = page.getByRole('dialog', { name: 'Share link' });
    await expect(share.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/);
    await expect(share.getByRole('link', { name: 'Email' })).toHaveAttribute('href', /^mailto:/);
    await share.getByRole('button', { name: 'Close' }).click();

    // Delete: the event and its photo both go
    await P.getByRole('button', { name: 'Delete this event' }).click();
    await confirm(page, 'Delete it');
    id = null;
    await expect.poll(async () => (await page.request.get(url + '?t=' + Date.now())).status(), { timeout: 20_000 }).toBeGreaterThanOrEqual(400);
    expect(errors).toEqual([]);
  } finally {
    if (id) await asUser(page, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    await context.close();
  }
});

test('decide everything later: only the title is needed; the host is left with tasks', async ({ browser }) => {
  test.setTimeout(90000);
  const { page, context, errors } = await newLead(browser, 2, 'Guard');
  const title = uniqueTitle('Chili cook-off');
  let id;
  try {
    await startPost(page);
    const flow = page.locator('[data-screen-label="New spark"]');
    await expect(flow).toContainText('1 of 5');
    await expect(flow).toContainText('Your event');
    await expect(flow.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true');
    await expect(flow.getByText('Decide later', { exact: true })).toHaveCount(0);   // the title can't wait
    // With no title, X just closes
    await flow.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('[data-screen-label=Calendar]')).toBeVisible();

    await startPost(page);
    await flow.getByLabel('Event title').fill(title);
    await expect(flow.getByLabel('Event title')).toHaveAttribute('maxlength', '40');
    // The phone's Back with a title asks about a draft instead of dropping it
    await page.goBack();
    const leave = page.getByRole('dialog', { name: 'Save as draft' });
    await expect(leave).toContainText('Save this as a draft?');
    await leave.getByRole('button', { name: 'Keep going' }).click();
    await expect(flow.getByLabel('Event title')).toHaveValue(title);
    await flow.getByRole('button', { name: 'Next' }).click();
    // …and on a later step it goes back a step
    await page.goBack();
    await expect(flow).toContainText('1 of 5');
    await flow.getByRole('button', { name: 'Next' }).click();
    // Date & time: the start list, then an end time that only offers later times
    await expect(flow).toContainText('Date & time');
    await flow.getByLabel('Date', { exact: true }).fill(inDays(10));
    await flow.getByRole('button', { name: 'Add a start time (optional)' }).click();
    await flow.getByRole('option', { name: '6:00pm', exact: true }).click();
    await flow.getByText('Add end time').click();
    await expect(flow.getByRole('option', { name: '5:30pm', exact: true })).toHaveCount(0);
    await flow.getByRole('option', { name: '8:00pm', exact: true }).click();
    // Decide later only shows while the step is empty, so it can't wipe what's filled in
    await expect(flow.getByText('Decide later', { exact: true })).toHaveCount(0);
    await flow.getByLabel('Date', { exact: true }).fill('');
    await flow.getByText('Decide later', { exact: true }).click();   // clears the leftover times too
    await expect(flow).toContainText('3 of 5');
    await flow.getByRole('button', { name: 'Back' }).click();
    await expect(flow.getByLabel('Date', { exact: true })).toHaveValue('');
    await expect(flow.getByRole('button', { name: 'Add a start time (optional)' })).toBeVisible();
    await flow.getByText('Decide later', { exact: true }).click();
    for (const n of ['3 of 5', '4 of 5', '5 of 5']) {
      await expect(flow).toContainText(n);
      await expect(flow.getByRole('button', { name: /^(Next|Review)$/ })).toHaveAttribute('aria-disabled', 'true');
      await flow.getByText('Decide later', { exact: true }).click();
    }
    // Review: every undecided part in amber
    await expect(flow).toContainText('LOOKS GOOD');
    for (const t of ['Date TBD', 'Location TBD', 'Basic details to be decided', 'Help to be decided']) await expect(flow).toContainText(t);
    // Add / Edit on Review comes straight back to Review, not through the later steps
    await flow.getByLabel('Add basic details').click();
    await expect(flow).toContainText('4 of 5');
    await flow.getByLabel('Basic details, line 1').fill('Bring a bowl');
    await flow.getByRole('button', { name: 'Back to review' }).click();
    await expect(flow).toContainText('LOOKS GOOD');
    await expect(flow).toContainText('Bring a bowl');
    await flow.getByLabel('Edit basic details').click();
    await flow.getByLabel('Basic details, line 1').fill('');
    await flow.getByText('Decide later', { exact: true }).click();
    await expect(flow).toContainText('Basic details to be decided');
    await flow.getByRole('button', { name: 'Post it' }).click();
    await expect(page.locator('[data-screen-label="Plan page"]')).toBeVisible();
    id = await page.evaluate(() => location.hash.split('/').pop());

    const P = page.locator('[data-screen-label="Plan page"]');
    await expect(P.locator('[data-tbd]')).toContainText('2 things left to decide');
    await expect(P.locator('[data-when-card]')).toContainText('Date TBD');
    await expect(P.locator('[data-when-card]')).toContainText('Location TBD');
    await P.locator('[data-host-tasks-bar]').click();
    for (const t of ['Pick a date', 'Pick a location', 'Add basic details']) await expect(P.locator('[data-screen-label="Your tasks"]')).toContainText(t);
    // A task opens its pop-up; setting the place there closes that part
    await P.locator('[data-task-row]', { hasText: 'Pick a location' }).click();
    const when = page.getByRole('dialog', { name: 'Date, time & location' });
    await when.getByLabel('Location').fill('The garage');
    await when.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(P.locator('[data-tbd]')).toContainText('1 thing left to decide');
    await expect(P.locator('[data-when-card]')).toContainText('The garage');
    // The Calendar lists it last, under "Date TBD"
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
    const card = page.locator('[data-screen-label=Calendar] [data-plan="' + title.charAt(0).toUpperCase() + title.slice(1) + '"]');
    await expect(card).toContainText('Date TBD');
    await expect(page.locator('[data-screen-label=Calendar]')).toContainText('Date TBD');
    expect(errors).toEqual([]);
  } finally {
    if (id) await asUser(page, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    await context.close();
  }
});

test('polls: the host posts a date poll, a member votes, the host picks the winner', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Hope');
  const member = await newLead(browser, 2, 'Omar');
  const H = host.page, O = member.page;
  const title = uniqueTitle('Game night');
  let id;
  try {
    await startPost(H);
    const flow = H.locator('[data-screen-label="New spark"]');
    await flow.getByLabel('Event title').fill(title);
    await flow.getByRole('button', { name: 'Next' }).click();
    await flow.getByText('Poll the group').click();
    const poll = H.getByRole('dialog', { name: 'Poll the group' });
    await expect(poll).toContainText('Create a poll');
    await expect(poll.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await poll.getByLabel('Date option 1').fill(inDays(15));
    // The same date twice is refused (it used to make posting fail)
    await poll.getByLabel('Date option 2').fill(inDays(15));
    await poll.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(H.getByText('Two options are the same date and time. Change or remove one.')).toBeVisible();
    await poll.getByLabel('Date option 2').fill(inDays(16));
    await poll.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(flow.locator('[data-poll]')).toContainText('POLL · 2 OPTIONS');
    await expect(flow).toContainText('2 of 5');                                  // saving doesn't move on
    await flow.getByRole('button', { name: 'Next' }).click();
    for (let i = 0; i < 3; i++) await flow.getByText('Decide later', { exact: true }).click();
    await expect(flow).toContainText('Poll: 2 dates');
    await flow.getByRole('button', { name: 'Post it' }).click();
    await expect(H.locator('[data-screen-label="Plan page"]')).toBeVisible();
    id = await H.evaluate(() => location.hash.split('/').pop());

    await openIdea(O, id);
    const OP = O.locator('[data-screen-label="Plan page"]');
    await expect(OP.locator('[data-when-card]')).toContainText('VOTING ON A DATE');
    const first = OP.locator('[data-poll-opt]').first();
    await first.getByRole('button', { name: 'Vote' }).click();
    await expect(first).toContainText('✓ Voted');
    await expect(first).toContainText('1 vote');

    await H.reload();
    const HP = H.locator('[data-screen-label="Plan page"]');
    const top = HP.locator('[data-poll-opt]').first();
    await expect(top).toContainText('1 vote');
    // The task goes to the poll's votes, not a blank date field
    await HP.locator('[data-host-tasks-bar]').click();
    await HP.locator('[data-task-row]', { hasText: 'Pick the winning date' }).click();
    await expect(H.getByRole('dialog', { name: 'Date, time & location' })).toHaveCount(0);
    await expect(HP.locator('[data-when-card]')).toBeInViewport();
    await top.getByRole('button', { name: 'Pick' }).click();
    await confirm(H, 'Use this date');   // it asks first: picking closes the poll
    await expect(HP.locator('[data-when-card]')).not.toContainText('VOTING ON A DATE');
    await expect(HP.locator('[data-tbd]')).toContainText('1 thing left to decide');   // only the place now
    expect(host.errors).toEqual([]);
    expect(member.errors).toEqual([]);
  } finally {
    if (id) await asUser(H, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    await host.context.close();
    await member.context.close();
  }
});

test('drafts: X saves one, Your tasks lists it, Continue picks up there, posting removes it', async ({ browser }) => {
  test.setTimeout(90000);
  const { page, context, errors } = await newLead(browser, 2, 'Guard');
  const title = uniqueTitle('Yard sale');
  let id;
  try {
    await startPost(page);
    const flow = page.locator('[data-screen-label="New spark"]');
    await flow.getByLabel('Event title').fill(title);
    await flow.getByRole('button', { name: 'Next' }).click();
    await flow.getByText('Decide later', { exact: true }).click();
    await flow.getByRole('button', { name: 'Close' }).click();
    const leave = page.getByRole('dialog', { name: 'Save as draft' });
    await expect(leave).toContainText('Save this as a draft?');
    await leave.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Saved as a draft')).toBeVisible();

    const draft = page.locator('[data-screen-label="Your tasks"] [data-draft="' + title + '"]');
    await expect(draft).toContainText('DRAFT');
    await expect(draft).toContainText('Up next: Location');
    await draft.getByRole('button', { name: 'Continue' }).click();
    await expect(flow).toContainText('3 of 5');
    for (let i = 0; i < 3; i++) await flow.getByText('Decide later', { exact: true }).click();
    await flow.getByRole('button', { name: 'Post it' }).click();
    await expect(page.locator('[data-screen-label="Plan page"]')).toBeVisible();
    id = await page.evaluate(() => location.hash.split('/').pop());
    const left = await asUser(page, async (c) => (await c.from('event_drafts').select('id')).data.length);
    expect(left).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    if (id) await asUser(page, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    await asUser(page, async (c) => { await c.from('event_drafts').delete().neq('id', '00000000-0000-0000-0000-000000000000'); }).catch(() => {});
    await context.close();
  }
});

test('location suggestions: 2 letters, 4 rows, Austin area, remembered, free text still works', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Tester');
  try {
    await startPost(page);
    const flow = page.locator('[data-screen-label="New spark"]');
    await flow.getByLabel('Event title').fill('Anything');
    await flow.getByRole('button', { name: 'Next' }).click();
    await flow.getByText('Decide later', { exact: true }).click();

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
