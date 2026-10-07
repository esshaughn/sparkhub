// V5 plans: RSVPs (going / maybe / can't) from a guest with the link, sign-ups, updates from
// the host, a date change that tells everyone going, "it happened" with its album, and private plans.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, button, postEvent, openIdea, deleteIdea, answerGuestPrompt, donePlus, confirm, asUser, postIdea, PNG, pickDate, pickTime, timeBox, openAllGroups, rsvpTap, rsvpBar } = require('./helpers');

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
    await expect(HP.locator('[data-chip]')).toHaveCount(0);                    // v8-12: no YOU'RE LEADING chip
    await expect(HP.locator('[data-ev-menu]')).toBeVisible();      // the lead's Share menu (owner, 2026-10-07; v8-12's ⋯)
    await expect(HP.getByRole('button', { name: 'Edit event' })).toBeVisible();
    await expect(HP.locator('[data-date-corner] [data-date-tile]')).toBeVisible();   // the date tile at the photo's top right
    await expect(HP).toContainText('5:30pm');
    await expect(HP.locator('[data-led-by]')).toContainText('LED BY');      // the lead sees the card too, asked to bring in a co-lead
    await expect(HP.locator('[data-colead-ask]')).toContainText('Bring in a co-lead.');
    // The lead is Going to their own plan, and answers with the same buttons as everyone (20261101160000_lead_going.sql)
    const mine = HP.locator('[data-rsvp]');
    await expect(rsvpBar(mine, 'going')).toBeVisible();
    await expect(mine.locator('[data-going]')).toHaveAttribute('aria-label', 'See everyone going (1)');   // no counts on the buttons (owner, 2026-10-06)
    await rsvpTap(mine, 'Maybe');
    await expect(rsvpBar(mine, 'maybe')).toBeVisible();
    await rsvpTap(mine, 'Going');
    await donePlus(H);
    await expect(rsvpBar(mine, 'going')).toBeVisible();
    await expect(HP.getByRole('button', { name: /Invite people/ })).toBeVisible();
    await expect(HP).not.toContainText('Remind everyone the day before');      // retired in Update 6
    await expect(HP.locator('[data-when-card] [data-empty-spot]')).toContainText('No location yet');

    // The host adds sign-ups (with "how many") in Edit what you need, and posts an update
    await HP.locator('[data-help-empty], [data-help-edit]').first().click();
    const needs = H.getByRole('dialog', { name: 'Edit what you need' });
    await needs.getByText('Add a job or item').click();
    await needs.getByLabel('Job name 1').fill('Folding chairs');
    await needs.getByRole('button', { name: 'More for how many people' }).click();
    await needs.getByText('Add a job or item').click();   // members can't add their own any more (v8-7), so the host adds Lemonade
    await needs.getByLabel('Job name 2').fill('Lemonade');
    await needs.getByRole('button', { name: 'Save changes' }).click();
    await expect(HP.locator('[data-signup="Folding chairs"]')).toContainText('2 of 2 open');
    await asUser(H, async (c, _C, { id, b }) => c.from('plan_updates').insert({ spark_id: id, body: b, audience: 'all' }), { id: id, b: 'Parking is on the street.' });   // no Send everyone an update on the page for now (owner, 2026-10-03)
    await H.reload();
    await expect(HP).toContainText('Parking is on the street.');

    // A member opens the link: RSVP, then they sign up for things
    await openIdea(G, id);
    const GP = G.locator('[data-screen-label="Plan page"]');
    await expect(GP.locator('[data-rsvp]')).toBeVisible();
    await expect(GP).toContainText('Parking is on the street.');
    await expect(GP).toContainText('LED BY');
    await expect(GP.getByRole('button', { name: 'Say hi' })).toHaveCount(0);   // hidden until there's messaging
    await expect(GP).not.toContainText('Before the day');                     // just for the host
    const card = GP.locator('[data-rsvp]');
    await rsvpTap(card, 'Going');
    // You're going! (Design v8-11 6a): Bringing anyone? with a stepper, and who once it's above 0; Done brings the banner
    const plusPop = G.getByRole('dialog', { name: 'You’re going' });
    await expect(plusPop.getByLabel('Who’s coming with you')).toHaveCount(0);
    await plusPop.getByRole('button', { name: 'One more' }).click();
    await expect(plusPop.locator('[data-plus-count]')).toHaveText('1');
    await plusPop.getByLabel('Who’s coming with you').fill('My sister');
    await plusPop.locator('[data-plus-done]').click();
    await expect(plusPop).toHaveCount(0);
    await expect(G.getByText('You’re going. See you there!')).toBeVisible();
    // A dated event: the banner offers Add to calendar right away (research review, 2026-10-01)
    const calDownload = G.waitForEvent('download');
    await G.locator('[data-banner="going"]').getByRole('button', { name: 'Add to calendar' }).click();
    expect((await calDownload).suggestedFilename()).toMatch(/\.ics$/);
    await expect(G.locator('[data-banner="going"]')).toHaveCount(0);
    await expect(GP.locator('[data-guest-nudge]')).toHaveCount(0);
    // Once replied, one bar (You're going · Change, owner 2026-10-06); Change brings the buttons back; tapping your pick clears it
    await expect(rsvpBar(card, 'going')).toContainText('You’re going');
    await expect(GP.locator('[data-rsvp] [data-going]')).toHaveAttribute('aria-label', 'See everyone going (3)');   // Hope, Gus and the one he's bringing
    await expect.poll(() => asUser(G, async (c, _C, id) => (await c.from('rsvps').select('plus_count, plus_note').eq('spark_id', id).eq('user_id', (await c.auth.getUser()).data.user.id).single()).data, id)).toEqual({ plus_count: 1, plus_note: 'My sister' });
    await rsvpTap(card, 'Maybe');
    await expect(G.getByText('Marked as maybe')).toBeVisible();
    await expect(rsvpBar(card, 'maybe')).toContainText('You’re a maybe');
    await rsvpTap(card, 'Maybe');
    await expect(card.locator('[data-rsvp-bar]')).toHaveCount(0);
    await expect(card.getByRole('button', { name: /^Maybe/ })).toHaveAttribute('aria-pressed', 'false');
    await rsvpTap(card, 'Going');
    await donePlus(G);
    await expect(rsvpBar(card, 'going')).toBeVisible();
    await expect(GP.locator('[data-helping-bar]')).toHaveCount(0);
    // Signing up is one tap, then "You're on it" (no RSVP question)
    await GP.locator('[data-signup="Folding chairs"]').getByRole('button', { name: 'Sign up' }).click();
    await expect(G.locator('[data-banner="on"]')).toContainText('You’re on it', { timeout: 1000 });   // with the tap (owner, 2026-10-02)
    await expect(G.locator('[data-banner="on"]')).toContainText('is counting on you');
    await expect(G.getByRole('dialog', { name: 'Will you be there?' })).toHaveCount(0);
    // "You're helping": under the photo, open to start with the jobs below it (Design 27); its header collapses it to a count
    const bar = GP.locator('[data-helping-bar]');
    await expect(GP.locator('[data-screen-label="You’re helping"]')).toContainText('Folding chairs');
    await bar.click();
    await expect(bar).toContainText('1 task');
    await expect(GP.locator('[data-screen-label="You’re helping"]')).not.toContainText('Folding chairs');
    await bar.click();
    await expect(GP.locator('[data-screen-label="You’re helping"]')).toContainText('Folding chairs');
    await expect(GP.locator('[data-signup="Folding chairs"]')).toContainText('1 of 2 open');
    await expect(GP.locator('[data-signup="Folding chairs"]')).toContainText('You’re in');
    // Undo takes it straight back
    await G.locator('[data-banner="on"]').getByRole('button', { name: 'Undo' }).click();
    await expect(G.getByText('Okay, you’re off it')).toBeVisible();
    await expect(GP.locator('[data-signup="Folding chairs"]')).toContainText('2 of 2 open');
    await GP.locator('[data-signup="Folding chairs"]').getByRole('button', { name: 'Sign up' }).click();
    await expect(GP.locator('[data-signup="Folding chairs"]')).toContainText('1 of 2 open');
    await expect(GP.locator('[data-signup="Folding chairs"] [data-who]')).toContainText('You');
    // The host sees who's on each job, and taps Going for the guest list with the guest's number
    await H.reload();
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    await expect(HP.locator('[data-signup="Folding chairs"] [data-who]')).toContainText('Gus');
    await HP.locator('[data-going]').click();   // Who's in opens the guest list
    const list = H.getByRole('dialog', { name: 'Who’s coming' });
    await expect(list.locator('[data-guest-part="going"]')).toContainText('Gus');
    await list.getByRole('button', { name: 'Close' }).click();

    // A guest (no account) with the link can RSVP with just a name, and is offered an account; anything else asks for one
    await openIdea(V, id);
    const VP = V.locator('[data-screen-label="Plan page"]');
    const vCard = VP.locator('[data-rsvp]');
    await rsvpTap(vCard, 'Going');
    // The guest sheet has the same Bringing anyone? stepper (v8-11)
    await V.getByRole('dialog', { name: 'RSVP as a guest' }).getByRole('button', { name: 'One more' }).click();
    await answerGuestPrompt(V, 'Vic');
    // Then You're on the list, Vic! (2b): the event, Going · {date} and You + 1, Add to calendar and a small or save it to a free account (owner, 2026-10-07)
    const join = V.getByRole('dialog', { name: 'You’re on the list' });
    await expect(join).toContainText('You’re on the list, Vic!');
    await expect(join.locator('[data-plus-summary]')).toContainText('Going ·');
    await expect(join.locator('[data-plus-summary]')).toContainText('You + 1');
    await expect(join.locator('[data-plus-cal]')).toHaveText('Add to calendar');   // a guest's next step (owner, 2026-10-07)
    await expect(join.locator('[data-plus-signin]')).toHaveText('or save it to a free account');
    await expect(join.locator('[data-plus-done]')).toHaveText('Done');
    await join.locator('[data-plus-done]').click();
    await expect(join).toHaveCount(0);
    // No reminders without an account, so the page offers one (and can put it away); no tab bar (it only led to sign-in)
    await expect(VP.locator('[data-guest-nudge]')).toContainText('Keep this event');
    await expect(VP.locator('[data-guest-nudge]')).toContainText('Save to my account');
    await expect(V.getByRole('navigation', { name: 'Main' })).toBeHidden();
    await VP.locator('[data-signup="Folding chairs"]').getByRole('button', { name: 'Sign up' }).click();
    const signIn = V.getByRole('dialog', { name: 'Sign in' });
    await expect(signIn).toContainText('Create a free account');
    await expect(signIn).toContainText('It takes a minute, and you can vote, sign up and get reminders.');   // Design v8
    await signIn.getByRole('button', { name: 'Close' }).click();
    await expect(VP.locator('[data-signup="Folding chairs"]')).toContainText('1 of 2 open');   // still just Gus
    // The answer is still there when they come back (this event only)
    await V.reload();
    await expect(rsvpBar(vCard, 'going')).toBeVisible();
    // The host sees them on the guest list as a guest
    await H.reload();
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    await HP.locator('[data-going]').click();
    const list2 = H.getByRole('dialog', { name: 'Who’s coming' });
    await expect(list2.locator('[data-guest-part="going"]')).toContainText('Vic +1');   // who they're bringing (v8-11)
    await expect(list2.locator('[data-guest-part="going"]')).toContainText('Guest');
    await list2.getByRole('button', { name: 'Close' }).click();
    // The guest takes it back, so the counts below are the member's
    await rsvpTap(vCard, 'Going');
    await expect(vCard.locator('[data-rsvp-bar]')).toHaveCount(0);
    // Members don't add their own things any more (v8-7): no Add something else
    await expect(GP.getByText('Add something else')).toHaveCount(0);
    await GP.locator('[data-signup="Lemonade"]').getByRole('button', { name: 'Sign up' }).click();
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
    await expect(HP.locator('[data-going]')).toHaveAttribute('aria-label', 'See everyone going (2)');
    await expect(HP.locator('[data-signup="Folding chairs"]')).toContainText('1 of 2 open');
    await HP.getByRole('button', { name: 'Edit date, time and location' }).click();
    const when = H.getByRole('dialog', { name: 'Date, time & location' });
    // The end time is a small "+ Add end time" link until it's asked for, as on Create event; the ✕ takes it off again
    await expect(when.getByRole('button', { name: 'End time', exact: true })).toHaveCount(0);
    await when.getByText('Add end time').click();
    await expect(when.locator('[data-time-list] [data-time="19:00"]')).toBeVisible();
    await expect(when.locator('[data-time-list] [data-time="17:00"]')).toHaveCount(0);   // only later times
    await pickTime(when, '19:00');
    await expect(timeBox(when, 'End time')).toHaveValue('7:00pm');
    await when.getByRole('button', { name: 'Remove end time' }).click();
    await expect(when.getByText('Add end time')).toBeVisible();
    await pickDate(when, inDays(21));
    // Saving an edit tells no one (owner, 2026-10-04, Design 30): no preview, and no update posted
    await expect(when.locator('[data-update-preview]')).toHaveCount(0);
    await when.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(H.getByText('Saved', { exact: true })).toBeVisible();
    await expect(HP).not.toContainText('New date:');

    // Can't while on two jobs: asked whether to free the spots too; Keep my spot keeps them
    await rsvpTap(GP.locator('[data-rsvp]'), 'Can’t');
    const ask = G.getByRole('alertdialog');
    await expect(ask).toContainText('Take you off your 2 jobs too?');
    await ask.getByRole('button', { name: 'Keep my spot' }).click();
    await expect(rsvpBar(GP.locator('[data-rsvp]'), 'no')).toBeVisible();
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
    await expect(HP.locator('[data-cancelled-card]')).toContainText(': “Rained out”');   // {Lead}: “reason” (Design v8)
    await expect(HP.locator('[data-chip]')).toHaveCount(0);                              // CANCELLED replaces the role chip
    await expect(HP.getByRole('button', { name: 'Share' })).toBeVisible();               // Share stays
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

test('Help out: More details, time ranges and one shift per job', async ({ browser }) => {
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
    await expect(sort).toContainText('3 of 3 open');   // Design 7g: a seat per spot and the count
    await expect(sort).not.toContainText('pile coats by size');
    await sort.getByRole('button', { name: /More details/ }).click();   // the bar opens the lead's note
    await expect(sort.getByRole('button', { name: /Hide details/ })).toHaveAttribute('aria-expanded', 'true');
    await expect(sort).toContainText('pile coats by size');
    const coat = OP.locator('[data-signup="Coat check table"]');
    await expect(coat).toContainText('2 shifts');
    const early = coat.locator('[data-shift="6:00 – 7:00pm"]'), late = coat.locator('[data-shift="7:00 – 8:00pm"]');
    await expect(early).toContainText('1 open');
    await expect(late).toContainText('1 open');

    // Each shift has its own Sign up
    await early.getByRole('button', { name: 'Sign up' }).click();
    await expect(O.locator('[data-banner="on"]')).toContainText('You’re on it');
    await expect(early).toContainText('You’re in');
    await expect(early).not.toContainText('1 open');   // a full shift shows no count
    await expect(coat).toHaveAttribute('data-mine', '');
    // One shift per person per job: the other shift moves you
    await late.getByRole('button', { name: 'Sign up' }).click();
    await expect(late).toContainText('You’re in');
    await expect(early.getByRole('button', { name: 'Sign up' })).toBeVisible();
    await expect.poll(() => asUser(O, async (c, _C, id) => {
      const items = (await c.from('signup_items').select('id').eq('spark_id', id)).data.map(r => r.id);
      return (await c.from('signup_claims').select('item_id').eq('user_id', (await c.auth.getUser()).data.user.id).in('item_id', items)).data.length;
    }, id)).toBe(1);
    // The host sees him in that shift's seats
    await H.reload();
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    await expect(H.locator('[data-screen-label="Plan page"] [data-signup="Coat check table"] [data-shift="7:00 – 8:00pm"] [data-who]')).toContainText('Omar');
    // Undo takes back only the move: he's on the early shift again
    await O.locator('[data-banner="on"]').getByRole('button', { name: 'Undo' }).click();
    await expect(early).toContainText('You’re in');
    await expect(late.getByRole('button', { name: 'Sign up' })).toBeVisible();
    // With someone signed up, the host can't merge the shifts (it would drop them); the job's ✎ opens the editor
    await H.reload();
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    await H.locator('[data-screen-label="Plan page"] [data-signup="Coat check table"] [data-edit-jobs]').click();
    const needs = H.getByRole('dialog', { name: 'Edit job' });
    await expect(needs).toContainText('People are signed up for these shifts, so they stay as shifts.');
    await expect(needs.getByText('Use one time instead')).toHaveCount(0);
    await needs.getByRole('button', { name: 'Close' }).click();
    await early.getByLabel('You’re in. Tap to take yourself off').click();
    await expect(O.locator('[data-banner="off"]')).toContainText('We’ll let Hope know');
    await expect(early).toContainText('1 open');

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
    await done.getByLabel('Add a photo to the album').setInputFiles([{ name: 'p.png', mimeType: 'image/png', buffer: PNG }, { name: 'q.png', mimeType: 'image/png', buffer: PNG }]);
    await expect(H.getByText('Added 2 photos to the album')).toBeVisible();   // several in one pick (Joseph, 2026-10-03)
    await expect(done).toContainText('The album · 2');
    await done.getByRole('button', { name: 'Do it again', exact: true }).click();
    const form = H.locator('[data-screen-label="New spark"]');
    await expect(form.getByLabel('Event title')).toHaveValue(title.charAt(0).toUpperCase() + title.slice(1));
    await expect(form.locator('[data-cp-row="where"]')).toContainText('Pease Park');   // WHEN & WHERE on the one page (v8-14)

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
      // Help out is hidden on anything cancelled (Design v8-8 prototype), so the job doesn't show at all
      await expect(P.locator('[data-screen-label="Idea page"]')).toContainText('This idea is cancelled');
      await expect(P.locator('[data-screen-label="Idea page"]')).not.toContainText('Ice');
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
    await rsvpTap(rsvp, 'Going');
    await expect(rsvpBar(rsvp, 'going')).toBeVisible({ timeout: 1000 });
    await donePlus(M);
    release();
    await M.unroute('**/rest/v1/rsvps*');
    await expect.poll(() => asUser(H, async (c, _C, id) => (await c.from('rsvps').select('status').eq('spark_id', id)).data.map(r => r.status), id)).toEqual(['going', 'going']);
    // Who's going: the count is inside the card, and tapping it lists everyone going (no phone numbers for members)
    const goingCard = M.locator('[data-going]');
    await expect(goingCard).toHaveAttribute('aria-label', 'See everyone going (2)');
    await goingCard.click();
    const list = M.getByRole('dialog', { name: 'Who’s going' });
    await expect(list.locator('[data-guest-part=going]')).toContainText('You');
    await expect(list).not.toContainText('Phone numbers');
    await list.getByRole('button', { name: 'Close' }).click();
    // A failed save puts the old answer back
    await M.route('**/rest/v1/rsvps*', (route) => route.request().method() === 'GET' ? route.continue() : route.fulfill({ status: 500, body: '{}' }));
    await rsvpTap(rsvp, 'Maybe');
    await expect(M.getByText('That didn’t go through. Try again in a moment.')).toBeVisible();
    await expect(rsvpBar(rsvp, 'going')).toBeVisible();
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
test('looking for a lead: the lead steps back, someone else takes the lead', async ({ browser }) => {
  test.setTimeout(150000);
  const host = await newLead(browser, 1, 'Hope');
  const other = await newLead(browser, 2, 'Otto');
  const H = host.page, O = other.page;
  const ids = [];
  try {
    // Hope floats an idea and looks for a host
    const title = uniqueTitle('Kite day');
    const id = await postIdea(H, { title });
    ids.push(id);
    // An idea with a lead has the v8 idea page too (v8-8): Hope leads it, so Who leads it reads Me; I'll decide looks for a lead
    const HS = H.locator('[data-screen-label="Idea page (8b)"]');
    await expect(HS.locator('[data-led-line]')).toContainText('Led by you');
    await expect(HS.locator('[data-rule="me"]')).toHaveAttribute('aria-pressed', 'true');
    await HS.locator('[data-rule="decide"]').click();
    await expect(HS.locator('[data-make-this-plan]')).toContainText('Choose a lead');

    // Hope asks Otto by name (owner, 2026-10-02): Choose lead → Ask someone else → Ask → Asked, and the row says who
    const ottoId = await asUser(O, async (c) => (await c.auth.getUser()).data.user.id);
    await HS.locator('[data-plan-lead]').click();
    const choose = H.getByRole('dialog', { name: 'Choose a lead' });
    await expect(choose).toContainText('No one has offered yet.');
    await choose.locator('[data-ask-someone-else]').click();
    const ask = H.getByRole('dialog', { name: 'Ask someone to lead' });
    const ottoRow = ask.locator('[data-ask-uid="' + ottoId + '"]');
    await ottoRow.getByRole('button', { name: 'Ask Otto to lead' }).click();
    await expect(ottoRow.locator('[data-asked]')).toHaveText('Asked');
    await expect(H.locator('html[data-saving]')).toHaveCount(0);
    await ask.getByRole('button', { name: 'Close' }).click();
    await expect(HS.locator('[data-make-this-plan]')).toContainText('Asked Otto');

    // Otto's bell has the ask (and no New idea row: an idea that needs a lead isn't announced); it opens the idea's
    // member page, where Help make this a plan says Hope asked him. He's interested
    await O.reload();
    await O.getByRole('button', { name: /^Notifications/ }).click();
    const feed = O.getByRole('dialog', { name: 'Notifications' });
    await expect(feed.locator('[data-notif=leadask]').filter({ hasText: title })).toContainText('Hope asked if you’d lead');
    await expect(feed.locator('[data-notif=newevent]').filter({ hasText: title })).toHaveCount(0);
    await feed.locator('[data-notif=leadask]').filter({ hasText: title }).click();
    const OS = O.locator('[data-screen-label="Idea page (8b)"]');
    await expect(OS).toContainText('Floated by Hope');
    // The ask is a gold card at the top with both answers (20261111000000_idea_handoffs.sql)
    await expect(OS.locator('[data-lead-ask-card]')).toContainText('Hope asked if you’d lead this');
    await OS.locator('[data-im-interested]').click();
    await expect(OS.locator('[data-im-interested]')).toHaveText('✓ You’re interested');
    await expect(O.locator('html[data-saving]')).toHaveCount(0);   // the taps show at once; wait for them to be saved

    // Otto takes the lead: he gets the lead's view (Make this a plan), Hope the member's Led by card (Q31)
    await OS.locator('[data-lead-ask-card]').getByRole('button', { name: 'I’ll lead it' }).click();
    await expect(OS.locator('[data-led-line]')).toContainText('Led by you');
    await expect(OS.locator('[data-make-this-plan]')).toContainText('You’re leading it');
    await openIdea(H, id);
    await expect(HS.locator('[data-led-by8]')).toContainText('LED BY');
    await expect(HS.locator('[data-led-by8]')).toContainText('Otto');
    await expect(HS.locator('[data-im-interested]')).toHaveText('✓ You’re interested');   // the floater stays interested

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
// Asks get an answer and handoffs leave someone in charge (ideas audit 2026-10-07; 20261111000000_idea_handoffs.sql):
// the person asked says Not this time, then yes; the new lead reaches Leads from the idea page and steps back, which hands
// the idea back to whoever floated it. Discussion is on while it's floated.
test('asked to lead: Not this time, then yes; stepping back hands the idea back to the floater', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Fay');
  const other = await newLead(browser, 2, 'Ike');
  const H = host.page, O = other.page;
  let id;
  try {
    const ikeId = await asUser(O, async (c) => (await c.auth.getUser()).data.user.id);
    id = await asUser(H, async (c, _C, title) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Fay', lead_name: 'Fay', lead_id: me, created_by: me, text: title, wants_host: true }).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, uniqueTitle('Ask walk'));
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const ask = () => asUser(H, async (c, _C, { id, u }) => { const r = await c.rpc('ask_to_lead', { p_spark: id, p_user: u }); return r.error ? r.error.message : 'ok'; }, { id, u: ikeId });
    expect(await ask()).toBe('ok');
    // Ike: the ask is a gold card at the top; Discussion is there while it's floated
    await openIdea(O, id);
    const OS = O.locator('[data-screen-label="Idea page (8b)"]');
    const card = OS.locator('[data-lead-ask-card]');
    await expect(card).toContainText('Fay asked if you’d lead this');
    await expect(OS.locator('[data-discussion]')).toBeVisible();
    await expect(OS.locator('[data-disc-how]')).toContainText('Tap I’m interested to join the conversation.');
    await card.getByRole('button', { name: 'Not this time' }).click();
    await expect(O.getByRole('status')).toContainText('We let Fay know');
    await expect(card).toHaveCount(0);
    // Fay's ask is gone (she can ask someone else)
    await openIdea(H, id);
    const HS = H.locator('[data-screen-label="Idea page (8b)"]');
    await expect(HS.locator('[data-make-this-plan]')).not.toContainText('Asked Ike');
    // Asked again, Ike says yes and leads it; Leads on the idea page has Step back
    expect(await ask()).toBe('ok');
    await O.reload();
    await card.getByRole('button', { name: 'I’ll lead it' }).click();
    await expect(OS.locator('[data-make-this-plan]')).toContainText('You’re leading it');
    await OS.locator('[data-idea-leads]').click();
    await O.getByRole('dialog', { name: 'Leads' }).locator('[data-lead-row="Ike"]').getByRole('button', { name: 'Step back' }).click();
    await expect(O.getByRole('alertdialog')).toContainText('It goes back to Fay');
    await confirm(O, 'Step back');
    // Fay has it again, looking for a lead, with Choose a lead
    await openIdea(H, id);
    await expect(HS).toContainText('You floated this');
    await expect(HS.locator('[data-make-this-plan]')).toContainText('Choose a lead');
    expect(host.errors).toEqual([]);
    expect(other.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await other.context.close();
  }
});

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
    await expect(OP.locator('[data-chip]')).toHaveCount(0);   // v8-12: no HAPPENING chip
    await expect(OP.locator('[data-rsvp]').getByRole('button', { name: 'Invite people' })).toHaveCount(0);   // only the main lead invites from here
    await expect(OP.locator('[data-help-edit]')).toBeVisible();   // Help out's section Edit pill (Design v8)
    await expect(OP.locator('[data-led-by] [data-lead-names]')).toHaveText('Hope & Otto');
    await expect(OP.locator('[data-help-empty], [data-edit-jobs]').first()).toBeVisible();   // a co-lead edits the jobs too
    await asUser(O, async (c, _C, { id, b }) => c.from('plan_updates').insert({ spark_id: id, body: b, audience: 'all' }), { id: id, b: 'Meet at the north gate.' });   // no Send everyone an update on the page for now (owner, 2026-10-03)
    await O.reload();
    await expect(OP).toContainText('Meet at the north gate.');
    await expect(OP.getByRole('button', { name: 'Delete this event' })).toHaveCount(0);   // only the lead or an admin
    // Hope sees the update, but it's Otto's to remove
    await openIdea(H, id);
    await expect(HP.locator('[data-updates] [data-update]', { hasText: 'north gate' })).toBeVisible();   // first on the page (Design 29)
    await expect(HP.locator('[data-updates]').getByRole('button', { name: 'Delete this update' })).toHaveCount(0);

    // Otto steps down
    await OP.locator('[data-led-by]').getByRole('button', { name: 'Manage co-leads' }).click();
    await O.getByRole('dialog', { name: 'Leads' }).locator('[data-lead-row="Otto"]').getByRole('button', { name: 'Step down' }).click();
    await confirm(O, 'Step down');
    await expect(OP.locator('[data-ev-menu]')).toHaveCount(0);   // not a lead any more: just Share, no menu (v8-12)
    await expect(OP.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
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
      // two dates: one date is only a suggestion, not a poll (v8-8 item 5)
      await c.from('date_options').insert({ spark_id: sid, day_date: day, day_time: '18:30', who: 'Host', created_by: me });
      await c.from('date_options').insert({ spark_id: sid, day_date: new Date(Date.parse(day) + 864e5).toISOString().slice(0, 10), who: 'Host', created_by: me });
      return sid;
    }, inDays(9));
    await M.goto('/#/idea/' + id);
    const opt = M.locator('[data-when] [data-cal-page]').first();
    await expect(opt).toContainText('Be the first');
    // A slow save: the vote shows long before it lands
    let release;
    const gate = new Promise(r => { release = r; });
    await M.route('**/rest/v1/date_votes*', async (route) => { if (route.request().method() !== 'GET') await gate; await route.continue().catch(() => {}); });
    await opt.click();
    await expect(opt).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 });
    await expect(opt).toContainText('1 can go');
    release();
    await M.unroute('**/rest/v1/date_votes*');
    await expect.poll(() => asUser(H, async (c, _C, id) => (await c.from('date_options').select('date_votes(user_id)').eq('spark_id', id)).data[0].date_votes.length, id)).toBe(1);
    // A failed save puts the vote back
    await M.route('**/rest/v1/date_votes*', (route) => route.request().method() === 'GET' ? route.continue() : route.fulfill({ status: 500, body: '{}' }));
    await opt.click();
    await expect(M.getByText('That didn’t go through. Try again in a moment.')).toBeVisible();
    await expect(opt).toHaveAttribute('aria-pressed', 'true');
    await expect(opt).toContainText('1 can go');
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
    await sheet.getByLabel('Search', { exact: true }).fill(nm);
    const row = sheet.locator('[data-invitee="' + nm + '"]');
    await expect(row).toContainText('Torrez Fitness');
    // Design 24a2: the tick only picks; Send invites · N sends to everyone ticked, closes the sheet and says who
    await expect(sheet.getByRole('button', { name: 'Send', exact: true })).toHaveAttribute('aria-disabled', 'true');   // Send · N (v8-10; was Send invites)
    await row.getByRole('checkbox', { name: 'Invite ' + nm }).click();
    await expect(row.getByRole('checkbox', { name: 'Invite ' + nm })).toHaveAttribute('aria-checked', 'true');
    await sheet.getByRole('button', { name: 'Send · 1' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(H.getByText('Invited ' + nm.split(' ')[0])).toBeVisible();
    await expect.poll(() => asUser(H, async (c, _C, sid) => (await c.rpc('event_invited', { p_spark: sid })).data, id)).toContainEqual(nedra);
    sheet = await open();
    await sheet.getByLabel('Search', { exact: true }).fill(nm);
    await expect(sheet.locator('[data-invitee="' + nm + '"]')).toContainText('✓ Invited');
    await expect(sheet.getByRole('button', { name: 'Share link' })).toBeVisible();   // v8-10: Share link + Send in one footer row
    await expect(sheet.getByRole('button', { name: 'QR code' })).toBeVisible();   // v8-11: the lead's QR code
    await sheet.getByRole('button', { name: 'Close' }).click();
    // v7 Update 15: Who's coming lists her under Haven't replied; Nudge sends one note a day (then Nudged)
    await HP.locator('[data-going]').click();   // See all › under the RSVP buttons opens Who's coming (Design 25b)
    const list = H.getByRole('dialog', { name: 'Who’s coming' });
    const quiet = list.locator('[data-guest-part="none"]');
    await expect(quiet).toContainText('HAVEN’T REPLIED · 1');
    await expect(quiet).toContainText(nm);
    await quiet.getByRole('button', { name: 'Nudge ' + nm }).click();
    await expect(H.getByText('Nudged ' + nm.split(' ')[0] + ':')).toBeVisible();
    await expect(quiet.getByRole('button', { name: 'Nudged ' + nm })).toBeVisible();
    await expect.poll(() => asUser(other.page, async (c) => ((await c.from('notes').select('body').like('body', '%is hoping you can make%').gte('created_at', new Date(Date.now() - 120000).toISOString())).data || []).length)).toBeGreaterThan(0);
    await quiet.getByRole('button', { name: 'Nudged ' + nm }).click();
    await expect(H.getByText('You nudged ' + nm.split(' ')[0] + ' today. Try again tomorrow.')).toBeVisible();
    await list.getByRole('button', { name: 'Close' }).click();
    // Once she answers (Can't), Invite people shows her answer instead of Invited, and she can't be picked (owner, 2026-10-03)
    await asUser(other.page, async (c, _C, sid) => c.from('rsvps').upsert({ spark_id: sid, user_id: (await c.auth.getUser()).data.user.id, status: 'no' }, { onConflict: 'spark_id,user_id' }), id);
    await H.reload(); await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    sheet = await open();
    await sheet.getByLabel('Search', { exact: true }).fill(nm);
    await expect(sheet.locator('[data-invitee="' + nm + '"] [data-answered]')).toHaveText('Can’t');
    await expect(sheet.locator('[data-invitee="' + nm + '"]').getByRole('checkbox')).toHaveCount(0);
    // A member who's going can invite too, but only the lead and co-hosts get the QR code (v8-11 item 5)
    await asUser(other.page, async (c, _C, sid) => c.from('rsvps').upsert({ spark_id: sid, user_id: (await c.auth.getUser()).data.user.id, status: 'going' }, { onConflict: 'spark_id,user_id' }), id);
    await openIdea(other.page, id);
    await other.page.locator('[data-screen-label="Plan page"]').getByRole('button', { name: 'Share', exact: true }).click();   // a member's way in: the share icon on the photo
    const mine = other.page.getByRole('dialog', { name: 'Invite people' });
    await expect(mine.getByRole('button', { name: 'Share link' })).toBeVisible();
    await expect(mine.getByRole('button', { name: 'QR code' })).toHaveCount(0);
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
    // The lead's idea page (v8-8): When? → Add a date opens Edit dates; two dates make a poll
    const HS = H.locator('[data-screen-label="Idea page (8b)"]');
    await HS.locator('[data-when-empty]').click();
    const ed = H.getByRole('dialog', { name: 'Edit when or where' });
    await ed.getByLabel('Date').first().fill(inDays(15));
    await ed.getByText('+ Add a date', { exact: true }).click();
    await ed.getByLabel('Date').nth(1).fill(inDays(16));
    await ed.locator('[data-ip-pop-done]').click();
    await expect(H.getByRole('status')).toContainText('Saved');
    // Looking for a lead (I'll decide): Make this a plan says what's missing, and the button stays grey
    await HS.locator('[data-rule="decide"]').click();
    await expect(HS.locator('[data-make-this-plan]')).toContainText('No votes yet');
    await expect(HS.locator('[data-make-this-plan]')).toContainText('Choose a lead');
    await expect(HS.locator('[data-make-it-plan]')).toHaveText('Add a date first');
    await expect(HS.locator('[data-when] [data-cal-page]')).toHaveCount(2);
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
    // An idea again, looking for a lead, with no jobs: the v8 idea page, where Rae is the one who floated it (not its
    // lead) and the date stays
    const HS = H.locator('[data-screen-label="Idea page (8b)"]');
    await expect(HS).toContainText('You floated this');
    await expect(HS.locator('[data-make-this-plan]')).toContainText('Choose a lead');
    await expect(HS.locator('[data-plan-date]')).toHaveText('Change');   // the date stays
    expect(host.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
  }
});

// A sign-up shows on the group page straight away (Cynthia's demo, 2026-10-02: "it didn't reflect back in the group view").
// Not reproducible after af15e80 (a late refresh could undo a tap); this keeps it that way
test('a sign-up shows on the group page, the Calendar and the lead’s card', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Hope'), helper = await newLead(browser, 2, 'Omar');
  const H = host.page, O = helper.page, title = uniqueTitle('Barricades');
  const groupCard = async (P) => {
    await P.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    await P.locator('[data-screen-label=Groups]').getByRole('button', { name: 'Torrez Fitness', exact: true }).click();
    return P.locator('[data-screen-label=Browse] [data-plan="' + title + '"]');
  };
  let id;
  try {
    id = await postEvent(H, { title, date: inDays(8), time: '17:00' });
    await asUser(H, async (c, _C, id) => { await c.from('signup_items').insert({ spark_id: id, item: 'Barricades', need: 2 }); }, id);
    await O.reload(); await expect(O.locator('html[data-loaded=true]')).toHaveCount(1);
    const card = await groupCard(O);
    await expect(card).not.toContainText('Helping');
    await card.click();
    await O.locator('[data-screen-label="Plan page"] [data-signup="Barricades"]').getByRole('button', { name: 'Sign up' }).click();
    await O.locator('[data-screen-label="Plan page"]').getByRole('button', { name: /^Back/ }).first().click();
    await expect(card).toContainText('Helping');
    await O.waitForTimeout(3000);   // the refresh after the save doesn't undo it
    await expect(card).toContainText('Helping');
    await openAllGroups(O);
    await expect(O.locator('[data-screen-label="All groups"] [data-plan="' + title + '"]')).toContainText('Helping');
    // The lead's page counts the sign-up (the group card's layout depends on what else is coming up)
    await openIdea(H, id);
    await expect(H.locator('[data-screen-label="Plan page"] [data-signup="Barricades"]')).toContainText('1 of 2 open');
    expect(helper.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close(); await helper.context.close();
  }
});

// The Calendar's group filter (Joseph's demo, 2026-10-02): toggling groups never freezes the screen (an empty result
// threw on a removed Type filter), and "N events could use a hand" follows the groups that are picked
test('Calendar group filter: toggling works, and could use a hand follows it', async ({ browser }) => {
  const host = await newLead(browser, 2, 'Hope'), viewer = await newLead(browser, 1, 'Ivy');
  const H = host.page, V = viewer.page, title = uniqueTitle('Barricade hand');
  let id, gid;
  try {
    id = await postEvent(H, { title, date: inDays(3), time: '17:00' });
    await asUser(H, async (c, _C, id) => { await c.from('signup_items').insert({ spark_id: id, item: 'Barricades', need: 2 }); }, id);
    gid = await asUser(V, async (c) => { const r = await c.rpc('create_group', { p_name: '[E2E] Filter ' + Date.now().toString(36) }); return r.data[0].id || r.data[0].group_id; });
    await V.reload(); await expect(V.locator('html[data-loaded=true]')).toHaveCount(1);
    await openAllGroups(V);
    const cal = V.locator('[data-screen-label="All groups"]'), hand = cal.getByLabel(/^\d+ events? needs? help$/);
    await expect(hand).toBeVisible();
    await cal.getByRole('button', { name: /^Groups:/ }).click();
    const rows = V.getByRole('menu', { name: 'Groups' }).getByRole('menuitemcheckbox');
    const torrez = rows.filter({ hasText: 'Torrez Fitness' });
    await torrez.click();   // only the new, empty group: nothing to show, and the screen keeps working
    await expect(torrez).toHaveAttribute('aria-checked', 'false');
    await expect(cal).toContainText('Nothing matches that.');   // Design v8's narrowed empty state
    await expect(hand).toHaveCount(0);   // the banner follows the filter
    await torrez.click();
    await expect(torrez).toHaveAttribute('aria-checked', 'true');
    await expect(hand).toBeVisible();
    expect(viewer.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    if (gid) await asUser(V, async (c, _C, g) => c.rpc('e2e_delete_group', { p_group: g }), gid).catch(() => {});
    await host.context.close(); await viewer.context.close();
  }
});

// Asking someone to take a job (owner, 2026-10-02, from Cynthia's demo; reworked 2026-10-03): the lead ticks up to two
// people, each with their own optional note, sends, and the person answers I'm in (signed up) or Can't this time
test('ask someone to take a job: tick up to two, a note each, I’m in', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Hope'), helper = await newLead(browser, 2, 'Lin ' + Date.now().toString(36).slice(-4));
  const H = host.page, O = helper.page, title = uniqueTitle('Parade');
  let id;
  try {
    const lin = await asUser(O, async (c) => (await c.auth.getUser()).data.user);
    const linName = lin.user_metadata.name;
    id = await postEvent(H, { title, date: inDays(6), time: '10:00' });
    await asUser(H, async (c, _C, id) => { await c.from('signup_items').insert({ spark_id: id, item: 'Barricades', need: 2 }); }, id);
    await openIdea(H, id);
    const HP = H.locator('[data-screen-label="Plan page"]'), job = HP.locator('[data-signup="Barricades"]');
    await job.locator('[data-ask-job]').click();
    const ask = H.getByRole('dialog', { name: 'Ask someone to take it' });
    // Tick up to two, a note field under each one ticked, then one Send asks (owner, 2026-10-03)
    await expect(ask).toContainText('Ask up to 2 people. Add a note if you like.');
    await expect(ask.getByRole('button', { name: 'Send asks' })).toHaveAttribute('aria-disabled', 'true');
    const row = ask.locator('[data-job-ask-row="' + linName + '"]');
    await row.getByRole('checkbox', { name: 'Ask ' + linName }).click();
    await row.getByPlaceholder('I thought of you because…').fill('I thought of you because you were great on barricades last year');
    await ask.getByRole('button', { name: 'Send asks · 1' }).click();
    await expect(ask).toHaveCount(0);
    await expect(H.getByText('Asked ' + linName.split(' ')[0], { exact: true })).toBeVisible();   // the toast
    await expect(H.locator('html[data-saving]')).toHaveCount(0);
    // The asked lines under the job are gone (Design 12e); Your tasks' Fill spot row counts it
    await expect(HP.locator('[data-screen-label="Your tasks"]')).toContainText('Barricades · 1 asked');   // open to start (Design 27)

    // Lin's bell and the event page carry the ask and its line; I'm in signs Lin up
    await O.reload(); await expect(O.locator('html[data-loaded=true]')).toHaveCount(1);
    await O.getByRole('button', { name: /^Notifications/ }).click();
    const feed = O.getByRole('dialog', { name: 'Notifications' });
    const bell = feed.locator('[data-notif=jobask]').filter({ hasText: title });
    await expect(bell).toContainText('asked if you’d take Barricades for');
    await expect(bell).toContainText('I thought of you because you were great on barricades last year');
    await bell.click();
    const card = O.locator('[data-screen-label="Plan page"] [data-job-ask-card]');
    await expect(card).toContainText('asked if you’d take Barricades');
    await card.getByRole('button', { name: 'I’m in' }).click();
    await expect(card).toHaveCount(0);
    await expect(O.locator('[data-screen-label="Plan page"] [data-signup="Barricades"]')).toContainText('You’re in');
    expect(await asUser(O, async (c, _C, id) => (await c.from('rsvps').select('status').eq('spark_id', id).eq('user_id', (await c.auth.getUser()).data.user.id)).data[0].status, id)).toBe('going');
    expect(helper.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close(); await helper.context.close();
  }
});

// Handing the lead to someone (owner, 2026-10-02): nothing changes until they say yes; then they lead and you're a co-lead
test('hand the lead to someone: they say yes, and the old lead is a co-lead', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Hope'), other = await newLead(browser, 2, 'Otto');
  const H = host.page, O = other.page, title = uniqueTitle('Handover');
  let id;
  try {
    id = await postEvent(H, { title, date: inDays(7), time: '09:00' });
    await openIdea(H, id);
    const HP = H.locator('[data-screen-label="Plan page"]');
    await HP.locator('[data-led-by]').getByRole('button', { name: 'Manage co-leads' }).click();
    await H.getByRole('dialog', { name: 'Leads' }).locator('[data-hand-off]').click();
    const hand = H.getByRole('dialog', { name: 'Hand it to someone' });
    await hand.getByLabel('A note').fill('You know the route');
    await hand.locator('[data-hand-row="Otto"]').getByRole('button', { name: 'Hand it to Otto' }).click();
    await expect(H.getByText('Asked Otto to take it over.')).toBeVisible();
    await expect(H.locator('html[data-saving]')).toHaveCount(0);
    expect(await asUser(H, async (c, _C, id) => (await c.from('sparks').select('lead_id').eq('id', id).single()).data.lead_id === (await c.auth.getUser()).data.user.id, id)).toBe(true);

    await openIdea(O, id);
    const card = O.locator('[data-screen-label="Plan page"] [data-lead-offer-card]');
    await expect(card).toContainText('asked if you’d take over leading this');
    await expect(card).toContainText('You know the route');
    await card.getByRole('button', { name: 'I’ll take it' }).click();
    await expect(O.getByText('You’re leading it now.')).toBeVisible();
    await expect(O.locator('[data-screen-label="Plan page"]').locator('[data-ev-menu]')).toBeVisible();   // the lead's Share menu (v8-12's ⋯)
    const ids = await asUser(O, async (c, _C, id) => {
      const me = (await c.auth.getUser()).data.user.id, s = (await c.from('sparks').select('lead_id').eq('id', id).single()).data;
      const co = (await c.from('cohosts').select('user_id').eq('spark_id', id)).data.map(r => r.user_id);
      return { lead: s.lead_id === me, cohosts: co.length };
    }, id);
    expect(ids).toEqual({ lead: true, cohosts: 1 });
    expect(other.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(O, id).catch(() => {});
    await host.context.close(); await other.context.close();
  }
});
