// Two members on one idea: dates, interest, offers that wait for the lead,
// RSVP privacy, removing a date, stepping back, and someone else taking over.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, button, postIdea, openIdea, confirm, deleteIdea, asUser, answerNamePrompt } = require('./helpers');

test('lead and member work on the same idea', async ({ browser }) => {
  const lead = await newMember(browser);
  const member = await newMember(browser);
  const title = uniqueTitle('Laser tag');
  let id;

  try {
    // Lead posts with location and date left open, then puts two dates up for a vote
    id = await postIdea(lead.page, { title, name: 'Lena' });
    const L = lead.page;
    await expect(L.getByText('Location: we’ll decide together.')).toBeVisible();
    for (const when of ['2026-10-10T18:00', '2026-10-11T09:30']) {
      await L.getByRole('button', { name: /^Add a date option/ }).first().click();
      await L.getByLabel('Date and time').fill(when);
      await button(L, 'Put it up for a vote').click();
      await expect(L.getByRole('dialog')).toBeHidden();
    }
    await expect(L.getByText('Sat, Oct 10, 6pm')).toBeVisible();
    await expect(L.getByText('Sun, Oct 11, 9:30am')).toBeVisible();

    // Member opens the shared link
    const M = member.page;
    await openIdea(M, id);
    await expect(button(M, 'Edit')).toHaveCount(0);           // not the lead
    await expect(M.getByText('Be the first')).toBeVisible();

    // Interest toggles on and off, then on
    await button(M, 'I’m interested').click();
    await expect(button(M, 'You’re interested')).toHaveAttribute('aria-pressed', 'true');
    await expect(M.getByText('1 interested')).toBeVisible();
    await button(M, 'You’re interested').click();
    await expect(M.getByText('Be the first')).toBeVisible();
    await button(M, 'I’m interested').click();

    // Offer a spot: asks for a name first, then waits for the lead
    await button(M, 'Offer a spot').click();
    await answerNamePrompt(M, 'Dee');
    await M.getByRole('textbox', { name: 'Know a spot?' }).fill('Blast Zone on 5th');
    await button(M, 'Offer this spot').click();
    await expect(M.getByText('Sent to the lead')).toBeVisible();
    await expect(M.getByText('waiting on Lena')).toBeVisible();
    await expect(M.getByText('Location: we’ll decide together.')).toBeVisible();   // unchanged until approved

    // Offering help posts straight away
    await button(M, 'I can help with something').click();
    await M.getByRole('textbox', { name: 'What can you help with?' }).fill('bringing water');
    await button(M, 'Send it over').click();
    await expect(M.getByText('can help: bringing water')).toBeVisible();

    // RSVP to the first date
    await button(M, 'RSVP').click();
    await M.getByRole('checkbox', { name: 'Sat, Oct 10, 6pm' }).click();
    await expect(M.getByLabel('Your name')).toHaveValue('Dee');                 // name carried over
    await M.getByLabel('Phone number').fill('555 010 0003');
    await button(M, 'Send my RSVP').click();
    await expect(M.getByText('You’re on the list')).toBeVisible();
    await expect(button(M, 'Change my RSVP')).toBeVisible();

    // Privacy: the member can read only their own RSVP; the lead can read it with the phone number
    const memberSees = await asUser(M, async (c, _C, id) => (await c.from('rsvps').select('name,phone').eq('spark_id', id)).data, id);
    expect(memberSees).toEqual([{ name: 'Dee', phone: '555 010 0003' }]);
    const leadSees = await asUser(L, async (c, _C, id) => (await c.from('rsvps').select('name,phone').eq('spark_id', id)).data, id);
    expect(leadSees).toEqual([{ name: 'Dee', phone: '555 010 0003' }]);

    // Lead: sees the interest, the waiting offer, and who picked which date
    await L.reload();
    await expect(L.getByText('1 interested')).toBeVisible();
    await expect(L.getByText('Waiting on you')).toBeVisible();
    await expect(L.getByText('Blast Zone on 5th')).toBeVisible();
    await expect(L.getByText('1 in', { exact: true })).toBeVisible();
    await expect(L.locator('div[style*="margin:0 -12px"]', { hasText: 'Sat, Oct 10, 6pm' })).toContainText('Dee');   // who picked it

    await button(L, 'Use this spot').click();
    await expect(L.getByText('Spot set')).toBeVisible();
    await expect(L.getByText('The spot: Blast Zone on 5th.')).toBeVisible();
    await expect(L.getByText('Waiting on you')).toHaveCount(0);

    // Remove the date Dee picked: asks first, and Dee stays on the list
    await L.getByRole('button', { name: 'Remove' }).first().click();
    await expect(L.getByRole('alertdialog')).toContainText('1 person picked it.');
    await confirm(L, 'Remove it');
    await expect(L.getByText('Sat, Oct 10, 6pm')).toHaveCount(0);
    await expect(L.getByText('1 in', { exact: true })).toBeVisible();

    // Every idea has a lead: no leaderless states, no taking over or stepping back
    for (const P of [L, M]) {
      await P.reload();
      await expect(P.locator('[data-screen-label=Detail]')).toBeVisible();
      await expect(P.getByText(/needs a lead|take the lead|step back|waiting for a lead/i)).toHaveCount(0);
    }
    // …and no minimum head count anywhere
    await expect(L.getByText(/success is|short of|enough to go/i)).toHaveCount(0);

    // Profile lists it under "Ideas you lead" for the lead only
    await button(L, 'Profile').click();
    await expect(L.locator('[data-screen-label=Profile]')).toContainText(title);
    await button(M, 'Profile').click();
    await expect(M.locator('[data-screen-label=Profile]')).not.toContainText(title);

    expect(lead.errors).toEqual([]);
    expect(member.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(lead.page, id).catch(() => {});
    await lead.context.close();
    await member.context.close();
  }
});

test('"Most popular" puts the idea with the most interest first', async ({ browser }) => {
  const poster = await newMember(browser);
  const fan = await newMember(browser);
  const older = uniqueTitle('Popular');
  const newer = uniqueTitle('Quiet');
  const ids = [];
  try {
    ids.push(await postIdea(poster.page, { title: older, name: 'Pat' }));
    ids.push(await postIdea(poster.page, { title: newer }));

    await openIdea(fan.page, ids[0]);
    await button(fan.page, 'I’m interested').click();
    await expect(fan.page.getByText('1 interested')).toBeVisible();

    const P = poster.page;
    await P.goto('/#/ideas');
    await P.reload();
    const cards = P.locator('[data-screen-label=Browse] [data-on]').filter({ hasText: '[E2E]' });
    const order = async () => (await cards.allTextContents()).filter(t => t.includes(older) || t.includes(newer)).map(t => (t.includes(older) ? 'older' : 'newer'));

    await expect.poll(order).toEqual(['newer', 'older']);                       // Newest (waits for the list to load)
    await P.getByRole('button', { name: /Newest/ }).click();
    await P.locator('div[data-menu] > div[data-menu] > div[data-on]').filter({ hasText: 'Most popular' }).click();
    await expect(P.getByRole('button', { name: /Most popular/ })).toBeVisible();
    await expect.poll(order).toEqual(['older', 'newer']);                       // Most popular

    // The card's interest pill uses the person icon, showing 1 for the popular one
    const popularCard = cards.filter({ hasText: older });
    await expect(popularCard.locator('[aria-label="1 interested"] circle')).toHaveCount(1);
    expect(poster.errors).toEqual([]);
    expect(fan.errors).toEqual([]);
  } finally {
    for (const id of ids) await deleteIdea(poster.page, id).catch(() => {});
    await poster.context.close();
    await fan.context.close();
  }
});

test('changing your name renames you everywhere', async ({ browser }) => {
  const me = await newMember(browser);
  const title = uniqueTitle('Rename');
  let id;
  try {
    id = await postIdea(me.page, { title, name: 'Sam' });
    await button(me.page, 'Profile').click();
    await button(me.page, 'Change name').click();
    await expect(me.page.getByRole('heading', { name: 'Change name' })).toBeVisible();
    await me.page.getByLabel('First name').fill('Samira');
    await button(me.page, 'Continue').click();
    await expect(me.page.locator('[data-screen-label=Profile]')).toContainText('Samira');

    await openIdea(me.page, id);
    await expect(me.page.locator('[data-screen-label=Detail]').getByText('Samira', { exact: true })).toBeVisible();
    const row = await asUser(me.page, async (c, _C, id) => (await c.from('sparks').select('author_name,lead_name').eq('id', id).single()).data, id);
    expect(row).toEqual({ author_name: 'Samira', lead_name: 'Samira' });
    expect(me.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(me.page, id).catch(() => {});
    await me.context.close();
  }
});
