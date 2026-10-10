// Plan an event (v8-14): one page (title, When & where, description, How to participate, Visibility), polls, jobs, drafts,
// then the host's edit pop-ups on the event page.
const { test, expect } = require('@playwright/test');
const { PNG, uniqueTitle, newLead, button, postEvent, openIdea, confirm, startPost, startFloat, asUser, closeAskFirst, pickKind, pickDate, pickTime, timeBox, deleteIdea, ideaIdFromUrl, openAllGroups, pickPostTo, postIdea } = require('./helpers');

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
    await expect(P.locator('[data-chip]')).toHaveCount(0);   // v8-12: no YOU'RE LEADING chip
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

    // A lead's top right: a pencil (Edit event) and a Share icon whose menu is Share link · QR code (Invite people left it, owner 2026-10-07)
    // (owner, 2026-10-07; v8-12 had one ⋯ with Edit event in it). No pencil after the title and the title isn't a button (Design 31)
    await expect(P.locator('h1 svg')).toHaveCount(0);
    await expect(P.locator('h1[data-on]')).toHaveCount(0);
    await expect(P.getByRole('button', { name: 'More' })).toHaveCount(1);   // three dots since 2026-10-10
    await P.locator('[data-ev-menu]').click();
    await expect(P.getByRole('menuitem')).toHaveText(['Share link', 'QR code', 'View as someone going'])
    await P.getByRole('menuitem', { name: 'Share link' }).click();
    const link0 = page.getByRole('dialog', { name: 'Share link' });
    await expect(link0.locator('[data-link-preview]')).toBeVisible();
    await expect(link0.getByText(/\/e\/[a-z0-9]{8}/)).toBeVisible();
    await link0.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);   // on its own: closing it closes everything
    await P.locator('[data-ev-menu]').click();
    await P.getByRole('menuitem', { name: 'QR code' }).click();
    const qr0 = page.getByRole('dialog', { name: 'QR code' });
    await expect(qr0.locator('[data-event-qr]')).toBeVisible();
    await qr0.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);   // on its own: closing it closes everything
    await P.getByRole('button', { name: 'Edit event' }).click();
    await expect(P.getByRole('menu')).toHaveCount(0);
    const sec = page.getByRole('dialog', { name: 'Edit event' });
    await expect(sec.locator('[data-edit-photo]')).toBeVisible();
    await expect(sec.getByRole('switch', { name: 'Tell everyone going' })).toHaveCount(0);   // edits save quietly (Design 30)
    await expect(sec.locator('[data-sec-delete]')).toHaveText('Cancel or delete event');   // under Save, the lead's
    await expect(sec.getByLabel(/^(Replace the|Add a) cover photo$/)).toHaveCount(1);
    await expect(sec.getByRole('button', { name: 'Remove the cover photo' })).toBeVisible();   // the cover can come off (owner, 2026-10-02)
    await sec.getByLabel('Event title').fill(title + ' + stars');
    await expect(sec.getByLabel('Quick overview')).toHaveAttribute('maxlength', '200');   // v8-13: the overview on Edit event too
    await sec.getByLabel('Quick overview').fill('A night run');
    await expect(sec.locator('[data-ov-count]')).toHaveText('11/200');
    await sec.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(sec).toHaveCount(0);
    await expect(P.locator('h1')).toContainText('+ stars');
    await expect(P.locator('[data-overview-head]')).toHaveText('A night run');   // under the title

    // What to expect (Design 8a): a one-line overview over the details
    await expect(P.getByRole('heading', { name: 'What to expect' })).toBeVisible();
    await P.getByRole('button', { name: 'Edit what to expect' }).click();
    const bd = page.getByRole('dialog', { name: 'What to expect' });
    await expect(bd.getByLabel('One-line overview')).toHaveAttribute('maxlength', '200');
    await expect(bd.getByLabel('One-line overview')).toHaveValue('A night run');   // the same field
    await expect(bd).not.toContainText('Both parts are optional.');   // v8-12
    await expect(bd.locator('[data-sec-delete]')).toHaveCount(0);       // no Cancel or delete on this sheet (v8-12)
    await bd.getByLabel('One-line overview').fill('A night run under the stars');
    // Posted from the one page (v8-14), it has a description: one 200-character box, not three detail lines
    await expect(bd.getByLabel('Details, line 1')).toHaveCount(0);
    await expect(bd.getByLabel('Event description')).toHaveText('Tacos after. Bring headlamps.');   // a formatted box (Design v8-18, 1b)
    await bd.getByLabel('Event description').fill('Tacos after. Bring headlamps. Hot cocoa.');
    await bd.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(P.locator('[data-basics]')).toContainText('Hot cocoa');
    await expect(P.locator('[data-overview-head]')).toHaveText('A night run under the stars');   // v8-13: always under the title
    await expect(P.locator('[data-basics] [data-overview]')).toHaveCount(0);                    // What to expect lists only the quick details
    expect(await asUser(page, async (c, _C, id) => (await c.from('sparks').select('overview').eq('id', id).single()).data.overview, id)).toBe('A night run under the stars');

    // Who can see it: Private
    await P.getByRole('button', { name: 'Edit who can see it' }).click();
    const vis = page.getByRole('dialog', { name: 'Who can see it' });
    await vis.getByRole('radio', { name: /^Private/ }).click();
    await vis.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(P).toContainText('PRIVATE');
    await expect(P.locator('[data-vis]')).toContainText('Private');

    // Edit job (the job's ✎ opens that job only; Design v8-8): rename the job and ask for one more
    await expect(P.getByRole('button', { name: 'Edit what you need' })).toHaveCount(0);   // no Edit link on the section
    await P.locator('[data-signup="Bring water"] [data-edit-jobs]').click();
    const needs = page.getByRole('dialog', { name: 'Edit', exact: true });
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

    // Invite people (one sheet): v8-11's footer is a round Share link, a round QR code (leads) and Send; Share link carries the ready message
    await P.getByRole('button', { name: /Invite people/ }).click();
    const share = page.getByRole('dialog', { name: 'Invite people' });
    const link = share.getByRole('button', { name: 'Share link' });
    const msg = await link.getAttribute('data-share-msg');
    expect(msg).toMatch(/· \w{3}, \w{3} \d+ http:\/\/127\.0\.0\.1:\d+\/e\/[a-z0-9]{8}|· \w{3}, \w{3} \d+ https?:\/\/[^ ]+\/e\/[a-z0-9]{8}/);   // "{title} · {day} {link}", the short link (v8-8)
    expect(msg).not.toContain('Torrez');
    const short = msg.split(' ').pop();
    await expect(share.getByRole('link', { name: 'WhatsApp' })).toHaveCount(0);   // no share circles in the sheet itself (v8-10)
    // v8-11: Share link opens a pop-up: the link preview, Messages · WhatsApp · Email · More, and Copy link
    await link.click();
    const pop = page.getByRole('dialog', { name: 'Share link' });
    await expect(pop.locator('[data-link-preview]')).toContainText(short.replace(/^https?:\/\//, ''));
    expect(await pop.getByRole('link', { name: 'Messages' }).getAttribute('href')).toMatch(/^sms:/);
    expect(decodeURIComponent(await pop.getByRole('link', { name: 'Messages' }).getAttribute('href'))).toContain(short);
    expect(await pop.getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(decodeURIComponent(await pop.getByRole('link', { name: 'Email' }).getAttribute('href'))).toContain(msg);
    await pop.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByText('Link copied')).toBeVisible();
    await expect(pop.getByRole('button', { name: /Copied/ })).toContainText('✓ Copied');
    expect(await share.getByRole('button', { name: 'Share link' }).getAttribute('data-share-msg')).toBe(msg);
    await pop.getByRole('button', { name: 'Close' }).click();
    await expect(pop).toHaveCount(0);
    // The lead's QR code (item 5): a real QR of the link; Show title and date adds the caption; Transparent drops the white
    await share.getByRole('button', { name: 'QR code' }).click();
    const qr = page.getByRole('dialog', { name: 'QR code' });
    await expect(qr.locator('svg[data-event-qr] path')).toHaveCount(1);
    await expect(qr.locator('svg[data-event-qr] rect')).toHaveCount(1);
    await expect(qr.locator('[data-qr-caption]')).toHaveCount(0);
    await qr.getByRole('switch', { name: 'Show title and date' }).click();
    await expect(qr.locator('[data-qr-caption]')).toContainText('Scan to RSVP');
    await qr.getByRole('radio', { name: 'Transparent' }).click();
    await expect(qr.locator('svg[data-event-qr] rect')).toHaveCount(0);
    await expect(qr).toContainText(short.replace(/^https?:\/\//, ''));
    const [dl] = await Promise.all([page.waitForEvent('download'), qr.getByRole('button', { name: 'Download PNG' }).click()]);
    expect(dl.suggestedFilename()).toMatch(/-qr-transparent\.png$/);
    await expect(page.getByText('QR code downloaded')).toBeVisible();
    await page.keyboard.press('Escape');   // the pop-up first, then the sheet
    await expect(qr).toHaveCount(0);
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

test('an older event’s three detail lines open as one description and save in the new format', async ({ browser }) => {
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  const title = uniqueTitle('Old details');
  let id;
  try {
    // Made the pre-v8-14 way: three detail lines, no description
    id = await asUser(page, async (c, _C, { title, day }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Tester', lead_name: 'Tester', lead_id: me, created_by: me, text: title, planned: true, day_date: day,
        hopes: ['Bring water', 'Meet at the gate!', 'Kids welcome'] }).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, { title, day: inDays(9) });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await openIdea(page, id);
    const P = page.locator('[data-screen-label="Plan page"]');
    await P.getByRole('button', { name: 'Edit what to expect' }).click();
    const bd = page.getByRole('dialog', { name: 'What to expect' });
    await expect(bd.getByLabel('Details, line 1')).toHaveCount(0);
    await expect(bd.getByLabel('Event description')).toHaveText('Bring water. Meet at the gate! Kids welcome.');
    await bd.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(bd).toHaveCount(0);
    expect(await asUser(page, async (c, _C, id) => (await c.from('sparks').select('hopes, vision').eq('id', id).single()).data, id))
      .toEqual({ hopes: [], vision: 'Bring water. Meet at the gate! Kids welcome.' });
    await expect(P.locator('[data-basics]')).toContainText('Meet at the gate! Kids welcome.');
    expect(errors).toEqual([]);
  } finally {
    if (id && /^[0-9a-f-]{36}$/.test(id)) await deleteIdea(page, id).catch(() => {});
    await context.close();
  }
});

test('Plan an event is one page (v8-14): Post it waits for a title and a date; the cards fill in; Date & time and Location pop-ups', async ({ browser }) => {
  test.setTimeout(90000);
  const { page, context, errors } = await newLead(browser, 2, 'Guard');
  const title = uniqueTitle('Chili cook-off');
  let id;
  try {
    await startPost(page, { group: false });
    const flow = page.locator('[data-screen-label="New spark"]');
    const one = flow.locator('[data-screen-label="Create event (1a)"]');
    await expect(one).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Real or test?' })).toHaveCount(0);
    await expect(flow).not.toContainText('1/4');   // no steps
    await expect(flow.getByLabel('Event title')).toBeFocused();
    await expect(flow.locator('[data-post-to]')).toContainText('Pick a group');   // none picked for you (owner, 2026-10-08)
    await pickPostTo(page);
    await expect(flow.getByLabel('Event title')).toHaveAttribute('placeholder', 'Event title');
    await expect(flow.getByLabel('Event title')).toHaveAttribute('maxlength', '40');
    await expect(flow.getByLabel('Quick overview')).toHaveAttribute('placeholder', 'Add a quick overview');
    await expect(flow.locator('[data-cp-photo]')).toContainText('Add photo');
    await expect(flow.locator('[data-cp-tile]')).toHaveCount(0);   // no date, no calendar tile
    // The sections, empty: grey cards
    for (const t of ['WHEN & WHERE', 'EVENT DESCRIPTION', 'SIGN UP', 'VISIBILITY']) await expect(one).toContainText(t);
    // Date & time and Address are fields in the card, with How long and Create a poll under them (owner, 2026-10-09)
    await expect(flow.locator('[data-cp-row="when"]').getByRole('button', { name: 'Date', exact: true })).toBeVisible();
    await expect(flow.locator('[data-cp-row="where"]').getByLabel('Address')).toBeVisible();
    await expect(flow.locator('[data-cp-row="where"]').getByLabel('Location name')).toHaveCount(0);   // only once there's an address
    await expect(flow.locator('[data-cp-when-where]')).toHaveCSS('background-color', 'rgb(223, 226, 231)');
    await expect(flow.locator('[data-cp-add-job]')).toHaveText('Add a sign up');   // Design v8-18, 1o
    await expect(flow.locator('[data-cp-examples]')).toContainText('EXAMPLES:');   // 1e
    await expect(flow.locator('[data-cp-examples]')).toContainText('Bring a carton of eggs');   // Q46: two greyed examples
    await expect(flow.locator('[data-cp-desc]')).toContainText('Add photos');   // Design v8-18, 1: in the description card
    await expect(flow.locator('[data-cp-desc]')).toContainText('Up to 3');
    // A photo added to the description opens full screen when tapped (owner, 2026-10-10, from Stacy)
    await flow.locator('[data-cp-inspo] input[type=file]').setInputFiles({ name: 'vibe.png', mimeType: 'image/png', buffer: PNG });
    await flow.getByRole('button', { name: 'View photo 1' }).click();
    const zoomed = page.getByRole('dialog', { name: 'Photo' });
    await expect(zoomed).toBeVisible();
    await zoomed.getByRole('button', { name: 'Close' }).click();
    await expect(zoomed).toHaveCount(0);
    await flow.getByRole('button', { name: 'Remove photo' }).click();   // back to none, the rest of the flow is unchanged
    await expect(flow.getByRole('switch', { name: 'People can invite friends' })).toHaveAttribute('aria-checked', 'true');   // on for Public
    // Post it stays grey until there's a title and a date; a tap says which is missing
    await expect(flow.locator('[data-post]')).toHaveAttribute('aria-disabled', 'true');
    await flow.locator('[data-post]').click({ force: true });
    await expect(page.getByRole('status')).toContainText('Add a title first');
    // With nothing typed, × just closes, back to the screen the sheet was over
    await flow.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('[data-screen-label="Your calendar"]')).toBeVisible();

    await startPost(page);
    await flow.getByLabel('Event title').fill(title);
    await flow.getByLabel('Quick overview').fill('Bring your best pot');
    await flow.locator('[data-post]').click({ force: true });
    await expect(page.getByRole('status')).toContainText('Add a date first');
    // The phone's Back with a title asks about a draft instead of dropping it
    await page.goBack();
    const leave = page.getByRole('dialog', { name: 'Pick this up later?' });
    await expect(leave).toContainText('Only you can see drafts.');
    await leave.getByRole('button', { name: 'Keep going' }).click();
    await expect(flow.getByLabel('Event title')).toHaveValue(title);
    // Date & time in the card: the start time's half-hour list, then an end time that only offers later times
    const when = flow.locator('[data-cp-row="when"]');
    await expect(when.locator('[data-create-poll]')).toHaveCount(0);   // no polls in Plan an event (Design v8-15, Q45)
    await pickDate(when, inDays(10));
    await when.getByRole('button', { name: 'Start time' }).click();
    await expect(when.page().locator('[data-time-list] [data-time]')).toHaveCount(36);   // every 30 minutes, 6am–11:30pm (owner, 2026-10-06)
    await pickTime(when, '18:00');
    await when.getByText('Add end time').click();
    await expect(when.page().locator('[data-time-list] [data-time="18:30"]')).toBeVisible();
    await expect(when.page().locator('[data-time-list] [data-time="17:00"]')).toHaveCount(0);
    await pickTime(when, '20:00');
    // The calendar tile is up in the header; the card turns white
    await expect(timeBox(when, 'End time')).toHaveValue('8:00pm');
    await expect(flow.locator('[data-cp-tile]')).toBeVisible();
    await expect(flow.locator('[data-cp-when-where]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(flow.locator('[data-post]')).toHaveAttribute('aria-disabled', 'false');
    // Location: the address, then Location name (optional) shows up under it
    const where = flow.locator('[data-cp-row="where"]');
    await where.getByLabel('Address').fill('2100 Kingsbury St, Austin, TX');
    await where.getByLabel('Location name').fill('Pease Park');
    // The description: one box, 500 characters (was 200), its count
    await flow.getByLabel('Event description').fill('Bring a bowl. Spoons too.');
    await expect(flow.locator('[data-cp-desc]')).toContainText('25/500');
    // Private turns People can invite friends off
    await flow.getByRole('radio', { name: /^Private/ }).click();
    await expect(flow.getByRole('switch', { name: 'People can invite friends' })).toHaveAttribute('aria-checked', 'false');
    await flow.getByRole('radio', { name: /^Public/ }).click();
    await expect(flow.getByRole('switch', { name: 'People can invite friends' })).toHaveAttribute('aria-checked', 'true');
    await expect(flow.locator('[data-post]')).toHaveText('Post it');
    await flow.locator('[data-post]').click();
    await expect(page.locator('[data-screen-label="Plan page"]')).toBeVisible();
    id = await page.evaluate(() => location.hash.split('/').pop());
    await closeAskFirst(page);
    // Every event is real now (v8): no DEMO chip, no Test event tab. The description is the details text, shown whole
    await expect(page.locator('[data-test-tab]')).toHaveCount(0);
    await expect(page.locator('[data-basics]')).toContainText('Bring a bowl. Spoons too.');
    expect(await asUser(page, async (c, _C, id) => (await c.from('sparks').select('test,demo,planned,hopes,vision,overview,guest_invites,spot').eq('id', id).single()).data, id))
      .toMatchObject({ test: false, demo: false, planned: true, hopes: [], vision: 'Bring a bowl. Spoons too.', overview: 'Bring your best pot', guest_invites: true, spot: 'Pease Park' });
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
    // Plan an event has no polls any more (Design v8-15, Q45); an idea with a date poll is made directly (Float an Idea has its own poll tests)
    id = await postIdea(H, { title });
    await asUser(H, async (c, _C, { id, days }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const r = await c.from('date_options').insert(days.map(d => ({ spark_id: id, day_date: d, who: me })));
      if (r.error) throw new Error(r.error.message);
    }, { id, days: [inDays(15), inDays(16)] });
    await H.reload();
    await expect(H.locator('[data-screen-label="Idea page (8b)"]')).toBeVisible();

    await openIdea(O, id);
    const OI = O.locator('[data-screen-label="Idea page (8b)"]');
    await expect(OI.locator('[data-led-by8]')).toContainText('Picking a date');
    await expect(OI.locator('[data-led-line]')).toContainText('Led by');
    await OI.locator('[data-when] [data-cal-page]').first().click();
    await expect(OI.locator('[data-when] [data-cal-page][aria-checked="true"]')).toHaveCount(1);

    // The lead picks the date and adds a location in the Pick pop-ups (v8-8 item 4), then Make it a plan! (grey until then)
    await H.reload();
    const HI = H.locator('[data-screen-label="Idea page (8b)"]');
    await expect(HI.locator('[data-make-it-plan]')).toHaveText('Add a date first');
    await HI.locator('[data-plan-date]').click();
    const pickD = H.getByRole('dialog', { name: 'Pick a date' });
    await expect(pickD).toContainText('Choose from the dates people voted on, or set another.');
    await expect(pickD.locator('[data-pick-own]')).toContainText('Another date');
    await expect(pickD.locator('[data-pick-opt][aria-checked="true"]')).toContainText('1 can go');   // the top one is picked
    await pickD.locator('[data-pick-confirm]').click();
    await expect(H.getByRole('status')).toContainText('Date set');
    // The picked date is the answer everywhere (audit 2026-10-07): When? shows it and the poll closes
    await expect(HI.locator('[data-when-set]')).toContainText('You picked it');
    await expect(HI.locator('[data-when] [data-cal-page]')).toHaveCount(1);
    await expect(HI.locator('[data-when-set] [data-cal-page]')).toHaveText('');   // a calendar icon like Where?'s pin, no date page
    await expect(HI.locator('[data-when]')).not.toContainText('Choose all dates you could attend.');
    // …and Make it a plan! is ready: a lead and a date; the location can wait (planMissing, owner 2026-10-02)
    await expect(HI.locator('[data-make-it-plan]')).toContainText('Lock it in');
    await expect(HI.locator('[data-make-this-plan]')).toContainText('The location can be decided later.');
    // The member sees the picked date, and nothing asks them to vote on one
    await O.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));   // a refresh, not a reload: the page already open updates
    await expect(OI.locator('[data-when-set]')).toContainText('picked it');
    await expect(OI.locator('[data-help-make-plan]')).not.toContainText(/Vote on a date|Suggest a date/);
    // Undo the pick: the poll comes back
    await HI.locator('[data-change-date]').click();
    await H.getByRole('dialog', { name: 'Pick a date' }).locator('[data-pick-reopen]').click();
    await expect(H.getByRole('status')).toContainText('Voting is open again');
    await expect(HI.locator('[data-when] [data-cal-page]')).toHaveCount(2);
    await expect(HI.locator('[data-make-it-plan]')).toHaveText('Add a date first');
    await HI.locator('[data-plan-date]').click();
    await H.getByRole('dialog', { name: 'Pick a date' }).locator('[data-pick-confirm]').click();
    await expect(HI.locator('[data-when-set]')).toBeVisible();
    await HI.locator('[data-plan-loc]').click();
    const pickL = H.getByRole('dialog', { name: 'Pick a location' });
    await expect(pickL.locator('[data-pick-confirm]')).toHaveAttribute('aria-disabled', 'true');
    await pickL.getByLabel('Location').fill('Pease Park');
    await pickL.locator('[data-pick-confirm]').click();
    await expect(H.getByRole('status')).toContainText('Location set');
    await HI.locator('[data-make-it-plan]').click();
    // Review, prefilled; Post it turns the idea into the event (the same record)
    const flow = H.locator('[data-screen-label="New spark"]');
    await expect(flow.locator('[data-ready-count]')).toBeVisible();
    await expect(flow.locator('[data-review-edit="where"]')).toContainText('Pease Park');
    await flow.locator('[data-post]').click();
    await expect(H.locator('[data-screen-label="Plan page"]')).toBeVisible();
    await expect(H.getByRole('status')).toContainText('It’s a Plan!');
    expect(await H.evaluate(() => location.hash.split('/').pop())).toBe(id);

    // A plan keeps its date (the date pop-up has no Clear, Design v8-18 1n); turning it back into an idea takes it off
    await H.getByLabel('Edit date, time and location').click();
    const when = H.getByRole('dialog', { name: 'Date, time & location' });
    await when.getByRole('button', { name: 'Date', exact: true }).click();
    await expect(H.locator('[data-calendar]').getByRole('button', { name: 'Clear the date' })).toHaveCount(0);
    await H.locator('[data-calendar]').getByRole('button', { name: 'Close' }).click();
    await when.locator('[data-back-to-idea]').click();
    await confirm(H, 'Back to an Idea');
    await expect(HI).toBeVisible();
    await expect(HI.locator('[data-make-this-plan]')).toContainText('You’re leading');   // the lead keeps it; only the date comes off
    await expect(HI.locator('[data-make-it-plan]')).toHaveText('Add a date first');
    expect(host.errors).toEqual([]);
    expect(member.errors).toEqual([]);
  } finally {
    if (id) await asUser(H, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    await host.context.close();
    await member.context.close();
  }
});

// A date typed in Pick (your own, no suggestions) shows on the idea page at once, and on a second member's open page after a refresh
test('an idea\u2019s own date: the page and the Make it a plan strip update without a reload', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Hope');
  const member = await newLead(browser, 2, 'Omar');
  const H = host.page, O = member.page;
  const title = uniqueTitle('Own date');
  let id;
  try {
    id = await postIdea(H, { title });
    await openIdea(O, id);
    const HI = H.locator('[data-screen-label="Idea page (8b)"]'), OI = O.locator('[data-screen-label="Idea page (8b)"]');
    await expect(HI.locator('[data-make-it-plan]')).toHaveText('Add a date first');
    await HI.locator('[data-plan-date]').click();
    const pick = H.getByRole('dialog', { name: 'Pick a date' });
    await pick.getByLabel('Date').fill(inDays(20));
    await pick.locator('[data-pick-confirm]').click();
    await expect(H.getByRole('status')).toContainText('Date set');
    await expect(HI.locator('[data-when-set]')).toBeVisible();
    await expect(HI.locator('[data-make-it-plan]')).not.toHaveText('Add a date first');
    await O.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(OI.locator('[data-when-set]')).toBeVisible();
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close(); await member.context.close();
  }
});

test('drafts: X saves one, Me → Drafts lists it, Continue picks up there, posting removes it', async ({ browser }) => {
  test.setTimeout(90000);
  const { page, context, errors } = await newLead(browser, 2, 'Guard');
  const title = uniqueTitle('Yard sale');
  let id;
  try {
    await startPost(page);
    const flow = page.locator('[data-screen-label="New spark"]');
    await flow.getByLabel('Event title').fill(title);
    await pickDate(flow.locator('[data-cp-row="when"]'), inDays(5));
    await flow.getByRole('button', { name: 'Close' }).click();
    const leave = page.getByRole('dialog', { name: 'Pick this up later?' });
    await expect(leave).toContainText('Only you can see drafts.');
    await leave.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByText('Saved as a draft')).toBeVisible();

    // Drafts live in Me → Drafts (v8), not on My calendar
    const openDraft = async () => {
      await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Me', exact: true }).click();
      await expect(page.locator('[data-stuff="Drafts"]')).toHaveAttribute('aria-label', /^Drafts, [1-9]/);   // a count, no titles (v8-9)
      await page.locator('[data-stuff="Drafts"]').click();
      const list = page.getByRole('dialog', { name: 'Drafts' });
      await expect(list).toContainText(title);
      await list.getByRole('button', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    };
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
    await expect(page.locator('[data-screen-label="Your calendar"]')).toBeVisible();
    await expect(page.locator('[data-screen-label="Your calendar"] [data-draft]')).toHaveCount(0);
    await openDraft();
    await expect(flow.getByLabel('Event title')).toHaveValue(title);
    // a Description takes up to 500 characters (owner, 2026-10-08: was 200)
    // and keeps its paragraph breaks (owner, 2026-10-09)
    const desc = 'Park on Elm Street and walk in through the side gate.\n\n' + 'Everything must go. '.repeat(10).trim();
    await flow.getByLabel('Event description').fill(desc);
    await expect(flow.locator('[data-desc-count]')).toHaveText(desc.length + '/500');
    // the Save draft link under Post it saves and leaves
    await flow.locator('[data-save-draft]').click();
    await expect(page.getByText('Saved as a draft')).toBeVisible();
    await openDraft();
    await expect(flow.getByLabel('Event description').locator('div')).toHaveText(['Park on Elm Street and walk in through the side gate.', '', 'Everything must go. '.repeat(10).trim()]);
    await expect(flow.locator('[data-cp-row="when"] [data-date-field]').first()).not.toContainText('Pick a date');
    await flow.locator('[data-post]').click();
    await expect(page.locator('[data-screen-label="Plan page"]')).toBeVisible();
    await closeAskFirst(page);
    id = await page.evaluate(() => location.hash.split('/').pop());
    expect(await asUser(page, async (c, _C, id) => (await c.from('sparks').select('vision').eq('id', id).single()).data.vision, id)).toBe(desc);
    // What to expect shows it as text with its break, not a bulleted line
    const shown = page.locator('[data-screen-label="Plan page"] [data-basics] [data-desc]');
    await expect(shown.locator('div')).toHaveText(['Park on Elm Street and walk in through the side gate.', '', 'Everything must go. '.repeat(10).trim()]);   // a line each, the blank one kept
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
    // The Address field searches (owner, 2026-10-09: Address first, Location name once there's one)
    const where = flow.locator('[data-cp-row="where"]'), addr = where.getByLabel('Address');
    await addr.fill('z');
    await page.waitForTimeout(400);
    expect(context.placeRequests).toHaveLength(0);
    await addr.fill('zilk');
    const list = page.getByRole('group', { name: 'Suggested places' });
    await expect(list).toContainText('2100 Barton Springs Road, Austin, TX 78746');
    await expect(list).not.toContainText('United States');
    await expect(list.locator('[data-places-credit]')).toContainText(/OpenStreetMap|Powered by Google/);   // whose results they are
    await expect(where.getByLabel('Location name')).toHaveCount(0);   // not while the suggestions are open
    const url = new URL(context.placeRequests[0]);
    expect(url.searchParams.get('text')).toBe('zilk');
    if (url.host === 'api.geoapify.com') expect(url.searchParams.get('filter')).toBe('circle:-97.7431,30.2672,60000');   // Google's search is biased in its body

    await addr.fill('zilker');
    await expect.poll(() => context.placeRequests.length).toBe(2);
    await addr.fill('zilk');             // already searched: no new lookup
    await expect(list).toBeVisible();
    await page.waitForTimeout(300);
    expect(context.placeRequests).toHaveLength(2);

    // A named place fills the address and, while it's empty, the Location name; renaming keeps the address
    await list.getByRole('button', { name: /Zilker Metropolitan Park/ }).click();
    await expect(addr).toHaveValue('2100 Barton Springs Road, Austin, TX 78746');
    await expect(where.getByLabel('Location name')).toHaveValue('Zilker Metropolitan Park');
    await where.getByLabel('Location name').fill('The big oak');
    await expect(list).toBeHidden();
    await expect(addr).toHaveValue('2100 Barton Springs Road, Austin, TX 78746');
    // A plain address leaves the name alone
    await where.getByLabel('Location name').fill('');
    await addr.fill('zilk');
    await list.getByRole('button', { name: /1100 Congress Avenue/ }).click();
    await expect(addr).toHaveValue(/1100 Congress Avenue.*Austin, TX 78701/);
    await expect(where.getByLabel('Location name')).toHaveValue('');
    // Google's details are asked for the address only: no coordinates are fetched or kept
    expect(context.placeRequests.masks.length).toBeGreaterThan(0);
    expect(context.placeRequests.masks.join(',')).not.toContain('location');
  } finally {
    await context.close();
  }
});

// Owner, 2026-10-02 (review fixes): a tab tap inside Create event asks about a draft (it used to drop the event), Return
// in the title presses Next, a greyed-out Next says what it's waiting for, and a reload brings the flow back where it
// was (phones drop the tab while people look something up)
test('Plan an event: × asks about a draft, Keep going stays, and a reload picks the page back up', async ({ browser }) => {
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  const title = uniqueTitle('Porch concert');
  try {
    await startPost(page);
    const flow = page.locator('[data-screen-label="New spark"]');
    await flow.getByLabel('Event title').fill(title);
    await flow.getByLabel('Event description').fill('Lawn chairs welcome.');
    // The sheet covers the tab bar (v8-6), so × asks: the draft question, and Keep going stays put
    await flow.getByRole('button', { name: 'Close' }).click();
    const leave = page.getByRole('dialog', { name: 'Pick this up later?' });
    await expect(leave).toContainText('Only you can see drafts.');
    await leave.getByRole('button', { name: 'Keep going' }).click();
    await expect(flow.getByLabel('Event title')).toHaveValue(title);
    // A reload comes back with what was typed
    await page.reload();
    await expect(flow.getByLabel('Event title')).toHaveValue(title);
    await expect(flow.getByLabel('Event description')).toHaveText('Lawn chairs welcome.');
    // Discard goes back to the screen under the sheet, and nothing is kept for the next reload
    await flow.getByRole('button', { name: 'Close' }).click();
    await leave.getByRole('button', { name: 'Discard' }).click();
    await expect(page.locator('[data-screen-label="Your calendar"]')).toBeVisible();
    await expect(flow).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem('spark-hub-compose'))).toBeNull();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('Sign up: + Add opens the starters pop-up; a bare starter can’t be saved', async ({ browser }) => {
  test.setTimeout(90000);
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  const title = uniqueTitle('Pickup soccer');
  let id;
  try {
    await startPost(page);
    const flow = page.locator('[data-screen-label="New spark"]');
    await flow.getByLabel('Event title').fill(title);
    await pickDate(flow.locator('[data-cp-row="when"]'), inDays(8));
    await expect(flow.locator('[data-tags]')).toHaveCount(0);          // no "What kind of event?" (owner, 2026-10-01)
    await expect(flow.locator('[data-need-people]')).toHaveCount(0);   // How many people do you want? is hidden for now (owner, 2026-10-02)
    // + Add a sign up (Design v8-18, 1d): the name first, the starters under it (no Write your own)
    const job = page.getByRole('dialog', { name: 'Add a sign up' });
    await flow.locator('[data-cp-add-job]').click();
    await expect(job.getByLabel('Sign-up name')).toHaveValue('');
    await expect(job.getByLabel('Sign-up name')).toHaveAttribute('placeholder', 'What you need');
    await expect(job.locator('[data-job-chip]')).toHaveText(['Bring', 'Help with', 'Set up', 'Clean up', 'Coordinate']);
    // A starter puts its word in front in purple, and alone it can't be saved; tapping it again clears it
    await job.locator('[data-job-chip="Coordinate"]').click();
    await expect(job.locator('[data-job-pre]')).toHaveText('Coordinate');
    await expect(job.getByLabel('Sign-up name')).toHaveAttribute('placeholder', 'carpools, the music…');
    await expect(job.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await job.locator('[data-job-chip="Coordinate"]').click();
    await expect(job.locator('[data-job-pre]')).toHaveCount(0);
    await job.locator('[data-job-chip="Bring"]').click();
    await expect(job.getByLabel('Details', { exact: true })).toHaveCount(0);
    await job.getByLabel('Sign-up name').fill('a ball');
    await expect(job.getByRole('button', { name: 'Save', exact: true })).not.toHaveAttribute('aria-disabled', 'true');
    // + Add details opens the full editor with the name carried over
    await job.getByText('Add details', { exact: true }).click();
    await expect(job.getByLabel('Job name')).toHaveValue('Bring a ball');
    await expect(job.locator('[data-job-options] [data-part-waitlist]')).toHaveAttribute('aria-checked', 'true');   // every item's options (2026-10-07)
    await expect(job.locator('[data-job-guests]')).toHaveAttribute('aria-checked', 'true');
    await expect(job.getByLabel('Details', { exact: true })).toBeVisible();
    // The job's time is the app's own list (not the browser's menu)
    await job.getByRole('button', { name: 'Time', exact: true }).click();
    await pickTime(job, '17:00');
    await expect(timeBox(job, 'Time')).toHaveValue('5pm');
    // Shifts use the same list: the end only offers later times
    await job.getByText('Add more times').click();
    await job.getByRole('button', { name: 'Time 1 end' }).click();
    await expect(job.page().locator('[data-time-list] [data-time="18:00"]')).toBeVisible();
    await expect(job.page().locator('[data-time-list] [data-time="17:00"]')).toHaveCount(0);   // only times after the start
    await pickTime(job, '18:00');
    await expect(timeBox(job, 'Time 1 end')).toHaveValue('6pm');
    await job.getByText('Use one time instead').click();
    await job.getByRole('button', { name: 'Time', exact: true }).click();
    await job.page().locator('[data-time-list]').getByRole('option', { name: 'No time', exact: true }).click();   // clears it
    await job.getByRole('button', { name: 'Save', exact: true }).click();
    // The job's row, and the empty-state lines are gone; the card is white
    await expect(flow.locator('[data-job="Bring a ball"]')).toBeVisible();
    await expect(flow.locator('[data-cp-help]')).not.toContainText('+ Add a sign-up');
    await expect(flow.locator('[data-cp-help]')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    await flow.locator('[data-post]').click();
    await expect(page.locator('[data-screen-label="Plan page"]')).toBeVisible();
    await closeAskFirst(page);
    id = await page.evaluate(() => location.hash.split('/').pop());
    const row = await asUser(page, async (c, _C, id) => (await c.from('sparks').select('min_people,tags,signup_items(item)').eq('id', id).single()).data, id);
    expect(row).toMatchObject({ min_people: null, tags: [], signup_items: [{ item: 'Bring a ball' }] });
    expect(errors).toEqual([]);
  } finally {
    if (id) await asUser(page, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    await context.close();
  }
});

// Float an idea (v8-4 §5, v8-5 items 1–5): the + menu's Float an idea opens the two-page Float sheet. Page 1 sketches it
// (a date set with a time chip, a location poll behind Add more details); leaving with something typed offers a draft,
// which comes back next time; page 2 says where it goes and how people can help. Posting opens the starter's slide-up on
// the Ideas tab. (Plan an event's Float the idea card is gone since v8-6.)
test('Float an idea: the Float sheet, a draft, and the starter’s slide-up', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Flo');
  const page = host.page;
  const title = uniqueTitle('Kite day');
  let id;
  try {
    await startFloat(page);
    const sheet = page.locator('[data-screen-label="Float an Idea"]');
    await expect(sheet).toContainText('What’s your idea?');
    await sheet.locator('[data-qi-next]').click();
    await expect(page.getByRole('status')).toContainText('Add a title first');
    await expect(sheet.locator('[data-qi-draft]')).toHaveCount(0);   // Save draft waits for a title (owner, 2026-10-08)
    await sheet.getByLabel('Your idea').fill(title);
    await expect(sheet.locator('[data-qi-draft]')).toBeVisible();
    const why = 'Bring a kite or borrow one. We meet by the big oak near the parking lot, fly for an hour or two, then grab tacos. Kids welcome, no experience needed, and the wind is best before sunset.';   // past the old 120 (200 since 20261120000000)
    await sheet.getByLabel('Quick description').fill(why);   // two fields again (Design v8-18, 1r)
    await sheet.locator('[data-qi-more]').click();
    await expect(sheet.locator('[data-qi-more]')).toHaveText(/Fewer details/);   // it folds them away again
    // DATE: Set date → a centred pop-up with the time chips
    await sheet.locator('[data-qi-date-set]').click();
    const setDate = page.getByRole('dialog', { name: 'Set date' });
    await expect(setDate).toContainText('You can change this later.');
    await setDate.getByLabel('Date').fill(inDays(9));
    await setDate.getByRole('button', { name: 'Evening' }).click();
    await setDate.locator('[data-qi-pop-done]').click();
    await expect(sheet.locator('[data-qi-date-sum]')).toContainText('· Evening');
    // LOCATION: Create poll needs two
    await sheet.locator('[data-qi-loc-poll]').click();
    const poll = page.getByRole('dialog', { name: 'Location poll' });
    await poll.getByLabel('Location 1').fill('Zilker Park');
    await poll.locator('[data-qi-pop-done]').click();
    await expect(page.getByRole('status')).toContainText('Add at least two locations');
    await poll.getByLabel('Location 2').fill('Butler Park');
    await poll.locator('[data-qi-pop-done]').click();
    await expect(sheet.locator('[data-qi-loc-sum]')).toContainText('2 locations · Zilker Park, Butler Park');
    // Leaving with something typed: Pick this up later? → Save draft; opening it again picks the draft up
    await sheet.getByRole('button', { name: 'Close' }).first().click();
    const leave = page.getByRole('dialog', { name: 'Pick this up later?' });
    await expect(leave).toContainText('Only you can see drafts.');
    await leave.locator('[data-qi-save-draft]').click();
    await expect(sheet).toHaveCount(0);
    // The draft is saved to the account (owner, 2026-10-07), with the event drafts
    expect(await asUser(page, async (c, _C, t) => (await c.from('event_drafts').select('data').filter('data->>kind', 'eq', 'float')).data.filter(r => r.data.title === t).length, title)).toBe(1);
    await startFloat(page);
    await expect(page.getByRole('status')).toContainText('Picked up your draft');
    await expect(sheet.getByLabel('Your idea')).toHaveValue(title);
    await expect(sheet.getByLabel('Quick description')).toHaveValue(why);
    await expect(sheet.locator('[data-qi-loc-sum]')).toContainText('Butler Park');
    // Page 2: the recap, WHERE IT GOES, HOW PEOPLE CAN HELP; Talk it through on, Who leads it: I'll decide (the default, v8-8)
    await sheet.locator('[data-qi-next]').click();
    await expect(sheet).toContainText('WHERE IT GOES');
    await expect(sheet.locator('[data-qi-post-to]')).toContainText('Torrez Fitness');
    await sheet.locator('[data-talk-toggle]').click();
    await expect(sheet.locator('[data-talk-toggle]')).toHaveAttribute('aria-checked', 'true');
    await expect(sheet.locator('[data-rule="me"]')).toHaveAttribute('aria-pressed', 'true');   // I'll lead it is the default (Design v8-18, 1k)
    await expect(sheet.locator('[data-rule]').first()).toHaveAttribute('data-rule', 'me');   // first, then Find a lead
    await sheet.locator('[data-rule="decide"]').click();   // this one is floated: someone else leads it
    await expect(sheet.locator('[data-rule="any"]')).toHaveCount(0);   // Anyone is gone (v8-8 item 6)
    // Ideas can be private, like plans (owner, 2026-10-08): Public by default, Private for only the people invited
    await expect(sheet.locator('[data-idea-vis="public"]')).toHaveAttribute('aria-checked', 'true');
    await sheet.locator('[data-idea-vis="private"]').click();
    await expect(sheet.locator('[data-idea-vis="private"]')).toHaveAttribute('aria-checked', 'true');
    // Save draft from page 2 keeps the same draft, Private included
    await sheet.locator('[data-qi-draft]').click();
    await expect(page.getByRole('status')).toContainText('Saved as a draft');
    await expect(sheet).toHaveCount(0);
    expect(await asUser(page, async (c, _C, t) => (await c.from('event_drafts').select('data').filter('data->>kind', 'eq', 'float')).data.filter(r => r.data.title === t).map(r => r.data.priv), title)).toEqual([true]);
    await startFloat(page);
    await expect(page.getByRole('status')).toContainText('Picked up your draft');
    await sheet.locator('[data-qi-next]').click();
    await expect(sheet.locator('[data-idea-vis="private"]')).toHaveAttribute('aria-checked', 'true');
    await sheet.locator('[data-qi-post]').click();
    // It opens on the Ideas tab as the starter's slide-up
    const ip = page.locator('[data-screen-label="Idea sheet"]');
    await expect(ip).toContainText(title);
    await expect(ip).toContainText('You floated this');
    await expect(ip.locator('[data-idea-overview]')).toHaveText(why);
    expect(await ip.locator('[data-idea-overview]').evaluate(n => n.scrollHeight <= n.clientHeight + 1)).toBe(true);   // shown in full, not cut off
    await expect(page.getByRole('status')).toContainText('Posted to Torrez Fitness');
    await expect(ip.locator('[data-make-this-plan]')).toContainText('Choose a lead');
    id = await asUser(page, async (c, _C, title) => (await c.from('sparks').select('id').eq('text', title).single()).data.id, title);
    expect(await asUser(page, async (c, _C, t) => (await c.from('event_drafts').select('data').filter('data->>kind', 'eq', 'float')).data.filter(r => r.data.title === t).length, title)).toBe(0);   // posting clears it
    const row = await asUser(page, async (c, _C, id) => (await c.from('sparks').select('visibility,wants_host,planned,talk,lead_rule,overview,day_date,spot,date_options(day_part),spot_options(name)').eq('id', id).single()).data, id);
    // Set date sets the idea's date (its part of day stays on its one option); the location poll stays a poll
    await expect(ip.locator('[data-private-chip]')).toBeVisible();
    expect(row).toMatchObject({ visibility: 'invite', wants_host: true, planned: false, talk: true, lead_rule: 'me', overview: why, day_date: inDays(9), spot: null, date_options: [{ day_part: 'evening' }] });
    expect(row.spot_options.map(o => o.name).sort()).toEqual(['Butler Park', 'Zilker Park']);
    // Swipe up for more: When? (with the time on its calendar page), Where?, and the starter's settings
    await ip.locator('[data-ip-more]').click();
    await expect(ip.locator('[data-when-set]')).toContainText('Evening');
    await expect(ip.locator('[data-make-this-plan]')).toContainText('· Evening');   // the Date row, ticked
    await expect(ip.locator('[data-where] [data-loc-row]')).toHaveCount(2);
    await expect(ip.locator('[data-idea-post-to]')).toContainText('Torrez Fitness · Private');
    await expect(ip.locator('[data-talk-toggle]')).toHaveAttribute('aria-checked', 'true');
    await ip.getByRole('button', { name: 'Close' }).first().click();
    await expect(page.locator('[data-idea-card="' + title + '"]')).toBeVisible();   // on the board
    await expect(page.locator('[data-idea-card="' + title + '"] [data-private-chip]')).toBeVisible();
    // Post to's pop-up makes it public again
    await page.locator('[data-idea-card="' + title + '"]').click();
    await ip.locator('[data-ip-more]').click();
    await ip.locator('[data-idea-post-to]').click();
    const vis = page.getByRole('dialog', { name: 'Idea visibility' });
    await expect(vis.locator('[data-idea-vis="private"]')).toHaveAttribute('aria-checked', 'true');
    await vis.locator('[data-idea-vis="public"]').click();
    await vis.locator('[data-ip-pop-done]').click();
    await expect(page.getByRole('status')).toContainText('Visible to Torrez Fitness');
    await expect.poll(() => asUser(page, async (c, _C, id) => (await c.from('sparks').select('visibility').eq('id', id).single()).data.visibility, id)).toBe('group');
    await expect(ip.locator('[data-private-chip]')).toHaveCount(0);
    await ip.getByRole('button', { name: 'Close' }).first().click();
    // The board opens in Tiles, the gold edge down the card's left side; the view menu switches to Grid (edge on top)
    const strip = () => page.locator('[data-idea-card="' + title + '"] [data-idea-strip]').evaluate(el => [el.offsetWidth, el.offsetHeight]);
    await expect(page.locator('[data-ia-views]')).toHaveAttribute('aria-label', 'View: Tiles');
    expect(await strip()).toEqual([5, expect.any(Number)]);
    await page.locator('[data-ia-views]').click();
    await expect(page.locator('[data-ia-view="full"]')).toHaveAttribute('aria-selected', 'true');
    await page.locator('[data-ia-view="grid"]').click();
    await expect(page.locator('[data-ia-views]')).toHaveAttribute('aria-label', 'View: Grid');
    expect((await strip())[1]).toBe(5);
    // The board sorts Newest first, and opens on Newest again after another sort was picked (owner, 2026-10-07)
    await expect(page.locator('[data-ia-sort]')).toContainText('Newest');
    await page.locator('[data-ia-sort]').click();
    await page.getByRole('option', { name: 'Popular' }).click();
    await expect(page.locator('[data-ia-sort]')).toContainText('Popular');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Ideas/ }).click();
    await expect(page.locator('[data-ia-sort]')).toContainText('Newest');

    // Plan an event has no Float the idea card any more (v8-6: whoever makes it leads it)
    await startPost(page);
    await expect(page.locator('[data-screen-label="New spark"] [data-ev-lead]')).toHaveCount(0);
    expect(host.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(page, id).catch(() => {});
    await host.context.close();
  }
});
