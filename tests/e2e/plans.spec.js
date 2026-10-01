// V5 plans: RSVPs (going / maybe / can't) from a guest with the link, sign-ups, updates from
// the host, a date change that tells everyone going, "it happened" with its album, and private plans.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, button, postEvent, openIdea, deleteIdea, answerGuestPrompt, confirm, asUser, PNG } = require('./helpers');

// Local dates, like the app (toISOString would be UTC, a day ahead in the evening)
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('a plan: guest RSVPs, sign-ups, an update, the host’s notes, then clearing the date', async ({ browser }) => {
  test.setTimeout(150000);
  const host = await newLead(browser, 1, 'Hope');
  const guest = await newMember(browser);
  const H = host.page, G = guest.page;
  const title = uniqueTitle('Chili');
  let id;
  try {
    id = await postEvent(H, { title, date: inDays(20), time: '17:30' });
    const HP = H.locator('[data-screen-label="Plan page"]');
    await expect(HP).toContainText('YOU’RE LEADING');                          // v6 Update 6: the host's chip
    await expect(HP).toContainText('5:30pm');
    await expect(HP).not.toContainText('LED BY');                           // not shown to the host
    await expect(HP.locator('[data-screen-label="Guest list"]')).toContainText('Going');
    await expect(HP.getByRole('button', { name: /Invite people/ })).toBeVisible();
    await expect(HP).not.toContainText('Remind everyone the day before');      // retired in Update 6
    await expect(HP.locator('[data-when-card]')).toContainText('Location TBD');

    // The host adds sign-ups (with "how many") in Edit what you need, and posts an update
    await HP.getByRole('button', { name: 'Edit what you need' }).click();
    const needs = H.getByRole('dialog', { name: 'Edit what you need' });
    await needs.getByText('Add a job or item').click();
    await needs.getByLabel('Job name 1').fill('Folding chairs');
    await needs.getByRole('button', { name: 'More for how many people' }).click();
    await needs.getByRole('button', { name: 'Save changes' }).click();
    await expect(HP.locator('[data-signup="Folding chairs"]')).toContainText('0 of 2');
    await HP.getByRole('button', { name: 'Send everyone an update' }).click();
    const blast = H.getByRole('dialog', { name: 'Send an update' });
    await blast.getByLabel('Your update').fill('Parking is on the street.');
    await blast.getByRole('button', { name: 'Post update' }).click();
    await expect(H.getByText('Posted to the event')).toBeVisible();
    await expect(HP).toContainText('Parking is on the street.');

    // The guest opens the link: RSVP asks for their info once, then they sign up for things
    await openIdea(G, id);
    const GP = G.locator('[data-screen-label="Plan page"]');
    await expect(GP.locator('[data-rsvp]')).toBeVisible();
    await expect(GP).toContainText('Parking is on the street.');
    await expect(GP).toContainText('LED BY');
    await expect(GP.getByRole('button', { name: 'Say hi' })).toBeVisible();
    await expect(GP).not.toContainText('Before the day');                     // just for the host
    const rsvp = (k) => GP.locator('[data-rsvp]').getByRole('button', { name: new RegExp('^' + k) });
    await rsvp('Going').click();
    await answerGuestPrompt(G, 'Gus', '(512) 555-0142');
    await expect(G.getByText('You’re going. See you there!')).toBeVisible();
    // v6 Update 5: three buttons with counts; the pick is filled; tapping it again clears it
    await expect(rsvp('Going')).toHaveAttribute('aria-pressed', 'true');
    await expect(rsvp('Going')).toContainText('1');
    await rsvp('Maybe').click();
    await expect(G.getByText('Marked as maybe')).toBeVisible();
    await expect(rsvp('Maybe')).toHaveAttribute('aria-pressed', 'true');
    await rsvp('Maybe').click();
    await expect(rsvp('Maybe')).toHaveAttribute('aria-pressed', 'false');
    await rsvp('Going').click();
    await expect(rsvp('Going')).toHaveAttribute('aria-pressed', 'true');
    await expect(GP.locator('[data-helping-bar]')).toHaveCount(0);
    // Signing up is one tap, then "You're on it" (no RSVP question)
    await GP.locator('[data-signup="Folding chairs"]').getByRole('button', { name: 'Sign up' }).click();
    await expect(G.locator('[data-banner="on"]')).toContainText('You’re on it');
    await expect(G.locator('[data-banner="on"]')).toContainText('is counting on you');
    await expect(G.getByRole('dialog', { name: 'Will you be there?' })).toHaveCount(0);
    // "You're helping": under the photo, collapsed by default, opens to the jobs
    const bar = GP.locator('[data-helping-bar]');
    await expect(bar).toContainText('1 task');
    await expect(GP.locator('[data-screen-label="You’re helping"]')).not.toContainText('Folding chairs');
    await bar.click();
    await expect(GP.locator('[data-screen-label="You’re helping"]')).toContainText('Folding chairs');
    await expect(GP.locator('[data-signup="Folding chairs"]')).toContainText('1 of 2');
    await expect(GP.locator('[data-signup="Folding chairs"]')).toContainText('You’re in');
    // Undo takes it straight back
    await G.locator('[data-banner="on"]').getByRole('button', { name: 'Undo' }).click();
    await expect(G.getByText('Okay, you’re off it')).toBeVisible();
    await expect(GP.locator('[data-signup="Folding chairs"]')).toContainText('0 of 2');
    await GP.locator('[data-signup="Folding chairs"]').getByRole('button', { name: 'Sign up' }).click();
    await expect(GP.locator('[data-signup="Folding chairs"]')).toContainText('1 of 2');
    await expect(GP.locator('[data-signup="Folding chairs"] [data-who]')).toContainText('You');
    // The host sees who's on each job, and taps Going for the guest list with the guest's number
    await H.reload();
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    await expect(HP.locator('[data-signup="Folding chairs"] [data-who]')).toContainText('Gus');
    await HP.getByRole('button', { name: '1 Going. See who' }).click();
    const list = H.getByRole('dialog', { name: 'Guest list' });
    await expect(list.locator('[data-guest-part="going"]')).toContainText('Gus');
    await expect(list.locator('[data-guest-part="going"]')).toContainText('(512) 555-0142');
    await list.getByRole('button', { name: 'Close' }).click();
    // Adding something else signs you up for it
    await GP.getByText('Add something else').click();
    await GP.getByLabel('Bringing something else?').fill('Lemonade');
    await GP.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(GP.locator('[data-signup="Lemonade"]')).toContainText('You’re in');
    // Taking yourself off later: "You're off it" with Find a replacement
    await GP.locator('[data-signup="Lemonade"]').getByLabel('You’re in. Tap to take yourself off').click();
    const off = G.locator('[data-banner="off"]');
    await expect(off).toContainText('You’re off it');
    await expect(off.getByRole('button', { name: 'Undo' })).toBeVisible();   // takes you straight back on
    await off.getByRole('button', { name: 'Find a replacement' }).click();
    const rep = G.getByRole('dialog', { name: 'Find a replacement' });
    await expect(rep).toContainText('I can’t make it to lemonade');
    await rep.getByRole('button', { name: 'Close' }).click();
    await expect(rep).toHaveCount(0);
    await GP.locator('[data-signup="Lemonade"]').getByRole('button', { name: 'Sign up' }).click();
    await expect(GP.locator('[data-signup="Lemonade"]')).toContainText('You’re in');
    const download = G.waitForEvent('download');
    await GP.getByRole('button', { name: 'Add to calendar' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.ics$/);

    // The host sees them; changing the date tells everyone going
    await H.reload();
    await expect(HP).toContainText('1 going');
    await expect(HP.locator('[data-signup="Folding chairs"]')).toContainText('1 of 2');
    await HP.getByRole('button', { name: 'Edit date, time and location' }).click();
    const when = H.getByRole('dialog', { name: 'Date, time & location' });
    await when.getByLabel('Date', { exact: true }).fill(inDays(21));
    // Round 65a: the sheet shows what they get, and the button says it sends
    await expect(when.locator('[data-update-preview]')).toContainText('New date:');
    await expect(when.locator('[data-update-preview]')).toContainText('Goes to the 1 person going.');
    await when.getByRole('button', { name: 'Save and send', exact: true }).click();
    await expect(H.getByText('Saved. Everyone going gets an update.')).toBeVisible();
    await expect(HP).toContainText('New date:');

    // Can't while on two jobs: asked whether to free the spots too; Keep my spot keeps them
    await GP.locator('[data-rsvp]').getByRole('button', { name: /^Can’t/ }).click();
    const ask = G.getByRole('alertdialog');
    await expect(ask).toContainText('Take you off your 2 jobs too?');
    await ask.getByRole('button', { name: 'Keep my spot' }).click();
    await expect(GP.locator('[data-rsvp]').getByRole('button', { name: /^Can’t/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(GP.locator('[data-signup="Lemonade"]')).toContainText('You’re in');

    // Cancel (not delete): everyone in it, helpers included, gets a note with the reason; it stays up, marked Cancelled
    await H.reload();
    await HP.getByRole('button', { name: 'Cancel or delete this event' }).click();
    const td = H.getByRole('dialog', { name: 'Cancel or delete' });
    await expect(td.locator('[data-delete-opt]')).toContainText('No one is told.');
    await td.getByLabel('Reason (optional)').fill('Rained out');
    await td.getByRole('button', { name: 'Cancel and tell 1 person' }).click();
    await expect(H.getByText('Cancelled. Everyone in it got a note.')).toBeVisible();
    await expect(HP.locator('[data-cancelled]')).toHaveText('CANCELLED');
    await expect(HP.locator('[data-cancelled-card]')).toContainText('Rained out');
    const notes = await asUser(G, async (c) => (await c.from('notes').select('body').like('body', '%is cancelled.%')).data.map(n => n.body));
    expect(notes.some(b => b.indexOf('Rained out') > -1)).toBe(true);
    await G.reload();
    await expect(GP.locator('[data-cancelled-card]')).toContainText('is cancelled');
    await expect(GP.locator('[data-rsvp]')).toHaveCount(0);                      // no replies or sign-ups on a cancelled event
    await expect(GP.locator('[data-signup="Lemonade"]').getByRole('button', { name: 'Sign up' })).toHaveCount(0);
    // Then the host deletes it, quietly
    await HP.getByRole('button', { name: 'Delete this event' }).click();
    await confirm(H, 'Delete it');
    id = null;

    expect(host.errors).toEqual([]);
    expect(guest.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await guest.context.close();
  }
});

test('Help out: descriptions, time ranges and Pick a shift', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Hope');
  const helper = await newLead(browser, 2, 'Omar');
  const H = host.page, O = helper.page;
  const title = uniqueTitle('Coat drive');
  let id;
  try {
    id = await postEvent(H, { title, date: inDays(12), time: '17:00' });
    // The post form can't make these yet (still open in design), so the host adds them directly
    const long = 'Go through the donated bins and pile coats by size: toddler, kids, teen. Labeled tables are set up in the garage, and anything needing a wash goes on the blue tarp.';
    await asUser(H, async (c, _C, { id, long }) => {
      await c.from('signup_items').insert({ spark_id: id, item: 'Sort kids’ sizes', need: 3, time: '17:00', end_time: '18:00', descr: long });
      const job = (await c.from('signup_items').insert({ spark_id: id, item: 'Coat check table', descr: 'Hand out tickets and hang coats.' }).select('id').single()).data.id;
      await c.from('signup_items').insert([
        { spark_id: id, item: 'Coat check table', need: 1, time: '18:00', end_time: '19:00', shift_of: job },
        { spark_id: id, item: 'Coat check table', need: 1, time: '19:00', end_time: '20:00', shift_of: job }]);
    }, { id, long });

    await openIdea(O, id);
    const OP = O.locator('[data-screen-label="Plan page"]');
    const sort = OP.locator('[data-signup="Sort kids’ sizes"]');
    await expect(sort).toContainText('5:00 – 6:00pm');
    await expect(sort).toContainText('0 of 3');
    await sort.getByRole('button', { name: 'More' }).click();
    await expect(sort.getByRole('button', { name: 'Less' })).toBeVisible();
    const coat = OP.locator('[data-signup="Coat check table"]');
    await expect(coat).toContainText('2 shifts · 6:00 – 8:00pm');
    await expect(coat).toContainText('0 of 2');

    // Pick a shift: both shifts, with a note
    await coat.getByRole('button', { name: 'Sign up' }).click();
    const pick = O.getByRole('dialog', { name: 'Pick a shift' });
    await expect(pick).toContainText('Hand out tickets and hang coats.');
    await pick.locator('[data-shift="6:00 – 7:00pm"]').click();
    await pick.locator('[data-shift="7:00 – 8:00pm"]').click();
    await pick.getByLabel('Add a note, if you want').fill('Can bring hangers');
    await pick.getByRole('button', { name: 'Done' }).click();
    await expect(O.locator('[data-banner="on"]')).toContainText('You’re on it');
    await expect(coat).toContainText('2 of 2');
    await expect(coat).toContainText('You’re in');
    await O.locator('[data-helping-bar]').click();
    await expect(OP.locator('[data-screen-label="You’re helping"]')).toContainText('6:00 – 7:00pm, 7:00 – 8:00pm');
    const notes = await asUser(O, async (c) => (await c.from('signup_claims').select('note').eq('note', 'Can bring hangers')).data.length);
    expect(notes).toBe(2);
    // The host sees each shift with the note
    await H.reload();
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    const hostCoat = H.locator('[data-screen-label="Plan page"] [data-signup="Coat check table"] [data-who]');
    await expect(hostCoat).toContainText('Omar · 6:00 – 7:00pm');
    await expect(hostCoat).toContainText('“Can bring hangers”');

    // Undo takes him off every shift on that job
    await O.locator('[data-banner="on"]').getByRole('button', { name: 'Undo' }).click();
    await expect(coat).toContainText('0 of 2');
    // One shift, then drop it: "You're off it"
    await coat.getByRole('button', { name: 'Sign up' }).click();
    await pick.locator('[data-shift="7:00 – 8:00pm"]').click();
    await pick.getByRole('button', { name: 'Done' }).click();
    await expect(coat).toContainText('1 of 2');
    // Adding a second shift, then Undo, takes back only the new one
    await coat.getByLabel('You’re in. Tap to take yourself off').click();
    await pick.locator('[data-shift="6:00 – 7:00pm"]').click();
    await pick.getByRole('button', { name: 'Done' }).click();
    await expect(coat).toContainText('2 of 2');
    await O.locator('[data-banner="on"]').getByRole('button', { name: 'Undo' }).click();
    await expect(coat).toContainText('1 of 2');
    // With someone signed up, the host can't merge the shifts (it would drop them)
    await H.reload();
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);   // the jobs were added straight to the database
    await H.locator('[data-screen-label="Plan page"]').getByRole('button', { name: 'Edit what you need' }).click();
    const needs = H.getByRole('dialog', { name: 'Edit what you need' });
    await expect(needs).toContainText('People are signed up for these shifts, so they stay as shifts.');
    await expect(needs.getByText('Use one time instead')).toHaveCount(0);
    await needs.getByRole('button', { name: 'Close' }).click();
    await coat.getByLabel('You’re in. Tap to take yourself off').click();
    await pick.locator('[data-shift="7:00 – 8:00pm"]').click();
    await pick.getByRole('button', { name: 'Done' }).click();
    await expect(O.locator('[data-banner="off"]')).toContainText('We’ll let Hope know');
    await expect(coat).toContainText('0 of 2');

    expect(host.errors).toEqual([]);
    expect(helper.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await helper.context.close();
  }
});

test('it happened: the album and "do it again"; invite-only plans stay private', async ({ browser }) => {
  test.setTimeout(150000);
  const host = await newLead(browser, 1, 'Hope');
  const other = await newLead(browser, 2, 'Otto');
  const H = host.page, O = other.page;
  const title = uniqueTitle('Picnic');
  const secret = uniqueTitle('Surprise');
  const ids = [];
  try {
    // A plan from last week (made directly; the form only allows dates from today)
    const past = await asUser(H, async (c, _C, { title, day }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Hope', lead_name: 'Hope', lead_id: me, created_by: me, text: title, planned: true, day_date: day, day_time: '12:00', spot: 'Pease Park' }).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, { title, day: inDays(-3) });
    expect(past).toMatch(/^[0-9a-f-]{36}$/);
    ids.push(past);
    await openIdea(H, past);
    const done = H.locator('[data-screen-label="It happened"]');
    await expect(done).toContainText('It happened!');
    // The host can still fix the date or take it down once it's past
    await expect(done.locator('[data-done-fix]')).toContainText('Wrong date? Change it');
    await expect(done.locator('[data-done-fix]')).toContainText('Delete this event');
    await done.getByText('Wrong date? Change it').click();
    await expect(H.getByRole('dialog', { name: 'Date, time & location' })).toBeVisible();
    await H.getByRole('dialog', { name: 'Date, time & location' }).getByRole('button', { name: 'Close' }).click();
    await expect(done).toContainText('No photos yet. Anyone who went can add theirs.');
    await done.getByLabel('Add a photo to the album').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
    await expect(H.getByText('Added to the album')).toBeVisible();
    await expect(done).toContainText('The album · 1');
    // The person who added it (or the host) can take it out again
    await done.getByText('Remove', { exact: true }).click();
    await done.locator('[data-album-edit]').getByRole('button', { name: 'Remove this photo' }).click();
    await confirm(H, 'Remove it');
    await expect(done).toContainText('No photos yet.');
    await done.getByLabel('Add a photo to the album').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
    await expect(done).toContainText('The album · 1');
    await done.getByRole('button', { name: 'Do it again', exact: true }).click();
    const form = H.locator('[data-screen-label="New spark"]');
    await expect(form.getByLabel('Event title')).toHaveValue(title.charAt(0).toUpperCase() + title.slice(1));
    await form.getByRole('button', { name: 'Next' }).click();
    await form.getByText('Decide later', { exact: true }).click();
    await expect(form.getByLabel('Location')).toHaveValue('Pease Park');

    // Invite-only: Otto (in the same group) doesn't see it until he has the link
    await H.goto('/');
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    ids.push(await postEvent(H, { title: secret, date: inDays(9), inviteOnly: true }));
    await expect(H.locator('[data-screen-label="Plan page"]')).toContainText('PRIVATE');
    const hidden = await asUser(O, async (c, _C, id) => (await c.from('sparks').select('id').eq('id', id)).data.length, ids[1]);
    expect(hidden).toBe(0);
    await openIdea(O, ids[1]);
    await expect(O.locator('[data-screen-label="Plan page"] [data-rsvp]')).toBeVisible();

    expect(host.errors).toEqual([]);
  } finally {
    for (const id of ids) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await other.context.close();
  }
});

test('a cancelled idea offers nothing to do: no Sign up, Suggest, voting or Make it a plan', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Host'), mem = await newLead(browser, 2, 'Omar');
  const H = host.page, M = mem.page;
  let id;
  try {
    id = await asUser(H, async (c) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = (await c.from('sparks').insert({ group_id: g, author_name: 'Host', lead_name: 'Host', lead_id: me, created_by: me, text: '[E2E] Called off idea ' + Date.now().toString(36), planned: false }).select('id').single()).data;
      await c.from('signup_items').insert({ spark_id: r.id, item: 'Ice', need: 1 });
      await c.from('date_options').insert({ spark_id: r.id, day_date: new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10), who: 'Host' });
      await c.rpc('cancel_event', { p_spark: r.id, p_reason: 'Rained out' });
      return r.id;
    });
    for (const [P, lead] of [[M, false], [H, true]]) {
      await P.goto('/#/idea/' + id);
      await expect(P.locator('[data-screen-label="Idea page"]')).toContainText('Ice');
      await expect(P.getByText('Sign up', { exact: true })).toHaveCount(0);
      await expect(P.getByText(/^(Suggest a date|Suggest a location|Add a date|Add a location)$/)).toHaveCount(0);
      if (lead) await expect(P.getByRole('button', { name: 'Make it a plan' })).toHaveCount(0);
    }
  } finally {
    if (id) await asUser(H, async (c, _C, id) => c.rpc('delete_event', { p_spark: id, p_quiet: true }), id).catch(() => {});
    await host.context.close(); await mem.context.close();
  }
});
