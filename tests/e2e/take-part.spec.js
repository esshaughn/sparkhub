// Take part (Design v8-2, 20261106000000_take_part.sql): the lead adds court times and seats in Join in; a member claims
// one (and is Going), a guest joins the full time's waitlist with a name and phone and moves up when the member gives it
// up; the lead sees who has which spot (GUEST) and takes someone off; Maybe while holding a seat asks first.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, newMember, startPost, pickDate, pickTime, closeAskFirst, ideaIdFromUrl, openIdea, deleteIdea, confirm } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

test('take part: set up spots, claim, waitlist, guest, roster and giving up', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Dana');
  const member = await newLead(browser, 2, 'Theo');
  const H = host.page, M = member.page;
  const title = uniqueTitle('Open play');
  let id, guest;
  try {
    // Plan an event → Join in: PARTICIPATE's Claim time (two 30-minute rows, one spot each) and Claim seat (2 seats)
    await startPost(H);
    const flow = H.locator('[data-screen-label="New spark"]');
    const next = () => flow.getByRole('button', { name: 'Next', exact: true }).click();
    await flow.getByLabel('Event title').fill(title);
    await next();
    await pickDate(flow, inDays(5));
    await flow.getByRole('button', { name: 'Add a start time (optional)' }).click();
    await pickTime(flow, '09:00');
    await next();
    await flow.getByText('Decide later', { exact: true }).click();
    await flow.getByText('Decide later', { exact: true }).click();
    await expect(flow).toContainText('PARTICIPATE');
    await flow.locator('[data-part-chip="Claim time"]').click();
    const times = H.getByRole('dialog', { name: 'Add time slots' });
    await expect(times).toContainText('TAKE PART · CLAIM TIME');
    await times.getByLabel('Name the time slots').fill('Court time');
    await expect(times.locator('[data-part-time]')).toHaveCount(2);
    for (const k of [1, 2]) for (let n = 0; n < 3; n++) await times.getByRole('button', { name: 'Fewer for time ' + k }).click();
    await expect(times.locator('[data-part-waitlist]')).toHaveAttribute('aria-checked', 'true');   // on by default
    await times.getByRole('button', { name: 'Add', exact: true }).click();
    await flow.locator('[data-part-chip="Claim seat"]').click();
    const seats = H.getByRole('dialog', { name: 'Add seats' });
    await seats.getByLabel('Name the seats').fill('Beginner clinic');
    for (let n = 0; n < 6; n++) await seats.getByRole('button', { name: 'Fewer for how many seats' }).click();
    await seats.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(flow.locator('[data-job="Court time"]')).toContainText('Take part · 2 times · 2 spots');
    await expect(flow.locator('[data-job="Beginner clinic"]')).toContainText('Take part · 2 seats');
    await next();
    await expect(flow).toContainText('REVIEW');
    await expect(flow).toContainText('2 times · 2 spots');
    await flow.locator('[data-post]').click();
    await expect(H.locator('[data-screen-label="Plan page"]')).toBeVisible();
    await closeAskFirst(H);
    id = ideaIdFromUrl(H);
    const HP = H.locator('[data-screen-label="Plan page"]');
    await expect(HP.locator('#sec-take-part [data-part]')).toHaveCount(2);
    await expect(HP.locator('[data-part="Court time"]')).toContainText('2 times · 1 each');
    await expect(HP.locator('[data-part-claim]')).toHaveCount(0);   // hosts don't claim

    // Theo claims 9:00am: it's his, and he's Going
    await openIdea(M, id);
    const MP = M.locator('[data-screen-label="Plan page"]');
    await MP.locator('[data-part-row="9:00am"] [data-part-claim]').click();
    await expect(M.getByText('9:00am court time is yours. You’re going.')).toBeVisible();
    await expect(MP.locator('[data-part-row="9:00am"]')).toHaveAttribute('data-mine', '');
    await expect(MP.locator('[data-part-row="9:00am"]')).toContainText('You’re in');
    await expect(MP.locator('[data-rsvp]').getByRole('button', { name: /^Going/ })).toHaveAttribute('aria-pressed', 'true');
    await MP.locator('[data-part="Beginner clinic"] [data-part-claim]').click();
    await expect(MP.locator('[data-part="Beginner clinic"]')).toContainText('You’re in');

    // A guest (no account): 9:00am is full, so Waitlist asks for a name and phone
    guest = await newMember(browser, '/#/idea/' + id);
    const G = guest.page, GP = G.locator('[data-screen-label="Plan page"]');
    await expect(GP.locator('[data-part-row="9:00am"]')).toContainText('Full');
    await GP.locator('[data-part-row="9:00am"] [data-part-waitlist-btn]').click();
    const sheet = G.getByRole('dialog', { name: 'Claim this spot' });
    await expect(sheet).toContainText('COURT TIME · 9:00AM');
    await expect(sheet).toContainText('Only the lead sees this.');
    await sheet.getByLabel('Your name').fill('Sam Kim');
    await sheet.getByLabel('Phone number').fill('512-555-0100');
    await sheet.getByRole('button', { name: 'Join the waitlist' }).click();
    await expect(GP.locator('[data-part-row="9:00am"]')).toContainText('You’re 1st in line');

    // The lead's roster: who has it, and who's waiting
    await H.reload();
    await HP.locator('[data-part-row="9:00am"]').click();
    const roster = H.getByRole('dialog', { name: 'Who has which spot' });
    await expect(roster).toContainText('1 of 2 claimed');
    await expect(roster.locator('[data-roster-waiting]')).toHaveText('Waiting: Sam');
    await roster.getByRole('button', { name: 'Close' }).click();

    // Theo gives 9:00am up: Sam moves up (the database does it)
    await M.reload();
    await MP.locator('[data-part-row="9:00am"] [data-part-give-up]').click();
    await expect(M.getByText('You gave up 9:00am court time.')).toBeVisible();
    await G.reload();
    await expect(GP.locator('[data-part-row="9:00am"]')).toContainText('You’re in');

    // The lead sees Sam as a GUEST, and takes them off
    await H.reload();
    await HP.locator('[data-part-row="9:00am"]').click();
    await expect(roster.locator('[data-roster-person]')).toContainText('GUEST');
    await roster.locator('[data-roster-remove]').click();
    await confirm(H, 'Remove');
    await G.reload();
    await expect(GP.locator('[data-part-row="9:00am"] [data-part-claim]')).toBeVisible();

    // Maybe while holding a seat: Give up your spot? first
    await M.reload();
    await MP.locator('[data-rsvp]').getByRole('button', { name: /^Maybe/ }).click();
    const ask = M.getByRole('alertdialog');
    await expect(ask).toContainText('Give up your spot?');
    await expect(ask).toContainText('You have Beginner clinic.');
    await ask.getByRole('button', { name: 'Give it up', exact: true }).click();
    await expect(MP.locator('[data-part="Beginner clinic"] [data-part-claim]')).toBeVisible();
  } finally {
    if (guest) await guest.context.close();
    if (id) await deleteIdea(H, id);
    await host.context.close();
    await member.context.close();
  }
});
