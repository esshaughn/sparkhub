// Take part (Design v8-2, 20261106000000_take_part.sql): the lead adds court times and seats in Join in; a member claims
// one (and is Going), a guest joins the full time's waitlist with a name and phone and moves up when the member gives it
// up; the lead sees who has which spot (GUEST) and takes someone off; Maybe while holding a seat asks first.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, newMember, startPost, pickDate, pickTime, closeAskFirst, ideaIdFromUrl, openIdea, deleteIdea, confirm, rsvpTap, rsvpBar } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

test('take part: set up spots, claim, waitlist, guest, roster and giving up', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Dana');
  const member = await newLead(browser, 2, 'Theo');
  const H = host.page, M = member.page;
  const title = uniqueTitle('Open play');
  let id, guest;
  try {
    // Plan an event → + Add → Write your own with two 30-minute times, one each, and a plain item for 2 (one kind of sign-up, 2026-10-07)
    await startPost(H);
    const flow = H.locator('[data-screen-label="New spark"]');
    await flow.getByLabel('Event title').fill(title);
    const when = flow.locator('[data-cp-row="when"]');
    await pickDate(when, inDays(5));
    await when.getByRole('button', { name: 'Start time' }).click();
    await pickTime(when, '09:00');
    await flow.locator('[data-cp-add-job]').click();
    // times are set in the sheet: one time, then Add more times (owner, 2026-10-08: no Time slots chip)
    const times = H.getByRole('dialog', { name: 'Add a sign up' });
    await times.getByLabel('Sign-up name').fill('Court time');
    await times.getByText('Add details', { exact: true }).click();
    await times.getByRole('button', { name: 'Time', exact: true }).click();
    await pickTime(times, '09:00');
    await times.getByText('Add more times').click();
    await expect(times.locator('[data-shift-row]')).toHaveCount(2);
    await times.getByRole('button', { name: 'Time 1 end' }).click();
    await pickTime(times, '09:30');
    await times.getByRole('button', { name: 'Time 2 start' }).click();
    await pickTime(times, '09:30');
    await times.getByRole('button', { name: 'Time 2 end' }).click();
    await pickTime(times, '10:00');
    await expect(times.locator('[data-part-waitlist]')).toHaveAttribute('aria-checked', 'true');   // on by default
    await times.getByRole('button', { name: 'Save', exact: true }).click();   // always Save (Design v8)
    await flow.locator('[data-cp-add-job]').click();
    const seats = H.getByRole('dialog', { name: 'Add a sign up' });
    await seats.getByLabel('Sign-up name').fill('Beginner clinic');
    await seats.getByRole('button', { name: 'More for how many people' }).click();
    await seats.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(flow.locator('[data-job="Court time"]')).toContainText('2 times from 9am · 1 each');
    await expect(flow.locator('[data-job="Beginner clinic"]')).toContainText('2 people');
    await flow.locator('[data-post]').click();
    await expect(H.locator('[data-screen-label="Plan page"]')).toBeVisible();
    await closeAskFirst(H);
    id = ideaIdFromUrl(H);
    const HP = H.locator('[data-screen-label="Plan page"]');
    await expect(HP.locator('#sec-tasks [data-part]')).toHaveCount(2);
    await expect(HP.locator('[data-part="Court time"]')).toContainText('2 times · 1 each');
    await expect(HP.locator('[data-part-claim]')).toHaveCount(3);   // hosts sign up too (one kind of sign-up, 2026-10-07)

    // Theo claims 9:00am: it's his, and he's Going
    await openIdea(M, id);
    const MP = M.locator('[data-screen-label="Plan page"]');
    await MP.locator('[data-part-row="9:00am"] [data-part-claim]').click();
    // You're signed up!, as for a job (owner, 2026-10-07; was a toast)
    const onIt = M.getByRole('dialog', { name: 'You’re signed up' });
    await expect(onIt.locator('[data-onit-summary]')).toContainText('Court time');
    await expect(onIt.locator('[data-onit-summary]')).toContainText('9:00am');
    await expect(onIt.locator('[data-onit-account]')).toHaveCount(0);   // an account: no Create account
    await onIt.locator('[data-onit-done]').click();
    await expect(MP.locator('[data-part-row="9:00am"]')).toHaveAttribute('data-mine', '');
    await expect(MP.locator('[data-part-row="9:00am"]')).toContainText('You’re in');
    await expect(rsvpBar(MP.locator('[data-rsvp]'), 'going')).toBeVisible();
    await MP.locator('[data-part="Beginner clinic"] [data-part-claim]').click();
    await M.locator('[data-onit-done]').click();
    await expect(MP.locator('[data-part="Beginner clinic"]')).toContainText('You’re in');

    // A guest (no account): 9:00am is full, so Waitlist asks for a name and a phone or email
    guest = await newMember(browser, '/#/idea/' + id);
    const G = guest.page, GP = G.locator('[data-screen-label="Plan page"]');
    await expect(GP.locator('[data-part-row="9:00am"]')).toContainText('Full');
    await GP.locator('[data-part-row="9:00am"] [data-part-waitlist-btn]').click();
    const sheet = G.getByRole('dialog', { name: 'Sign up' });
    await expect(sheet).toContainText('COURT TIME · 9:00AM');
    await expect(sheet).toContainText('Only the hosts see your phone or email.');
    await expect(sheet).toContainText('Without an account we can’t tell you when a spot opens.');   // jobs audit M5
    await sheet.getByLabel('Your name').fill('Sam Kim');
    await expect(sheet.locator('[data-guest-why]')).toContainText('With a free account');   // the nudge toward an account (owner, 2026-10-10)
    await sheet.getByLabel('Phone number or email').fill('512-555');   // too short: not accepted
    await expect(sheet.getByRole('button', { name: 'Join the waitlist' })).toHaveAttribute('aria-disabled', 'true');
    await sheet.getByLabel('Phone number or email').fill('sam@example.com');   // an email works as well as a phone
    await sheet.getByRole('button', { name: 'Join the waitlist' }).click();
    await expect(GP.locator('[data-part-row="9:00am"]')).toContainText('You’re 1st in line');

    // The lead's roster: who has it, and who's waiting
    await H.reload();
    await HP.locator('[data-part-row="9:00am"]').click();
    const roster = H.getByRole('dialog', { name: 'Who’s signed up' });
    await expect(roster).toContainText('1 of 2 signed up');
    await expect(roster.locator('[data-roster-waiting]')).toHaveText('Waiting: Sam');
    await roster.getByRole('button', { name: 'Close' }).click();

    // Theo gives 9:00am up: Sam moves up (the database does it)
    await M.reload();
    await MP.locator('[data-part-row="9:00am"] [data-part-give-up]').click();
    await expect(M.getByRole('alertdialog')).toContainText('Is that really what you want?');   // asks first (owner, 2026-10-10)
    await confirm(M, 'Yes, remove me');
    await expect(M.locator('[data-banner="off"]')).toContainText('You’re off it');   // as for a job (2026-10-07)
    await G.reload();
    await expect(GP.locator('[data-part-row="9:00am"]')).toContainText('You’re in');

    // The lead sees Sam as a GUEST, and takes them off
    await H.reload();
    await HP.locator('[data-part-row="9:00am"]').click();
    await expect(roster.locator('[data-roster-person]')).toContainText('GUEST');
    await expect(roster.locator('[data-roster-person] a[href="mailto:sam@example.com"]')).toBeVisible();   // the hosts can reach a guest
    await roster.locator('[data-roster-remove]').click();
    await confirm(H, 'Remove');
    await G.reload();
    await expect(GP.locator('[data-part-row="9:00am"] [data-part-claim]')).toBeVisible();

    // Can't while signed up: take you off it too? (the same check for every item, 2026-10-07)
    await M.reload();
    await rsvpTap(MP.locator('[data-rsvp]'), 'Can’t');
    const ask = M.getByRole('alertdialog');
    await expect(ask).toContainText('Take you off “Beginner clinic” too?');
    await ask.getByRole('button', { name: 'Take me off', exact: true }).click();
    await expect(MP.locator('[data-part="Beginner clinic"] [data-part-claim]')).toBeVisible();
  } finally {
    if (guest) await guest.context.close();
    if (id) await deleteIdea(H, id);
    await host.context.close();
    await member.context.close();
  }
});
