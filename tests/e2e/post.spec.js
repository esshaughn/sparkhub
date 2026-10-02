// Create event (v6 Update 6): the 5-step flow with "Decide later", polls, jobs, Review, drafts,
// then the host's edit pop-ups on the event page.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, button, postEvent, openIdea, confirm, startPost, asUser, closeAskFirst, pickKind } = require('./helpers');

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
    // Only the lead is going (20261101160000_lead_going.sql): they get a nudge to share, not "Be the first"
    await expect(P.locator('[data-going-empty]')).toContainText('Just you so far. Share the link');
    await expect(P.locator('[data-chip]')).toHaveText('YOU’RE LEADING');
    await expect(page.locator('[data-test-tab]')).toHaveCount(0);   // a real event: no Test event tab
    await expect(P).toContainText('5:30pm');
    await expect(P).toContainText('Zilker Metropolitan Park');
    await expect(P).toContainText('2100 Barton Springs Road, Austin, TX 78746');
    await expect(P.locator('[data-basics]')).toContainText('Tacos after');
    await expect(P.locator('[data-basics]')).toContainText('Bring headlamps');
    await expect(P.locator('[data-signup="Bring water"]')).toContainText('0/3');
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

    // Edit event: a round pencil by Share (owner, 2026-10-01), no pencil after the title; the host gets the photo too
    await expect(P.locator('h1 svg')).toHaveCount(0);
    await P.getByRole('button', { name: 'Edit event' }).click();
    const sec = page.getByRole('dialog', { name: 'Edit event' });
    await expect(sec.locator('[data-edit-photo]')).toBeVisible();
    await expect(sec.getByRole('switch', { name: 'Tell everyone going' })).toHaveCount(0);   // a new title saves quietly
    await expect(sec.getByLabel(/^(Replace the|Add a) cover photo$/)).toHaveCount(1);
    await sec.getByLabel('Event title').fill(title + ' + stars');
    await sec.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(sec).toHaveCount(0);
    await expect(P.locator('h1')).toContainText('+ stars');

    // Basic details pop-up
    await P.getByRole('button', { name: 'Edit details' }).click();
    const bd = page.getByRole('dialog', { name: 'Details' });
    await bd.getByLabel('Details, line 3').fill('Hot cocoa');
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
    await expect(P.locator('[data-signup="Bring cold water"]')).toContainText('0/4');
    await expect(P.locator('[data-signup="Folding chairs"]')).toContainText('0/2');

    // Invite people (one sheet; Share link is gone): the ready message, copy, and the share intents
    await expect(P.getByRole('button', { name: 'Share link' })).toHaveCount(0);
    await P.getByRole('button', { name: /Invite people/ }).click();
    const share = page.getByRole('dialog', { name: 'Invite people' });
    // The ready message rides in the share links (the sheet shows people to invite, then "or share a link")
    const sms = decodeURIComponent(await share.getByRole('link', { name: 'Messages' }).getAttribute('href'));
    expect(sms).toContain('I’m putting together');
    expect(sms).toContain('Want to come?');
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
    // Real or test? comes first, in a pop-up with no default; backing out of it leaves Create event (owner, 2026-10-01)
    const ask = page.getByRole('dialog', { name: 'Real or test?' });
    await expect(ask.getByRole('button', { name: /^Real event/ })).toHaveAttribute('aria-pressed', 'false');
    await ask.getByText('Never mind', { exact: true }).click();
    await expect(page.locator('[data-screen-label=Calendar]')).toBeVisible();
    await startPost(page);
    await ask.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('[data-screen-label=Calendar]')).toBeVisible();
    await startPost(page);
    await pickKind(page, true);
    await expect(flow).toContainText('1 of 5');
    await expect(flow).toContainText('Your event');
    await expect(flow.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true');
    await expect(flow.getByText('Decide later', { exact: true })).toHaveCount(0);   // the title can't wait
    // With no title, X just closes
    await flow.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('[data-screen-label=Calendar]')).toBeVisible();

    await startPost(page);
    await pickKind(page, true);
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
    for (const t of ['Date TBD', 'Location TBD', 'Details to be decided', 'Help to be decided']) await expect(flow).toContainText(t);
    // Add / Edit on Review comes straight back to Review, not through the later steps
    await flow.getByLabel('Add details').click();
    await expect(flow).toContainText('4 of 5');
    await flow.getByLabel('Details, line 1').fill('Bring a bowl');
    await flow.getByRole('button', { name: 'Back to review' }).click();
    await expect(flow).toContainText('LOOKS GOOD');
    await expect(flow).toContainText('Bring a bowl');
    await flow.getByLabel('Edit details').click();
    await flow.getByLabel('Details, line 1').fill('');
    await flow.getByText('Decide later', { exact: true }).click();
    await expect(flow).toContainText('Details to be decided');
    // No date: it goes up as an idea, not a plan
    await expect(flow.locator('[data-posts-as]')).toContainText('It goes up as an idea');
    await expect(flow).toContainText('Just testing');   // Review shows the choice from the pop-up
    // Edit reopens the pop-up; closing it there keeps the choice and stays in Create event
    await flow.getByRole('button', { name: 'Edit real or test' }).click();
    await expect(page.getByRole('dialog', { name: 'Real or test?' }).getByRole('button', { name: /^Just testing/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('dialog', { name: 'Real or test?' }).getByRole('button', { name: 'Close' }).click();
    await expect(flow).toContainText('Just testing');
    await flow.getByRole('button', { name: 'Post it' }).click();
    const I = page.locator('[data-screen-label="Idea page"]');
    await expect(I).toBeVisible();
    id = await page.evaluate(() => location.hash.split('/').pop());
    // A test event carries the DEMO chip and is saved as a test (not as seeded demo content)
    await expect(I.locator('[data-demo-tag]').first()).toBeVisible();
    // ...and a gold Test event tab hanging from the top, still there after scrolling (owner, 2026-10-01)
    const testTab = page.locator('[data-test-tab] [role=note]');
    await expect(testTab).toHaveText('Test event');
    await page.locator('.scroller').evaluate(el => el.scrollTo(0, 500));
    expect((await testTab.boundingBox()).y).toBeLessThan(4);
    await page.locator('.scroller').evaluate(el => el.scrollTo(0, 0));
    expect(await asUser(page, async (c, _C, id) => (await c.from('sparks').select('test,demo').eq('id', id).single()).data, id)).toEqual({ test: true, demo: false });
    await expect(I).toContainText('Pick a date first. Then you can lock it in.');
    await expect(I.getByRole('button', { name: 'Make it a plan' })).toHaveAttribute('aria-disabled', 'true');
    // Empty Details and Help out are the same dashed box for the host
    await expect(I.locator('[data-basics]')).toContainText('Add up to three quick notes on what to expect.');
    await expect(I.locator('[data-help-empty]')).toHaveText('Add ways people can help.');
    await I.locator('[data-help-empty]').click();
    await expect(page.getByRole('dialog', { name: 'Edit what you need' })).toBeVisible();
    await page.keyboard.press('Escape');
    // Not on the Calendar until the host makes it a plan
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
    await expect(page.locator('[data-screen-label=Calendar]')).toBeVisible();
    await expect(page.locator('[data-screen-label=Calendar] [data-plan="' + title.charAt(0).toUpperCase() + title.slice(1) + '"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    if (id) await asUser(page, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    await context.close();
  }
});

test('polls: the host posts a date poll (an idea), a member votes, the host picks the winner and makes it a plan', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Hope');
  const member = await newLead(browser, 2, 'Omar');
  const H = host.page, O = member.page;
  const title = uniqueTitle('Game night');
  let id;
  try {
    await startPost(H);
    const flow = H.locator('[data-screen-label="New spark"]');
    await pickKind(H);
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
    await expect(flow.locator('[data-posts-as]')).toContainText('It goes up as an idea');

    await flow.getByRole('button', { name: 'Post it' }).click();
    await expect(H.locator('[data-screen-label="Idea page"]')).toBeVisible();
    await closeAskFirst(H);
    id = await H.evaluate(() => location.hash.split('/').pop());

    await openIdea(O, id);
    const OI = O.locator('[data-screen-label="Idea page"]');
    await OI.getByRole('button', { name: /^Vote for .*\(0 votes, suggested by / }).first().click();
    await expect(OI.getByRole('button', { name: /^Remove your vote for .*\(1 vote, suggested by / })).toHaveCount(1);

    // The host picks the winner, then locks it in
    await H.reload();
    const HI = H.locator('[data-screen-label="Idea page"]');
    await HI.getByRole('button', { name: /^Pick .*\(1 vote, suggested by / }).click();
    await confirm(H, 'Use this date');
    await expect(HI).toContainText('Ready when you are');
    await HI.getByRole('button', { name: 'Make it a plan' }).click();
    await confirm(H, 'Make it a plan');
    await expect(H.locator('[data-screen-label="Plan page"]')).toBeVisible();

    // A plan keeps its date: clearing it can't be saved; turning it back into an idea takes it off
    await H.getByLabel('Edit date, time and location').click();
    const when = H.getByRole('dialog', { name: 'Date, time & location' });
    await when.getByLabel('Date', { exact: true }).fill('');
    await expect(when.locator('[data-needs-date]')).toBeVisible();
    await expect(when.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await when.locator('[data-back-to-idea]').click();
    await confirm(H, 'Back to an idea');
    await expect(HI).toBeVisible();
    await expect(HI).toContainText('Pick a date first. Then you can lock it in.');
    expect(host.errors).toEqual([]);
    expect(member.errors).toEqual([]);
  } finally {
    if (id) await asUser(H, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    await host.context.close();
    await member.context.close();
  }
});

test('drafts: X saves one, Your tasks lists it under Leading, Continue picks up there, posting removes it', async ({ browser }) => {
  test.setTimeout(90000);
  const { page, context, errors } = await newLead(browser, 2, 'Guard');
  const title = uniqueTitle('Yard sale');
  let id;
  try {
    await startPost(page);
    const flow = page.locator('[data-screen-label="New spark"]');
    await pickKind(page);
    await flow.getByLabel('Event title').fill(title);
    await flow.getByRole('button', { name: 'Next' }).click();
    await flow.getByText('Decide later', { exact: true }).click();
    await flow.getByRole('button', { name: 'Close' }).click();
    const leave = page.getByRole('dialog', { name: 'Save as draft' });
    await expect(leave).toContainText('Save this as a draft?');
    await leave.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Saved as a draft')).toBeVisible();

    // Drafts sit in Your tasks' Leading row (and its View all), not in a list of their own
    const leading = page.locator('[data-screen-label="Your tasks"] section[aria-label="Leading"]');
    await leading.getByRole('button', { name: 'View all leading' }).click();
    const all = page.getByRole('dialog', { name: 'Leading' });
    await expect(all.locator('[data-draft-all="' + title + '"]')).toContainText('Up next: Location');
    await all.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('[aria-label="Your drafts"]')).toHaveCount(0);
    // ...and not on Your schedule either (owner, 2026-10-01)
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Your schedule', exact: true }).click();
    await expect(page.locator('[data-screen-label="Your schedule"]')).toBeVisible();
    await expect(page.locator('[aria-label="Your drafts"]')).toHaveCount(0);
    await expect(page.locator('[data-screen-label="Your schedule"] [data-draft]')).toHaveCount(0);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Your tasks/ }).click();
    const draft = leading.locator('[data-draft="' + title + '"]');
    await expect(draft).toContainText('DRAFT');
    await expect(draft).toContainText('Up next: Location');
    await draft.getByRole('button', { name: 'Continue' }).click();
    await expect(flow).toContainText('3 of 5');
    for (let i = 0; i < 3; i++) await flow.getByText('Decide later', { exact: true }).click();
    await flow.getByRole('button', { name: 'Post it' }).click();
    await expect(page.locator('[data-screen-label="Idea page"]')).toBeVisible();   // no date: an idea
    await closeAskFirst(page);
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
    await pickKind(page);
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

test('an idea says how many it needs; a bare starter chip can’t be saved; its steps are Date · Location · Details · People', async ({ browser }) => {
  test.setTimeout(90000);
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  const title = uniqueTitle('Pickup soccer');
  let id;
  try {
    await startPost(page);
    const flow = page.locator('[data-screen-label="New spark"]');
    await pickKind(page);
    await flow.getByLabel('Event title').fill(title);
    await flow.getByRole('button', { name: 'Next' }).click();
    await flow.getByText('Decide later', { exact: true }).click();   // no date: it goes up as an idea
    await flow.getByText('Decide later', { exact: true }).click();
    // A Details line holds up to 60 characters and stays one line, sentences and all (owner, 2026-10-01)
    await expect(flow.getByLabel('Details, line 1')).toHaveAttribute('maxlength', '60');
    await flow.getByLabel('Details, line 1').fill('Bring cleats. And water?');
    await expect(flow.locator('[data-tags]')).toHaveCount(0);   // no "What kind of event?" (owner, 2026-10-01)
    const need = flow.locator('[data-need-people]');
    await expect(need).toContainText('Optional');
    for (let i = 0; i < 6; i++) await need.getByRole('button', { name: 'More for how many people needed' }).click();
    await expect(need).toContainText('It’s a go once 6 people are in.');
    await flow.getByRole('button', { name: 'Next' }).click();
    // A starter chip alone ("Bring") can't be saved
    await flow.getByRole('button', { name: /Bring$/ }).click();
    const job = page.getByRole('dialog', { name: 'Add a job' });
    await expect(job.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await job.getByLabel('Job name').fill('Bring a ball');
    await job.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(flow).not.toContainText('FOR EXAMPLE');
    await flow.getByRole('button', { name: 'Review' }).click();

    await flow.getByRole('button', { name: 'Post it' }).click();
    await expect(page.locator('[data-screen-label="Idea page"]')).toBeVisible();
    await closeAskFirst(page);
    id = await page.evaluate(() => location.hash.split('/').pop());
    const steps = page.getByLabel('Steps to a plan');
    for (const t of ['Date', 'Location', 'Details', 'People']) await expect(steps).toContainText(t);
    await expect(page.locator('[data-basics] span', { hasText: 'Bring cleats. And water?' })).toHaveCount(1);   // one line, not two
    const saved = await asUser(page, async (c, _C, id) => (await c.from('sparks').select('min_people').eq('id', id).single()).data.min_people, id);
    expect(saved).toBe(6);
    const savedTags = await asUser(page, async (c, _C, id) => (await c.from('sparks').select('tags').eq('id', id).single()).data.tags, id);
    expect(savedTags).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    if (id) await asUser(page, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    await context.close();
  }
});
