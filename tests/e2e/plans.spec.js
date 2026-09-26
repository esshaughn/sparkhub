// V5 plans: the event form, RSVPs (going / maybe / can't) from a guest with the link,
// sign-ups, updates from the host, the host's "before the day" notes, clearing the date,
// "it happened" with its album, and invite-only plans.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, button, postEvent, openIdea, deleteIdea, answerGuestPrompt, confirm, asUser, PNG } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

test('a plan: guest RSVPs, sign-ups, an update, the host’s notes, then clearing the date', async ({ browser }) => {
  test.setTimeout(150000);
  const host = await newLead(browser, 1, 'Hope');
  const guest = await newMember(browser);
  const H = host.page, G = guest.page;
  const title = uniqueTitle('Chili');
  let id;
  try {
    id = await postEvent(H, { title, date: inDays(20), time: '17:30', details: 'Bring a bowl.' });
    const HP = H.locator('[data-screen-label="Plan page"]');
    await expect(HP).toContainText('IT’S A PLAN · IN 20 DAYS');
    await expect(HP).toContainText('5:30pm · hosted by Hope');
    await expect(HP).toContainText('Bring a bowl.');
    await expect(HP).toContainText('Your guest list');
    await expect(HP.getByRole('switch', { name: 'Remind everyone the day before' })).toHaveAttribute('aria-checked', 'true');
    await expect(HP).toContainText('Location TBD');

    // The host adds sign-ups (with "how many") and posts an update
    await HP.getByLabel('Add a sign-up').fill('Folding chairs');
    await HP.getByLabel('How many needed').fill('2');
    await HP.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(H.getByText('Added to sign-ups')).toBeVisible();
    await expect(HP.locator('[data-signup="Folding chairs"]')).toContainText('0 of 2 · 2 still needed');
    await HP.getByRole('button', { name: 'Send an update' }).click();
    const blast = H.getByRole('dialog', { name: 'Send an update' });
    await blast.getByLabel('Your update').fill('Parking is on the street.');
    await blast.getByRole('button', { name: 'Post update' }).click();
    await expect(H.getByText('Posted to the plan')).toBeVisible();
    await expect(HP).toContainText('Parking is on the street.');

    // The host's private notes
    await HP.getByText('What if it rains?').click();
    await HP.getByLabel('What if it rains?').fill('Move it to the garage');
    await HP.getByLabel('What if it rains?').press('Enter');
    await expect(HP).toContainText('Move it to the garage');
    await expect(HP).toContainText('1 of 4 thought through');

    // The guest opens the link: RSVP asks for their info once, then they sign up for things
    await openIdea(G, id);
    const GP = G.locator('[data-screen-label="Plan page"]');
    await expect(GP).toContainText('Are you coming?');
    await expect(GP).toContainText('Parking is on the street.');
    await expect(GP).not.toContainText('Before the day');                     // just for the host
    await GP.getByRole('button', { name: 'I’m going' }).click();
    await answerGuestPrompt(G, 'Gus', '(512) 555-0142');
    await expect(G.getByText('You’re going. See you there!')).toBeVisible();
    await expect(GP.getByRole('button', { name: '✓ Going' })).toHaveAttribute('aria-pressed', 'true');
    await GP.getByRole('button', { name: 'Maybe' }).click();
    await expect(G.getByText('Marked as maybe')).toBeVisible();
    await GP.getByRole('button', { name: 'I’m going' }).click();
    await expect(GP.getByRole('button', { name: '✓ Going' })).toBeVisible();
    await GP.locator('[data-signup="Folding chairs"]').getByRole('button', { name: 'Sign up' }).click();
    await expect(G.getByText('You’re down for folding chairs')).toBeVisible();
    await expect(GP.locator('[data-signup="Folding chairs"]')).toContainText('1 of 2 · 1 still needed');
    await GP.getByLabel('Bringing something else?').fill('Lemonade');
    await GP.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(G.getByText('Thanks! You’re down for lemonade')).toBeVisible();
    await expect(GP.locator('[data-signup="Lemonade"]')).toContainText('Gus');
    const download = G.waitForEvent('download');
    await GP.getByText('Add to calendar').click();
    expect((await download).suggestedFilename()).toMatch(/\.ics$/);

    // The host sees them; then clears the date: back to an idea, the guest shows as interested
    await H.reload();
    await expect(HP).toContainText('1 going');
    await expect(HP.locator('[data-signup="Folding chairs"]')).toContainText('Gus');
    await HP.getByText('Clear the date').click();
    await confirm(H, 'Clear the date');
    const HI = H.locator('[data-screen-label="Idea page"]');
    await expect(HI.getByLabel('1 interested')).toBeVisible();

    expect(host.errors).toEqual([]);
    expect(guest.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await guest.context.close();
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
    await expect(done).toContainText('No photos yet. Anyone who went can add theirs.');
    await done.getByLabel('Add a photo to the album').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
    await expect(H.getByText('Added to the album')).toBeVisible();
    await expect(done).toContainText('The album · 1');
    await done.getByRole('button', { name: 'Do it again', exact: true }).click();
    const form = H.locator('[data-screen-label="New spark"]');
    await expect(form.getByLabel('What', { exact: true })).toHaveValue(title.charAt(0).toUpperCase() + title.slice(1));
    await expect(form.getByLabel('Location')).toHaveValue('Pease Park');

    // Invite-only: Otto (in the same group) doesn't see it until he has the link
    await H.goto('/');
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    ids.push(await postEvent(H, { title: secret, date: inDays(9), inviteOnly: true }));
    await expect(H.locator('[data-screen-label="Plan page"]')).toContainText('INVITE ONLY');
    const hidden = await asUser(O, async (c, _C, id) => (await c.from('sparks').select('id').eq('id', id)).data.length, ids[1]);
    expect(hidden).toBe(0);
    await openIdea(O, ids[1]);
    await expect(O.locator('[data-screen-label="Plan page"]')).toContainText('Are you coming?');

    expect(host.errors).toEqual([]);
  } finally {
    for (const id of ids) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await other.context.close();
  }
});
