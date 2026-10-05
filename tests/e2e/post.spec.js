// Create event (v6 Update 6): the 5-step flow with "Decide later", polls, jobs, Review, drafts,
// then the host's edit pop-ups on the event page.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, button, postEvent, openIdea, confirm, startPost, asUser, closeAskFirst, pickKind, pickDate, pickTime, deleteIdea, ideaIdFromUrl, openAllGroups } = require('./helpers');

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
    // The RSVP card (Design 25b + 25c): the going faces with See all ›, and the lead's Invite people; Who's in is now Visibility
    await expect(P.locator('[data-rsvp] [data-going]')).toContainText('See all ›');
    await expect(P.locator('[data-rsvp]').getByRole('button', { name: 'Invite people' })).toBeVisible();
    // Event updates, one way (Design 29): the lead's Post an update under Invite people; no card until there's one
    await expect(P.locator('[data-updates]')).toHaveCount(0);
    await P.locator('[data-rsvp]').getByRole('button', { name: 'Post an update' }).click();
    const comp = page.getByRole('dialog', { name: 'Post an update' });
    await comp.locator('[data-upd-chip]', { hasText: 'Bring ___' }).click();
    await expect(comp.getByLabel('Your update')).toHaveValue('Bring ');
    await comp.getByLabel('Your update').fill('Bring a headlamp, it gets dark early');
    await expect(comp).toContainText('36/200');
    await expect(comp.getByRole('radio', { name: 'Going', exact: true })).toHaveAttribute('aria-checked', 'true');
    await comp.getByRole('radio', { name: 'Going and Maybe' }).click();
    await expect(comp).toContainText('Everyone going or maybe gets a notification.');
    await comp.getByRole('button', { name: 'Post update' }).click();
    await expect(page.getByText('Posted. No one else is coming yet')).toBeVisible();   // nobody else has replied
    // Updates live in Discussion (v8): the lead's together in a gray panel, newest first, each with UPDATE
    const upd = P.locator('[data-discussion] [data-updates]');
    await expect(upd).toContainText('UPDATE');
    await expect(upd.locator('[data-update]')).toHaveText(['Bring a headlamp, it gets dark early']);
    // A second, then the third within the hour asks first
    for (const [text, third] of [['Parking is on Barton Springs Rd', false], ['Meet at the big oak', true]]) {
      await P.locator('[data-rsvp]').getByRole('button', { name: 'Post an update' }).click();
      await comp.getByLabel('Your update').fill(text);
      await comp.getByRole('button', { name: 'Post update' }).click();
      if (third) {
        const guard = page.getByRole('alertdialog');
        await expect(guard).toContainText('That’s your third update this hour');
        await guard.getByRole('button', { name: 'Post anyway' }).click();
      }
      await expect(upd.locator('[data-update]').first()).toHaveText(text);
    }
    await expect(upd.locator('[data-update]')).toHaveCount(3);
    await expect(P.locator('[data-upd-banner]')).toHaveCount(0);   // leads never get the banner
    await upd.locator('[data-post-row="upd"]', { hasText: 'Parking' }).getByRole('button', { name: 'Delete this update' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete update' }).click();
    await expect(upd.locator('[data-update]')).toHaveText(['Meet at the big oak', 'Bring a headlamp, it gets dark early']);
    await expect(P.getByRole('heading', { name: 'Visibility' })).toBeVisible();
    await expect(P.locator('[data-chip]')).toHaveText('YOU’RE LEADING');
    await expect(page.locator('[data-test-tab]')).toHaveCount(0);   // a real event: no Test event tab
    await expect(P).toContainText('5:30pm');
    await expect(P).toContainText('Zilker Metropolitan Park');
    await expect(P).toContainText('2100 Barton Springs Road, Austin, TX 78746');
    await expect(P.locator('[data-basics]')).toContainText('Tacos after');
    await expect(P.locator('[data-basics]')).toContainText('Bring headlamps');
    await expect(P.locator('[data-signup="Bring water"]')).toContainText('3 of 3 open');
    await expect(P).not.toContainText('Before the day');
    await expect(P).not.toContainText('Remind everyone the day before');
    await expect(P.locator('[data-tbd]')).toHaveCount(0);                 // nothing left to decide
    await expect(P.locator('[data-vis]')).toContainText('Public');
    await expect(P.locator('[data-vis]')).toContainText('Torrez Fitness');

    // The cover was uploaded and is served
    const url = await page.evaluate(() => getComputedStyle(document.querySelector('[data-screen-label="Plan page"] > div > div[aria-hidden]')).backgroundImage.match(/url\("([^"]+)"/)[1]);
    expect((await page.request.get(url)).status()).toBe(200);

    // Your tasks (purple): only the job still to fill is left (owner, 2026-10-02: one task per job)
    // Open to start, header on top (Design 27); tapping the header folds it to a count
    const bar = P.locator('[data-host-tasks-bar]');
    await expect(P.locator('[data-screen-label="Your tasks"]')).toContainText('Fill 3 spots: Bring water');
    await bar.click();
    await expect(bar).toContainText('1 task');
    await expect(P.locator('[data-screen-label="Your tasks"]')).not.toContainText('Bring water');

    // Edit event: a round pencil by Share (owner, 2026-10-01), no pencil after the title and the title isn't a button (Design 31)
    await expect(P.locator('h1 svg')).toHaveCount(0);
    await expect(P.locator('h1[data-on]')).toHaveCount(0);
    await P.getByRole('button', { name: 'Edit event' }).click();
    const sec = page.getByRole('dialog', { name: 'Edit event' });
    await expect(sec.locator('[data-edit-photo]')).toBeVisible();
    await expect(sec.getByRole('switch', { name: 'Tell everyone going' })).toHaveCount(0);   // edits save quietly (Design 30)
    await expect(sec.locator('[data-sec-delete]')).toHaveText('Cancel or delete event');   // under Save, the lead's
    await expect(sec.getByLabel(/^(Replace the|Add a) cover photo$/)).toHaveCount(1);
    await expect(sec.getByRole('button', { name: 'Remove the cover photo' })).toBeVisible();   // the cover can come off (owner, 2026-10-02)
    await sec.getByLabel('Event title').fill(title + ' + stars');
    await sec.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(sec).toHaveCount(0);
    await expect(P.locator('h1')).toContainText('+ stars');

    // What to expect (Design 8a): a one-line overview over the details
    await expect(P.getByRole('heading', { name: 'What to expect' })).toBeVisible();
    await P.getByRole('button', { name: 'Edit what to expect' }).click();
    const bd = page.getByRole('dialog', { name: 'What to expect' });
    await expect(bd.getByLabel('One-line overview')).toHaveAttribute('maxlength', '80');
    await bd.getByLabel('One-line overview').fill('A night run under the stars');
    await bd.getByLabel('Details, line 3').fill('Hot cocoa');
    await bd.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(P.locator('[data-basics]')).toContainText('Hot cocoa');
    await expect(P.locator('[data-basics] [data-overview]')).toHaveText('A night run under the stars');
    expect(await asUser(page, async (c, _C, id) => (await c.from('sparks').select('overview').eq('id', id).single()).data.overview, id)).toBe('A night run under the stars');

    // Who can see it: Private
    await P.getByRole('button', { name: 'Edit who can see it' }).click();
    const vis = page.getByRole('dialog', { name: 'Who can see it' });
    await vis.getByRole('radio', { name: /^Private/ }).click();
    await vis.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(P).toContainText('PRIVATE');
    await expect(P.locator('[data-vis]')).toContainText('Private');

    // Edit what you need (the job's ✎; Design 12e): rename the job and ask for one more
    await expect(P.getByRole('button', { name: 'Edit what you need' })).toHaveCount(0);   // no Edit link on the section
    await P.locator('[data-signup="Bring water"] [data-edit-jobs]').click();
    const needs = page.getByRole('dialog', { name: 'Edit what you need' });
    await needs.getByLabel('Job name 1').fill('Bring cold water');
    await needs.getByRole('button', { name: 'More for how many people' }).click();
    // A job that arrives while the sheet is open (another device, or the sheet opened on cached data) survives Save
    await asUser(page, async (c, _C, id) => { await c.from('signup_items').insert({ spark_id: id, item: 'Folding chairs', need: 2 }); }, id);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));   // the background refresh
    await expect(P.locator('[data-signup="Folding chairs"]')).toHaveCount(1);
    await needs.getByRole('button', { name: 'Save changes' }).click();
    await expect(needs).toHaveCount(0);
    await expect(P.locator('[data-signup="Bring cold water"]')).toContainText('4 of 4 open');
    await expect(P.locator('[data-signup="Folding chairs"]')).toContainText('2 of 2 open');

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
    // v8: no Real or test; the title step first, Create event in the sparkle header, the field focused
    await expect(page.getByRole('dialog', { name: 'Real or test?' })).toHaveCount(0);
    await expect(flow).toContainText('1/6');
    await expect(flow).toContainText('Create event');
    await expect(flow.getByLabel('Event title')).toBeFocused();
    await expect(flow.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true');
    await flow.getByRole('button', { name: 'Next' }).click({ force: true });   // gray, but a tap says what's missing (v8)
    await expect(page.getByRole('status')).toContainText('Add a title first');
    await expect(flow.getByText('Decide later', { exact: true })).toHaveCount(0);   // the title can't wait
    // I'll lead it / Float the idea sit at the bottom of the title step (the Lead step is gone), I'll lead it picked
    await expect(flow.getByRole('button', { name: /^I’ll lead it/ })).toHaveAttribute('aria-pressed', 'true');
    await flow.getByText('What’s the difference?', { exact: true }).click();
    const why = page.getByRole('dialog', { name: 'Lead it or float it?' });
    await expect(why).toContainText('It goes up as an idea that needs a lead.');
    await why.getByRole('button', { name: 'Got it' }).click();
    await expect(why).toHaveCount(0);
    // With no title, X just closes
    await flow.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('[data-screen-label="Your calendar"]')).toBeVisible();

    await startPost(page);
    await flow.getByLabel('Event title').fill(title);
    await expect(flow.getByLabel('Event title')).toHaveAttribute('maxlength', '40');
    await expect(flow).toContainText(title.length + '/40');
    // The phone's Back with a title asks about a draft instead of dropping it
    await page.goBack();
    const leave = page.getByRole('dialog', { name: 'Save as draft' });
    await expect(leave).toContainText('Save this as a draft?');
    await leave.getByRole('button', { name: 'Keep going' }).click();
    await expect(flow.getByLabel('Event title')).toHaveValue(title);
    await flow.getByRole('button', { name: 'Next' }).click();
    // …and on a later step it goes back a step
    await page.goBack();
    await expect(flow).toContainText('1/6');
    await flow.getByRole('button', { name: 'Next' }).click();
    // Date & time: the start list, then an end time that only offers later times
    await expect(flow).toContainText('Date & time');
    await pickDate(flow, inDays(10));
    await flow.getByRole('button', { name: 'Add a start time (optional)' }).click();
    await expect(flow.locator('[data-time-list] [data-hour]')).toHaveCount(12);   // the tap grid: am / pm, hour, minute (owner, 2026-10-03)
    await pickTime(flow, '18:00');
    await flow.getByText('Add end time').click();
    await flow.locator('[data-time-list]').getByRole('radio', { name: 'pm', exact: true }).click();
    await expect(flow.locator('[data-time-list] [data-hour="5"]')).toHaveAttribute('aria-disabled', 'true');
    await pickTime(flow, '20:00');
    // Decide later only shows while the step is empty, so it can't wipe what's filled in
    await expect(flow.getByText('Decide later', { exact: true })).toHaveCount(0);
    await pickDate(flow, '');
    await flow.getByText('Decide later', { exact: true }).click();   // clears the leftover times too
    await expect(flow).toContainText('3/6');
    await flow.getByRole('button', { name: 'Back' }).click();
    await expect(flow.getByRole('button', { name: 'Date', exact: true })).toContainText('Pick a date');
    await expect(flow.getByRole('button', { name: 'Add a start time (optional)' })).toBeVisible();
    await flow.getByText('Decide later', { exact: true }).click();
    for (const n of ['3/6', '4/6']) {
      await expect(flow).toContainText(n);
      await expect(flow.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'true');
      await flow.getByText('Decide later', { exact: true }).click();
    }
    // Join in (v8): no Decide later; gray Next says Choose an option; None needed skips. PARTICIPATE waits for Take part
    await expect(flow).toContainText('5/6');
    await expect(flow).toContainText('Join in');
    await expect(flow).toContainText('Ask for help or list specific ways to participate.');
    await expect(flow.getByText('Decide later', { exact: true })).toHaveCount(0);
    await expect(flow.getByText('Claim time')).toHaveCount(0);
    await flow.getByRole('button', { name: 'Next' }).click({ force: true });
    await expect(page.getByRole('status')).toContainText('Choose an option');
    await flow.getByText('None needed', { exact: true }).click();
    // Review (19f): REVIEW over the title, the lead card, then Details · What to expect · Join in, blanks in gray
    await expect(flow).toContainText('REVIEW');
    await expect(flow).toContainText('6/6');
    await expect(flow.locator('[data-review-lead]')).toContainText('You’re leading it');
    for (const t of ['No date yet', 'No location yet', 'Nothing added.', 'None needed']) await expect(flow).toContainText(t);
    for (const k of ['when', 'details', 'help']) await expect(flow.locator('[data-review-edit="' + k + '"]')).toHaveText('Edit');
    await expect(flow).not.toContainText('Real or test');
    await flow.locator('[data-review-edit="details"]').click();
    const pop = page.getByRole('dialog', { name: 'What to expect' });
    await expect(flow).toContainText('REVIEW');   // still on Review, under the pop-up
    await pop.getByLabel('Details, line 1').fill('Bring a bowl');
    await pop.getByRole('button', { name: 'Done' }).click();
    await expect(pop).toHaveCount(0);
    await expect(flow).toContainText('Bring a bowl');
    await flow.locator('[data-review-edit="details"]').click();
    await pop.getByLabel('Details, line 1').fill('');
    await pop.getByRole('button', { name: 'Close' }).click();
    await expect(flow).not.toContainText('Bring a bowl');
    // Date & time in its pop-up: a start time's list opens inside it
    await flow.locator('[data-review-edit="when"]').click();
    const whenPop = page.getByRole('dialog', { name: 'Date & time' });
    await expect(whenPop).toContainText('Pick a date');
    await expect(whenPop).toContainText('Poll the group');
    await whenPop.getByRole('button', { name: 'Done' }).click();
    await expect(flow).toContainText('No date yet');
    // The title is edited in place in the header, and can't be left empty
    const before = await flow.locator('[data-review-title]').innerText();
    await flow.getByRole('button', { name: 'Edit title' }).click();
    const inline = flow.locator('[data-title-inline]');
    await expect(inline).toBeFocused();
    await inline.fill('');
    await inline.press('Enter');
    await expect(page.getByText('Add a title first')).toBeVisible();
    await expect(inline).toBeVisible();
    await inline.fill(before + ' 2');
    await inline.press('Enter');
    await expect(inline).toHaveCount(0);
    await expect(flow.locator('[data-review-title]')).toHaveText(before + ' 2');
    // No date: it goes up as an idea, not a plan
    await expect(flow.locator('[data-posts-as]')).toContainText('This goes up as an idea');
    await flow.locator('[data-post]').click();
    const I = page.locator('[data-screen-label="Idea page"]');
    await expect(I).toBeVisible();
    id = await page.evaluate(() => location.hash.split('/').pop());
    await closeAskFirst(page);
    // Every event is real now (v8): no DEMO chip, no Test event tab
    await expect(page.locator('[data-test-tab]')).toHaveCount(0);
    expect(await asUser(page, async (c, _C, id) => (await c.from('sparks').select('test,demo').eq('id', id).single()).data, id)).toEqual({ test: false, demo: false });
    await expect(I.locator('[data-plan-needs] [data-plan-row="date"]')).toBeVisible();
    await expect(I.getByRole('button', { name: /^Make it a plan/ })).toHaveCount(0);   // no locked button (Design, after Update 16)
    // Empty Details and Help out are the same dashed box for the host
    await expect(I.locator('[data-basics]')).toContainText('Add a one-line overview and up to three quick notes.');
    await expect(I.locator('[data-help-empty]')).toHaveText('Add ways people can help.');
    await I.locator('[data-help-empty]').click();
    await expect(page.getByRole('dialog', { name: 'Edit what you need' })).toBeVisible();
    await page.keyboard.press('Escape');
    // Not on the Calendar until the host makes it a plan
    await openAllGroups(page);
    await expect(page.locator('[data-screen-label="All groups"]')).toBeVisible();
    await expect(page.locator('[data-screen-label="All groups"] [data-plan="' + title.charAt(0).toUpperCase() + title.slice(1) + '"]')).toHaveCount(0);
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
    await pickDate(poll, inDays(15), 'Date option 1');
    // The same date twice is refused (it used to make posting fail)
    await pickDate(poll, inDays(15), 'Date option 2');
    await poll.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(H.getByText('Two options are the same date and time. Change or remove one.')).toBeVisible();
    // The pop-up opens tall, so the calendar under an option isn't cut off by its edge
    await poll.getByRole('button', { name: 'Date option 2', exact: true }).click();
    const cal = await poll.locator('[data-calendar]').boundingBox(), edge = await poll.boundingBox();
    expect(cal.y + cal.height).toBeLessThanOrEqual(edge.y + edge.height);
    await poll.locator('[data-day="' + inDays(15) + '"]').click();
    // The time is the app's own list, like the calendar (not the browser's menu); No time clears it
    await poll.getByRole('button', { name: 'Time option 1' }).click();
    await pickTime(poll, '18:00');
    await expect(poll.getByRole('button', { name: 'Time option 1' })).toContainText('6:00pm');
    await poll.getByRole('button', { name: 'Time option 1' }).click();
    await poll.locator('[data-time-list]').getByRole('button', { name: 'No time', exact: true }).click();
    await expect(poll.getByRole('button', { name: 'Time option 1' })).toContainText('Time');
    await pickDate(poll, inDays(16), 'Date option 2');
    await poll.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(flow.locator('[data-poll]')).toContainText('POLL · 2 OPTIONS');
    await expect(flow).toContainText('2/6');                                  // saving doesn't move on
    await flow.getByRole('button', { name: 'Next' }).click();
    for (let i = 0; i < 2; i++) await flow.getByText('Decide later', { exact: true }).click();
    await flow.getByText('None needed', { exact: true }).click();   // Join in: None needed goes on to Review
    await expect(flow).toContainText('Poll: 2 dates');
    await expect(flow.locator('[data-posts-as]')).toContainText('This goes up as an idea');

    await flow.locator('[data-post]').click();
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
    // A lead and a date are all it takes (owner, 2026-10-02): no location or details yet, and Make it a plan! is there
    await expect(HI.locator('[data-plan-needs]')).toHaveCount(0);
    await expect(HI.getByLabel('Steps to a plan').locator('[data-make-plan]')).toContainText('Make it a plan!');   // in the gold strip (owner's mock, 2026-10-01)
    await HI.getByRole('button', { name: 'Make it a plan' }).click();
    await confirm(H, 'Make it a plan');
    await expect(H.locator('[data-screen-label="Plan page"]')).toBeVisible();

    // A plan keeps its date: clearing it can't be saved; turning it back into an idea takes it off
    await H.getByLabel('Edit date, time and location').click();
    const when = H.getByRole('dialog', { name: 'Date, time & location' });
    await pickDate(when, '');
    await expect(when.locator('[data-needs-date]')).toBeVisible();
    await expect(when.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await when.locator('[data-back-to-idea]').click();
    await confirm(H, 'Back to an idea');
    await expect(HI).toBeVisible();
    await expect(HI.locator('[data-plan-needs] [data-plan-row="date"]')).toBeVisible();
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

    // Drafts live in Me → YOUR STUFF → Drafts (v8), not on My calendar
    const openDraft = async () => {
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Me', exact: true }).click();
      await expect(page.locator('[data-stuff="Drafts"]')).toContainText(title);
      await page.locator('[data-stuff="Drafts"]').click();
      const list = page.getByRole('dialog', { name: 'Drafts' });
      await expect(list).toContainText(title);
      await list.getByRole('button', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    };
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
    await expect(page.locator('[data-screen-label="Your calendar"]')).toBeVisible();
    await expect(page.locator('[data-screen-label="Your calendar"] [data-draft]')).toHaveCount(0);
    await openDraft();
    await expect(flow).toContainText('3/6');
    await flow.getByText('Decide later', { exact: true }).click();
    // A Details line longer than the old 40 comes back whole from a draft (resuming used to cut it at 40)
    const longLine = 'Park on Elm Street and walk in through the side gate.';
    await flow.getByLabel('Details, line 1').fill(longLine);
    await flow.getByRole('button', { name: 'Close' }).click();
    await leave.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Saved as a draft')).toBeVisible();
    await openDraft();
    await expect(flow).toContainText('4/6');
    await expect(flow.getByLabel('Details, line 1')).toHaveValue(longLine);
    await flow.getByRole('button', { name: 'Next' }).click();
    await flow.getByText('None needed', { exact: true }).click();
    await flow.locator('[data-post]').click();
    await expect(page.locator('[data-screen-label="Idea page"]')).toBeVisible();   // no date: an idea
    await closeAskFirst(page);
    id = await page.evaluate(() => location.hash.split('/').pop());
    expect(await asUser(page, async (c, _C, id) => (await c.from('sparks').select('hopes').eq('id', id).single()).data.hopes, id)).toEqual([longLine]);
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

// Owner, 2026-10-02 (review fixes): a tab tap inside Create event asks about a draft (it used to drop the event), Return
// in the title presses Next, a greyed-out Next says what it's waiting for, and a reload brings the flow back where it
// was (phones drop the tab while people look something up)
test('Create event: a tab tap asks about a draft, Return goes on, and a reload picks the flow back up', async ({ browser }) => {
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  const title = uniqueTitle('Porch concert');
  try {
    await startPost(page);
    const flow = page.locator('[data-screen-label="New spark"]');
    await expect(flow).toContainText('Create event');
    await expect(flow.locator('[data-step-hint]')).toHaveCount(0);   // v8: Next says it with a toast instead
    await flow.getByLabel('Event title').fill(title);
    await flow.getByLabel('Event title').press('Enter');
    await expect(flow).toContainText('2/6');
    // A tab: the draft question, and Keep going stays put
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
    const leave = page.getByRole('dialog', { name: 'Save as draft' });
    await expect(leave).toContainText('Save this as a draft?');
    await leave.getByRole('button', { name: 'Keep going' }).click();
    await expect(flow).toContainText('2/6');
    // A reload comes back to the same step with the title
    await page.reload();
    await expect(flow).toContainText('2/6');
    await expect(flow).toContainText(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    // Discard from a tab tap goes to that tab, and nothing is kept for the next reload
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
    await leave.getByRole('button', { name: 'Discard' }).click();
    await expect(page.locator('[data-screen-label="Your calendar"]')).toBeVisible();
    await expect(flow).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem('spark-hub-compose'))).toBeNull();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('an idea’s Details (no How many people for now); a bare starter chip can’t be saved; its steps are Date · Location · Details', async ({ browser }) => {
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
    // A line longer than the old 40 posts whole (posting used to cut it at 40)
    const longLine = 'Shin guards help. We play on the turf behind the gym.';
    await flow.getByLabel('Details, line 2').fill(longLine);
    await expect(flow.locator('[data-tags]')).toHaveCount(0);   // no "What kind of event?" (owner, 2026-10-01)
    await expect(flow.locator('[data-need-people]')).toHaveCount(0);   // How many people do you want? is hidden for now (owner, 2026-10-02)
    await flow.getByRole('button', { name: 'Next' }).click();
    // Join in (v8): HELP chips, no 1-2-3 explainer; then the job list and ADD ANOTHER
    await expect(flow.locator('[data-help-how]')).toHaveCount(0);
    await expect(flow).toContainText('HELP');
    // Coordinate is a starter chip too (owner, 2026-10-02); like the others, it waits for what
    await flow.getByRole('button', { name: /Coordinate$/ }).click();
    const cj = page.getByRole('dialog', { name: 'Add a job' });
    await expect(cj.getByLabel('Job name')).toHaveValue(/^Coordinate/);
    await expect(cj.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await cj.getByRole('button', { name: 'Close' }).click();
    await expect(cj).toHaveCount(0);
    // A starter chip alone ("Bring") can't be saved
    await flow.getByRole('button', { name: /Bring$/ }).click();
    const job = page.getByRole('dialog', { name: 'Add a job' });
    await expect(job.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-disabled', 'true');
    // Gray filler after the verb, the details behind a link; no suggestion chips (v8)
    await expect(job.locator('[data-job-filler]')).toContainText('snacks, chairs, ice…');
    await expect(job.locator('[data-job-chips]')).toHaveCount(0);
    await expect(job).toContainText(/How people can join/i);
    await expect(job.getByLabel('Details', { exact: true })).toHaveCount(0);
    await job.getByLabel('Job name').fill('Bring ice');
    await expect(job.locator('[data-job-filler]')).toHaveCount(0);
    await job.getByLabel('Job name').fill('Bring a ball');
    await job.getByText('Add details or a time').click();
    await expect(job.getByLabel('Details', { exact: true })).toBeVisible();
    // The job's time is the app's own list (not the browser's menu), shown whole inside the pop-up
    await job.getByRole('button', { name: 'Time', exact: true }).click();
    const list = await job.locator('[data-time-list]').boundingBox(), jobEdge = await job.boundingBox();
    expect(list.y + list.height).toBeLessThanOrEqual(jobEdge.y + jobEdge.height);
    await pickTime(job, '17:00');
    await expect(job.getByRole('button', { name: 'Time', exact: true })).toContainText('5:00pm');
    // Shifts use the same list: the end only offers later times
    await job.getByText('Add a shift').click();
    await job.getByRole('button', { name: 'Shift 1 end' }).click();
    await job.locator('[data-time-list]').getByRole('radio', { name: 'pm', exact: true }).click();
    await job.locator('[data-time-list] [data-hour="5"]').click();
    await expect(job.locator('[data-time-list] [data-minute="00"]')).toHaveAttribute('aria-disabled', 'true');
    await pickTime(job, '18:00');
    await expect(job.getByRole('button', { name: 'Shift 1 end' })).toContainText('6:00pm');
    await job.getByText('Use one time instead').click();
    await job.getByRole('button', { name: 'Time', exact: true }).click();
    await job.locator('[data-time-list]').getByRole('button', { name: 'No time', exact: true }).click();   // clears it
    await job.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(flow).not.toContainText('FOR EXAMPLE');
    await expect(flow.locator('[data-job="Bring a ball"]')).toBeVisible();
    await expect(flow).toContainText('ADD ANOTHER');
    await flow.getByRole('button', { name: 'Next' }).click();

    await flow.locator('[data-post]').click();
    await expect(page.locator('[data-screen-label="Idea page"]')).toBeVisible();
    await closeAskFirst(page);
    id = await page.evaluate(() => location.hash.split('/').pop());
    const steps = page.getByLabel('Steps to a plan');
    for (const t of ['Date', 'Location', 'Details']) await expect(steps).toContainText(t);
    await expect(steps).not.toContainText('People');
    await expect(page.locator('[data-basics] span', { hasText: 'Bring cleats. And water?' })).toHaveCount(1);   // one line, not two
    await expect(page.locator('[data-basics] span', { hasText: longLine })).toHaveCount(1);
    const savedHopes = await asUser(page, async (c, _C, id) => (await c.from('sparks').select('hopes').eq('id', id).single()).data.hopes, id);
    expect(savedHopes).toEqual(['Bring cleats. And water?', longLine]);
    const saved = await asUser(page, async (c, _C, id) => (await c.from('sparks').select('min_people').eq('id', id).single()).data.min_people, id);
    expect(saved).toBe(null);
    const savedTags = await asUser(page, async (c, _C, id) => (await c.from('sparks').select('tags').eq('id', id).single()).data.tags, id);
    expect(savedTags).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    if (id) await asUser(page, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    await context.close();
  }
});

// Float the idea (v8): the title step's second card, explained by What's the difference?; Review's Lead card changes it.
// A floated idea goes up looking for a lead, and the next screen offers to ask someone
test('Create event: just float the idea posts it without a lead and offers to ask someone', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Flo');
  const page = host.page;
  let id;
  try {
    await startPost(page);
    const flow = page.locator('[data-screen-label="New spark"]');
    await flow.getByLabel('Event title').fill(uniqueTitle('Float'));
    await expect(flow.getByRole('button', { name: /^I’ll lead it/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(flow.getByRole('button', { name: /^Float the idea/ })).toContainText('Someone else might pick it up');
    await flow.getByRole('button', { name: 'Next' }).click();
    for (let i = 2; i <= 4; i++) {
      await expect(flow).toContainText(i + '/6');
      await flow.getByText('Decide later', { exact: true }).click();
    }
    await expect(flow).toContainText('5/6');
    await flow.getByText('None needed', { exact: true }).click();
    await expect(flow).toContainText('REVIEW');
    await expect(flow.locator('[data-review-lead]')).toContainText('You’re leading it');
    await expect(flow.locator('[data-post]')).toHaveText('Post as an idea');
    // Review's Lead card opens the same choice in a pop-up; a pick closes it
    await flow.getByRole('button', { name: 'Change who leads it' }).click();
    const pick = page.getByRole('dialog', { name: 'Who’s leading it?' });
    await expect(pick.getByRole('button', { name: /^I’ll lead it/ })).toHaveAttribute('aria-pressed', 'true');
    await pick.getByRole('button', { name: /^Float the idea/ }).click();
    await expect(pick).toHaveCount(0);
    await expect(flow.locator('[data-review-lead]')).toContainText('Just floating it');
    await expect(flow.locator('[data-posts-as]')).toContainText('This goes up as an idea that needs a lead');
    await flow.locator('[data-post]').click();
    const I = page.locator('[data-screen-label="Idea page"]');
    await expect(I).toBeVisible();
    id = ideaIdFromUrl(page);
    // Not Ask two people first: who could lead it?
    const ask = page.getByRole('dialog', { name: 'Ask someone to lead' });
    await expect(ask).toContainText('They get a note asking if they’d lead');
    await ask.getByRole('button', { name: 'Close' }).click();
    await expect(I.locator('[data-led-by]')).toContainText('FLOATED BY');
    await expect(I.locator('[data-chip]')).toHaveText('IDEA');
    await expect(I.locator('[data-plan-needs] [data-plan-row="lead"]')).toContainText('Someone to lead');
    await expect(I.locator('[data-ask-lead]')).toHaveText('Ask someone to lead');
    expect(await asUser(page, async (c, _C, id) => (await c.from('sparks').select('wants_host,planned').eq('id', id).single()).data, id)).toEqual({ wants_host: true, planned: false });
    expect(host.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(page, id).catch(() => {});
    await host.context.close();
  }
});
