// V5 plans: RSVPs (going / maybe / can't) from a guest with the link, sign-ups, updates from
// the host, a date change that tells everyone going, "it happened" with its album, and private plans.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, button, postEvent, openIdea, deleteIdea, answerGuestPrompt, confirm, asUser, postIdea, PNG, pickDate } = require('./helpers');

// Local dates, like the app (toISOString would be UTC, a day ahead in the evening)
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('a plan: RSVPs, a guest, sign-ups, an update, the host’s notes, then clearing the date', async ({ browser }) => {
  test.setTimeout(150000);
  const host = await newLead(browser, 1, 'Hope');
  const guest = await newLead(browser, 2, 'Gus');      // a member: guests without an account can only RSVP (below)
  const visitor = await newMember(browser);
  const H = host.page, G = guest.page, V = visitor.page;
  const title = uniqueTitle('Chili');
  let id;
  try {
    id = await postEvent(H, { title, date: inDays(20), time: '17:30' });
    const HP = H.locator('[data-screen-label="Plan page"]');
    await expect(HP).toContainText('YOU’RE LEADING');                          // v6 Update 6: the host's chip
    await expect(HP).toContainText('5:30pm');
    await expect(HP.locator('[data-led-by]')).toContainText('LED BY');      // the lead sees the card too, asked to bring in a co-lead
    await expect(HP.locator('[data-colead-ask]')).toContainText('Bring in a co-lead.');
    // The lead is Going to their own plan, and answers with the same buttons as everyone (20261101160000_lead_going.sql)
    const mine = HP.locator('[data-rsvp]');
    await expect(mine.getByRole('button', { name: /^Going/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(mine.getByRole('button', { name: /^Going/ })).toContainText('1');
    await mine.getByRole('button', { name: /^Maybe/ }).click();
    await expect(mine.getByRole('button', { name: /^Maybe/ })).toHaveAttribute('aria-pressed', 'true');
    await mine.getByRole('button', { name: /^Going/ }).click();
    await expect(mine.getByRole('button', { name: /^Going/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(HP.getByRole('button', { name: /Invite people/ })).toBeVisible();
    await expect(HP).not.toContainText('Remind everyone the day before');      // retired in Update 6
    await expect(HP.locator('[data-when-card] [data-empty-spot]')).toContainText('No location yet');

    // The host adds sign-ups (with "how many") in Edit what you need, and posts an update
    await HP.getByRole('button', { name: 'Edit what you need' }).click();
    const needs = H.getByRole('dialog', { name: 'Edit what you need' });
    await needs.getByText('Add a job or item').click();
    await needs.getByLabel('Job name 1').fill('Folding chairs');
    await needs.getByRole('button', { name: 'More for how many people' }).click();
    await needs.getByRole('button', { name: 'Save changes' }).click();
    await expect(HP.locator('[data-signup="Folding chairs"]')).toContainText('0/2');
    await HP.getByRole('button', { name: 'Send everyone an update' }).click();
    const blast = H.getByRole('dialog', { name: 'Send an update' });
    await blast.getByLabel('Your update').fill('Parking is on the street.');
    await blast.getByRole('button', { name: 'Post update' }).click();
    await expect(H.getByText('Posted to the event')).toBeVisible();
    await expect(HP).toContainText('Parking is on the street.');

    // A member opens the link: RSVP, then they sign up for things
    await openIdea(G, id);
    const GP = G.locator('[data-screen-label="Plan page"]');
    await expect(GP.locator('[data-rsvp]')).toBeVisible();
    await expect(GP).toContainText('Parking is on the street.');
    await expect(GP).toContainText('LED BY');
    await expect(GP.getByRole('button', { name: 'Say hi' })).toHaveCount(0);   // hidden until there's messaging
    await expect(GP).not.toContainText('Before the day');                     // just for the host
    const rsvp = (k) => GP.locator('[data-rsvp]').getByRole('button', { name: new RegExp('^' + k) });
    await rsvp('Going').click();
    await expect(G.getByText('You’re going. See you there!')).toBeVisible();
    // A dated event: the banner offers Add to calendar right away (research review, 2026-10-01)
    const calDownload = G.waitForEvent('download');
    await G.locator('[data-banner="going"]').getByRole('button', { name: 'Add to calendar' }).click();
    expect((await calDownload).suggestedFilename()).toMatch(/\.ics$/);
    await expect(G.locator('[data-banner="going"]')).toHaveCount(0);
    await expect(GP.locator('[data-guest-nudge]')).toHaveCount(0);
    // v6 Update 5: three buttons with counts; the pick is filled; tapping it again clears it
    await expect(rsvp('Going')).toHaveAttribute('aria-pressed', 'true');
    await expect(rsvp('Going')).toContainText('2');
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
    await expect(GP.locator('[data-signup="Folding chairs"]')).toContainText('1/2');
    await expect(GP.locator('[data-signup="Folding chairs"]')).toContainText('You’re in');
    // Undo takes it straight back
    await G.locator('[data-banner="on"]').getByRole('button', { name: 'Undo' }).click();
    await expect(G.getByText('Okay, you’re off it')).toBeVisible();
    await expect(GP.locator('[data-signup="Folding chairs"]')).toContainText('0/2');
    await GP.locator('[data-signup="Folding chairs"]').getByRole('button', { name: 'Sign up' }).click();
    await expect(GP.locator('[data-signup="Folding chairs"]')).toContainText('1/2');
    await expect(GP.locator('[data-signup="Folding chairs"] [data-who]')).toContainText('You');
    // The host sees who's on each job, and taps Going for the guest list with the guest's number
    await H.reload();
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    await expect(HP.locator('[data-signup="Folding chairs"] [data-who]')).toContainText('Gus');
    await HP.locator('[data-going]').click();   // Who's in opens the guest list
    const list = H.getByRole('dialog', { name: 'Guest list' });
    await expect(list.locator('[data-guest-part="going"]')).toContainText('Gus');
    await list.getByRole('button', { name: 'Close' }).click();

    // A guest (no account) with the link can RSVP with just a name, and is offered an account; anything else asks for one
    await openIdea(V, id);
    const VP = V.locator('[data-screen-label="Plan page"]');
    const vRsvp = (k) => VP.locator('[data-rsvp]').getByRole('button', { name: new RegExp('^' + k) });
    await vRsvp('Going').click();
    await answerGuestPrompt(V, 'Vic');
    await expect(V.getByText('You’re going. See you there!')).toBeVisible();
    const join = V.getByRole('alertdialog');
    await expect(join).toContainText('You’re on the list');
    await expect(join.getByRole('button', { name: 'Create an account' })).toBeVisible();
    await join.getByRole('button', { name: 'Not now' }).click();
    await expect(join).toHaveCount(0);
    // No reminders without an account, so the page offers one; and no tab bar (it only led to sign-in)
    await expect(VP.locator('[data-guest-nudge]')).toContainText('Want a reminder?');
    await expect(V.getByRole('navigation', { name: 'Main' })).toBeHidden();
    await VP.locator('[data-signup="Folding chairs"]').getByRole('button', { name: 'Sign up' }).click();
    const signIn = V.getByRole('dialog', { name: 'Sign in' });
    await expect(signIn).toContainText('Create a free account');
    await expect(signIn).toContainText('Guests can RSVP.');
    await signIn.getByRole('button', { name: 'Close' }).click();
    await expect(VP.locator('[data-signup="Folding chairs"]')).toContainText('1/2');   // still just Gus
    // The answer is still there when they come back (this event only)
    await V.reload();
    await expect(vRsvp('Going')).toHaveAttribute('aria-pressed', 'true');
    // The host sees them on the guest list as a guest
    await H.reload();
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    await HP.locator('[data-going]').click();
    const list2 = H.getByRole('dialog', { name: 'Guest list' });
    await expect(list2.locator('[data-guest-part="going"]')).toContainText('Vic');
    await expect(list2.locator('[data-guest-part="going"]')).toContainText('Guest');
    await list2.getByRole('button', { name: 'Close' }).click();
    // The guest takes it back, so the counts below are the member's
    await vRsvp('Going').click();
    await expect(vRsvp('Going')).toHaveAttribute('aria-pressed', 'false');
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
    await expect(HP).toContainText('2 going');
    await expect(HP.locator('[data-signup="Folding chairs"]')).toContainText('1/2');
    await HP.getByRole('button', { name: 'Edit date, time and location' }).click();
    const when = H.getByRole('dialog', { name: 'Date, time & location' });
    await pickDate(when, inDays(21));
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
    expect(visitor.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await guest.context.close();
    await visitor.context.close();
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
    await expect(sort).toContainText('0/3');
    await sort.getByRole('button', { name: 'Details' }).click();   // Details opens the description
    await expect(sort.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-expanded', 'true');
    const coat = OP.locator('[data-signup="Coat check table"]');
    await expect(coat).toContainText('2 shifts');   // the owner's mock: just the count of shifts
    await expect(coat).toContainText('0/2');

    // Pick a shift: both shifts, with a note
    await coat.getByRole('button', { name: 'Sign up' }).click();
    const pick = O.getByRole('dialog', { name: 'Pick a shift' });
    await expect(pick).toContainText('Hand out tickets and hang coats.');
    await pick.locator('[data-shift="6:00 – 7:00pm"]').click();
    await pick.locator('[data-shift="7:00 – 8:00pm"]').click();
    await pick.getByLabel('Add a note, if you want').fill('Can bring hangers');
    await pick.getByRole('button', { name: 'Done' }).click();
    await expect(O.locator('[data-banner="on"]')).toContainText('You’re on it');
    await expect(coat).toContainText('2/2');
    await expect(coat).toContainText('You’re in');
    await O.locator('[data-helping-bar]').click();
    await expect(OP.locator('[data-screen-label="You’re helping"]')).toContainText('6:00 – 7:00pm, 7:00 – 8:00pm');
    // Only this event's claims (a stray [E2E] Coat drive from an interrupted run would count too)
    const notes = await asUser(O, async (c, _C, id) => {
      const items = (await c.from('signup_items').select('id').eq('spark_id', id)).data.map(r => r.id);
      return (await c.from('signup_claims').select('note').eq('note', 'Can bring hangers').in('item_id', items)).data.length;
    }, id);
    expect(notes).toBe(2);
    // The host sees each shift with the note
    await H.reload();
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    const hostCoat = H.locator('[data-screen-label="Plan page"] [data-signup="Coat check table"] [data-who]');
    await expect(hostCoat).toContainText('Omar · 6:00 – 7:00pm');
    await expect(hostCoat).toContainText('“Can bring hangers”');

    // Undo takes him off every shift on that job
    await O.locator('[data-banner="on"]').getByRole('button', { name: 'Undo' }).click();
    await expect(coat).toContainText('0/2');
    // One shift, then drop it: "You're off it"
    await coat.getByRole('button', { name: 'Sign up' }).click();
    await pick.locator('[data-shift="7:00 – 8:00pm"]').click();
    await pick.getByRole('button', { name: 'Done' }).click();
    await expect(coat).toContainText('1/2');
    // Adding a second shift, then Undo, takes back only the new one
    await coat.getByLabel('You’re in. Tap to take yourself off').click();
    await pick.locator('[data-shift="6:00 – 7:00pm"]').click();
    await pick.getByRole('button', { name: 'Done' }).click();
    await expect(coat).toContainText('2/2');
    await O.locator('[data-banner="on"]').getByRole('button', { name: 'Undo' }).click();
    await expect(coat).toContainText('1/2');
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
    await expect(coat).toContainText('0/2');

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
    // Do it again? sits above them, and a past event is only deleted, never cancelled (owner, 2026-10-01)
    expect(await done.evaluate((el) => el.innerText.indexOf('Do it again?') < el.innerText.indexOf('Wrong date? Change it'))).toBe(true);
    await done.locator('[data-done-fix]').getByRole('button', { name: 'Delete this event' }).click();
    await expect(H.getByRole('alertdialog', { name: 'Delete this event?' })).toContainText('It already happened, so no one is told.');
    await H.getByRole('alertdialog', { name: 'Delete this event?' }).getByRole('button', { name: 'Keep it' }).click();
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

test('RSVP buttons change as soon as they are tapped (the save follows), and go back if it fails', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Host'), mem = await newLead(browser, 2, 'Omar');
  const H = host.page, M = mem.page;
  let id;
  try {
    id = await asUser(H, async (c) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const d = new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10);
      return (await c.from('sparks').insert({ group_id: g, author_name: 'Host', lead_name: 'Host', lead_id: me, created_by: me, text: '[E2E] Quick RSVP ' + Date.now().toString(36), planned: true, day_date: d }).select('id').single()).data.id;
    });
    await M.goto('/#/idea/' + id);
    const rsvp = M.locator('[data-rsvp]');
    // A slow save: the button is already on long before it lands
    let release;
    const gate = new Promise(r => { release = r; });
    await M.route('**/rest/v1/rsvps*', async (route) => { if (route.request().method() !== 'GET') await gate; await route.continue().catch(() => {}); });
    await rsvp.getByRole('button', { name: /^Going/ }).click();
    await expect(rsvp.getByRole('button', { name: /^Going/ })).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 });
    release();
    await M.unroute('**/rest/v1/rsvps*');
    await expect.poll(() => asUser(H, async (c, _C, id) => (await c.from('rsvps').select('status').eq('spark_id', id)).data.map(r => r.status), id)).toEqual(['going', 'going']);
    // Who's going: the count is inside the card, and tapping it lists everyone going (no phone numbers for members)
    const goingCard = M.locator('[data-going]');
    await expect(goingCard).toContainText('2 going');
    await goingCard.click();
    const list = M.getByRole('dialog', { name: 'Who’s going' });
    await expect(list.locator('[data-guest-part=going]')).toContainText('You');
    await expect(list).not.toContainText('Phone numbers');
    await list.getByRole('button', { name: 'Close' }).click();
    // A failed save puts the old answer back
    await M.route('**/rest/v1/rsvps*', (route) => route.request().method() === 'GET' ? route.continue() : route.fulfill({ status: 500, body: '{}' }));
    await rsvp.getByRole('button', { name: /^Maybe/ }).click();
    await expect(M.getByText('That didn’t go through. Try again in a moment.')).toBeVisible();
    await expect(rsvp.getByRole('button', { name: /^Going/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(rsvp.getByRole('button', { name: /^Maybe/ })).toHaveAttribute('aria-pressed', 'false');
    // Who's in also shows where it's posted; a member taps the group to open it (only the lead gets Edit)
    const where = M.locator('[data-vis]');
    await expect(where).toContainText('Torrez Fitness');
    await expect(where).toContainText('Public');
    await expect(where.getByRole('button', { name: 'Edit who can see it' })).toHaveCount(0);
    await where.locator('[data-group-link]').click();
    await expect(M.locator('[data-screen-label=Browse]').getByRole('heading', { name: 'Torrez Fitness' })).toBeVisible();
  } finally {
    if (id) await asUser(H, async (c, _C, id) => c.rpc('delete_event', { p_spark: id, p_quiet: true }), id).catch(() => {});
    await host.context.close(); await mem.context.close();
  }
});

// Social-science review (2026-10-01): floating an idea and hosting it are separate jobs; RSVPs aren't attendance
test('looking for a lead: the lead steps back, someone else takes the lead; "I could help"', async ({ browser }) => {
  test.setTimeout(150000);
  const host = await newLead(browser, 1, 'Hope');
  const other = await newLead(browser, 2, 'Otto');
  const H = host.page, O = other.page;
  const ids = [];
  try {
    // Hope floats an idea and looks for a host
    const id = await postIdea(H, { title: uniqueTitle('Kite day') });
    ids.push(id);
    const HI = H.locator('[data-screen-label="Idea page"]');
    // Looking for a lead is stepping back (owner, 2026-10-01: no Looking for a lead card): Edit → Leads → Step back
    await HI.locator('[data-led-by]').getByRole('button', { name: 'Manage co-leads' }).click();
    await H.getByRole('dialog', { name: 'Leads' }).locator('[data-lead-row="Hope"]').getByRole('button', { name: 'Step back' }).click();
    await confirm(H, 'Step back');
    await expect(HI.locator('[data-plan-needs] [data-plan-row="lead"]')).toContainText('Someone to lead');

    // Otto sees it needs a host, is interested and could help
    await openIdea(O, id);
    const OI = O.locator('[data-screen-label="Idea page"]');
    await expect(OI.locator('[data-plan-needs] [data-plan-row="lead"]')).toContainText('Could be you');
    await expect(OI.locator('[data-led-by]')).toContainText('FLOATED BY');
    await expect(OI.locator('[data-can-help]')).toHaveCount(0);           // only once you're interested
    await OI.getByRole('button', { name: 'I’m interested' }).click();
    await OI.locator('[data-can-help]').click();
    await expect(OI.locator('[data-can-help]')).toHaveAttribute('aria-checked', 'true');

    // Hope sees who could help
    await openIdea(H, id);
    await HI.getByRole('button', { name: 'See who’s interested' }).click();
    await expect(H.getByRole('dialog', { name: 'Who’s interested' }).locator('[data-interested]', { hasText: 'Otto' })).toContainText('Can help');
    await H.getByRole('dialog', { name: 'Who’s interested' }).getByRole('button', { name: 'Close' }).click();

    // Otto takes the lead
    await OI.locator('[data-plan-row="lead"]').getByRole('button', { name: 'I’ll lead' }).click();
    await confirm(O, 'I’ll lead it');
    await expect(OI).toContainText('YOU’RE LEADING');
    await expect(OI.locator('[data-plan-row="lead"]')).toHaveCount(0);
    await openIdea(H, id);
    await expect(HI.locator('[data-led-by]')).toContainText('LED BY');
    await expect(HI.locator('[data-led-by]')).toContainText('Otto');
    await expect(HI.getByRole('button', { name: 'You’re interested' })).toBeVisible();   // the floater stays interested

    // Who came: a plan from two days ago that Otto said yes to
    const past = await asUser(H, async (c, _C, { title, day }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Hope', lead_name: 'Hope', lead_id: me, created_by: me, text: title, planned: true, day_date: day }).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, { title: uniqueTitle('Came walk'), day: inDays(-2) });
    expect(past).toMatch(/^[0-9a-f-]{36}$/);
    ids.push(past);
    await asUser(O, async (c, _C, id) => { await c.from('rsvps').insert({ spark_id: id, status: 'going' }); }, past);
    await openIdea(H, past);
    const done = H.locator('[data-screen-label="It happened"]');
    await expect(done).toContainText('2 SAID YES');
    await expect(done.locator('[data-who-came]')).toHaveCount(0);   // Who came? is off the page for now (owner, 2026-10-01)
    expect(host.errors).toEqual([]);
  } finally {
    await asUser(O, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, ids[0]).catch(() => {});
    for (const id of ids) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await other.context.close();
  }
});

// Co-leads (20261101130000_cohosts.sql; one Led by card, owner's mock 2026-10-01): the lead adds one from the group;
// they lead alongside, but can't delete it
test('co-leads: the lead adds one, who edits and posts updates but can’t delete it, then steps down', async ({ browser }) => {
  test.setTimeout(150000);
  const host = await newLead(browser, 1, 'Hope');
  const other = await newLead(browser, 2, 'Otto');
  const H = host.page, O = other.page;
  let id;
  try {
    id = await asUser(H, async (c, _C, { title, day }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Hope', lead_name: 'Hope', lead_id: me, created_by: me, text: title, planned: true, day_date: day }).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, { title: uniqueTitle('Co walk'), day: inDays(12) });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await openIdea(H, id);
    const HP = H.locator('[data-screen-label="Plan page"]');
    const card = HP.locator('[data-led-by]');
    await expect(card.locator('[data-lead-names]')).toHaveText('Hope');
    await card.locator('[data-colead-ask]').getByRole('button', { name: 'Co-lead' }).click();
    const pick = H.getByRole('dialog', { name: 'Add a co-lead' });
    await pick.locator('[data-pick-cohost="Otto"]').click();
    await expect(H.getByText('Otto is a co-lead now')).toBeVisible();
    await expect(card.locator('[data-lead-names]')).toHaveText('Hope & Otto');
    await expect(card.locator('[data-colead-ask]')).toHaveCount(0);
    await card.getByRole('button', { name: 'Manage co-leads' }).click();
    const leads = H.getByRole('dialog', { name: 'Leads' });
    await expect(leads.locator('[data-lead-row="Hope"]')).toContainText('Lead');
    await expect(leads.locator('[data-lead-row="Otto"]')).toContainText('Remove');
    await leads.getByRole('button', { name: 'Close' }).click();

    // Otto hosts alongside Hope
    await openIdea(O, id);
    const OP = O.locator('[data-screen-label="Plan page"]');
    await expect(OP).toContainText('YOU’RE CO-LEADING');
    await expect(OP.locator('[data-led-by] [data-lead-names]')).toHaveText('Hope & Otto');
    await expect(OP.getByRole('button', { name: 'Edit what you need' })).toBeVisible();
    await OP.getByRole('button', { name: 'Send everyone an update' }).click();
    const blast = O.getByRole('dialog', { name: 'Send an update' });
    await blast.getByLabel('Your update').fill('Meet at the north gate.');
    await blast.getByRole('button', { name: 'Post update' }).click();
    await expect(OP).toContainText('Meet at the north gate.');
    await expect(OP.getByRole('button', { name: 'Delete this event' })).toHaveCount(0);   // only the lead or an admin
    // Hope sees the update, but it's Otto's to remove
    await openIdea(H, id);
    await expect(HP.locator('[data-update]', { hasText: 'north gate' })).toBeVisible();
    await expect(HP.locator('[data-update]', { hasText: 'north gate' }).getByRole('button', { name: 'Remove this update' })).toHaveCount(0);

    // Otto steps down
    await OP.locator('[data-led-by]').getByRole('button', { name: 'Manage co-leads' }).click();
    await O.getByRole('dialog', { name: 'Leads' }).locator('[data-lead-row="Otto"]').getByRole('button', { name: 'Step down' }).click();
    await confirm(O, 'Step down');
    await expect(OP).toContainText('HAPPENING');
    await expect(OP.locator('[data-led-by] [data-lead-names]')).toHaveText('Hope');
    await expect(OP.locator('[data-manage-coleads]')).toHaveCount(0);
    expect(host.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await other.context.close();
  }
});

test('a vote on a suggested date changes as soon as it is tapped (the save follows), and goes back if it fails', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Host'), mem = await newLead(browser, 2, 'Omar');
  const H = host.page, M = mem.page;
  let id;
  try {
    id = await asUser(H, async (c, _C, day) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const sid = (await c.from('sparks').insert({ group_id: g, author_name: 'Host', lead_name: 'Host', lead_id: me, created_by: me, text: '[E2E] Quick vote ' + Date.now().toString(36) }).select('id').single()).data.id;
      await c.from('date_options').insert({ spark_id: sid, day_date: day, day_time: '18:30', who: 'Host', created_by: me });
      return sid;
    }, inDays(9));
    await M.goto('/#/idea/' + id);
    const opt = M.locator('[data-poll-opt]');
    await expect(opt).toContainText('0 votes');
    // A slow save: the vote shows long before it lands
    let release;
    const gate = new Promise(r => { release = r; });
    await M.route('**/rest/v1/date_votes*', async (route) => { if (route.request().method() !== 'GET') await gate; await route.continue().catch(() => {}); });
    await opt.getByRole('button', { name: /^Vote for / }).click();
    await expect(opt.getByRole('button', { name: /^Remove your vote for / })).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 });
    await expect(opt).toContainText('1 vote');
    release();
    await M.unroute('**/rest/v1/date_votes*');
    await expect.poll(() => asUser(H, async (c, _C, id) => (await c.from('date_options').select('date_votes(user_id)').eq('spark_id', id)).data[0].date_votes.length, id)).toBe(1);
    // A failed save puts the vote back
    await M.route('**/rest/v1/date_votes*', (route) => route.request().method() === 'GET' ? route.continue() : route.fulfill({ status: 500, body: '{}' }));
    await opt.getByRole('button', { name: /^Remove your vote for / }).click();
    await expect(M.getByText('That didn’t go through. Try again in a moment.')).toBeVisible();
    await expect(opt.getByRole('button', { name: /^Remove your vote for / })).toHaveAttribute('aria-pressed', 'true');
    await expect(opt).toContainText('1 vote');
  } finally {
    if (id) await asUser(H, async (c, _C, id) => c.rpc('delete_event', { p_spark: id, p_quiet: true }), id).catch(() => {});
    await host.context.close(); await mem.context.close();
  }
});

// Invite people (owner's mock, 2026-10-01; 20261101170000_invite_people.sql): the sheet lists friends and the event's
// groups' members; Invite turns into ✓ Invited, and stays that way when the sheet opens again
test('invite people: the lead invites a group member from the sheet; Invited sticks', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Ivy');
  const nm = 'Nedra ' + Date.now().toString(36).slice(-4);   // unique: other e2e leads may carry an old name
  const other = await newLead(browser, 2, nm);
  const H = host.page;
  let id;
  try {
    const nedra = await asUser(other.page, async (c) => (await c.auth.getUser()).data.user.id);
    id = await asUser(H, async (c, _C, { title, day }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Ivy', lead_name: 'Ivy', lead_id: me, created_by: me, text: title, planned: true, day_date: day }).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, { title: uniqueTitle('Invite walk'), day: inDays(9) });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await openIdea(H, id);
    const HP = H.locator('[data-screen-label="Plan page"]');
    const open = async () => { await HP.getByRole('button', { name: /Invite people/ }).click(); return H.getByRole('dialog', { name: 'Invite people' }); };
    let sheet = await open();
    await sheet.getByLabel('Search friends and groups').fill(nm);
    const row = sheet.locator('[data-invitee="' + nm + '"]');
    await expect(row).toContainText('Torrez Fitness');
    await row.getByRole('button', { name: 'Invite ' + nm }).click();
    await expect(row).toContainText('Invited');
    await expect.poll(() => asUser(H, async (c, _C, sid) => (await c.rpc('event_invited', { p_spark: sid })).data, id)).toContainEqual(nedra);
    await sheet.getByRole('button', { name: 'Close' }).click();
    sheet = await open();
    await sheet.getByLabel('Search friends and groups').fill(nm);
    await expect(sheet.locator('[data-invitee="' + nm + '"]')).toContainText('Invited');
    await expect(sheet.getByRole('link', { name: 'Messages' })).toHaveAttribute('href', /^sms:/);
    await sheet.getByRole('button', { name: 'Close' }).click();
    expect(host.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await other.context.close();
  }
});

// An idea with no date: the lead sets one or runs a poll right from When and where (owner's mock, 2026-10-01).
// It needs a lead and a date to become a plan (20261101200000_plan_needs_lead.sql)
test('no date yet: the lead runs a date poll from the idea; stepping back blocks Make it a plan', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Pia');
  const H = host.page;
  let id;
  try {
    id = await asUser(H, async (c, _C, title) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Pia', lead_name: 'Pia', lead_id: me, created_by: me, text: title }).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, uniqueTitle('Poll walk'));
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await openIdea(H, id);
    const HI = H.locator('[data-screen-label="Idea page"]');
    await HI.locator('[data-empty-date]').getByRole('button', { name: 'Run a poll' }).click();
    const poll = H.getByRole('dialog', { name: 'Poll the group' });
    await pickDate(poll, inDays(15), 'Date option 1');
    await pickDate(poll, inDays(16), 'Date option 2');
    await poll.getByRole('button', { name: 'Save' }).click();
    await expect(H.getByText('Poll started. Everyone can vote now.')).toBeVisible();
    await expect(HI.locator('#sec-when')).toContainText('VOTING ON A DATE');
    await expect(HI.locator('[data-empty-date]')).toHaveCount(0);
    // Looking for a lead: Make it a plan names both missing pieces
    await HI.locator('[data-led-by]').getByRole('button', { name: 'Manage co-leads' }).click();
    await H.getByRole('dialog', { name: 'Leads' }).locator('[data-lead-row="Pia"]').getByRole('button', { name: 'Step back' }).click();
    await confirm(H, 'Step back');
    await expect(HI.locator('[data-plan-needs]')).toContainText('2 things to go');
    await expect(HI.locator('[data-plan-needs] [data-plan-row="lead"]')).toContainText('Someone to lead');
    expect(await asUser(H, async (c, _C, sid) => { await c.from('sparks').update({ day_date: new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10) }).eq('id', sid); const r = await c.rpc('make_plan', { p_spark: sid }); return r.error ? 'refused' : 'ALLOWED'; }, id)).toBe('refused');
    expect(host.errors.filter(e => !/status of 400/.test(e))).toEqual([]);   // the refused make_plan above
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
  }
});

// Step back as lead (owner, 2026-10-01; 20261101210000_step_back.sql): Edit on the Led by card → Leads → Step back.
// With no co-lead, the plan goes back to an idea that's looking for a lead
test('the lead steps back from a plan: it is an idea again, looking for a lead', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Rae');
  const H = host.page;
  let id;
  try {
    id = await asUser(H, async (c, _C, { title, day }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Rae', lead_name: 'Rae', lead_id: me, created_by: me, text: title, planned: true, day_date: day }).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, { title: uniqueTitle('Step walk'), day: inDays(11) });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await openIdea(H, id);
    await H.locator('[data-screen-label="Plan page"] [data-led-by]').getByRole('button', { name: 'Manage co-leads' }).click();
    await H.getByRole('dialog', { name: 'Leads' }).locator('[data-lead-row="Rae"]').getByRole('button', { name: 'Step back' }).click();
    await confirm(H, 'Step back');
    const HI = H.locator('[data-screen-label="Idea page"]');
    await expect(HI.locator('[data-plan-needs] [data-plan-row="lead"]')).toContainText('Someone to lead');
    await expect(HI.locator('[data-led-by]')).toContainText('FLOATED BY');
    await expect(HI.locator('#sec-when')).not.toContainText('No date yet');   // the date stays
    expect(host.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
  }
});
