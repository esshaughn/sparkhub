// A lead and a guest on one idea: the shared link, "I'm interested" with guest info,
// suggestions that wait for the lead, the lead setting things, the mood board.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, button, postIdea, openIdea, deleteIdea, answerGuestPrompt, PNG } = require('./helpers');

test('a guest with the link takes part; the lead decides', async ({ browser }) => {
  const lead = await newLead(browser, 1, 'Lena');
  const guest = await newMember(browser);
  const L = lead.page, G = guest.page;
  const title = uniqueTitle('Laser tag');
  let id;
  try {
    id = await postIdea(L, { title, basics: ['teams by class'] });
    const LD = L.locator('[data-screen-label="Idea page"]');
    await expect(LD).toContainText('Date TBD');
    await expect(LD).toContainText('Location TBD');
    await expect(LD.getByRole('button', { name: /Date TBD\s*Set/ })).toBeVisible();

    // The guest opens the shared link (they're not in the group)
    await openIdea(G, id);
    const GD = G.locator('[data-screen-label="Idea page"]');
    await expect(GD).toContainText('Led by Lena');
    await expect(GD).toContainText('Teams by class');
    await expect(GD.getByRole('button', { name: 'Edit' })).toHaveCount(0);

    // "I'm interested" asks for their info once, then counts them
    await button(G, 'I’m interested').click();
    const info = G.getByRole('dialog', { name: 'Your info' });
    await expect(info).toContainText('So Lena can reach you. Only they see it.');
    await expect(info.getByRole('button', { name: 'Continue' })).toHaveAttribute('aria-disabled', 'true');
    await info.getByLabel('Your name').fill('Gus');
    await info.getByLabel('Phone number').fill('555 12');
    await expect(info.getByRole('button', { name: 'Continue' })).toHaveAttribute('aria-disabled', 'true');   // too short
    await answerGuestPrompt(G, 'Gus', '(512) 555-0142');
    await expect(button(G, 'You’re interested')).toBeVisible();
    await expect(GD.getByLabel('1 interested')).toBeVisible();

    // Suggest a location and a date (no second info prompt this visit)
    await GD.getByRole('button', { name: /Location TBD\s*Suggest/ }).click();
    const offer = G.getByRole('dialog', { name: 'Know a location?' });
    await offer.getByLabel('Know a location?').fill('the north lot at Zilker');
    await offer.getByRole('button', { name: 'Offer this location' }).click();
    await expect(G.getByText('Sent to the lead')).toBeVisible();
    await expect(GD).toContainText('Gus offered a location: The north lot at Zilker · waiting on Lena');
    await GD.getByRole('button', { name: /Date TBD\s*Suggest/ }).click();
    const dateOffer = G.getByRole('dialog', { name: 'Got a date & time in mind?' });
    await dateOffer.getByLabel('Date and time').fill('2026-11-14T18:30');
    await dateOffer.getByRole('button', { name: 'Offer this date' }).click();
    await expect(G.getByRole('dialog')).toHaveCount(0);

    // The lead sees both waiting, and who's interested (with the guest's number)
    await L.reload();
    await expect(LD).toContainText('2 waiting on you');
    await expect(LD).toContainText('Gus offered a location');
    await expect(LD).toContainText('Gus suggested a date');
    await expect(LD).toContainText('Sat, Nov 14, 6:30pm');
    await LD.getByLabel('1 interested').click();
    const list = L.getByRole('dialog', { name: 'Who’s interested' });
    await expect(list).toContainText('Gus');
    await expect(list.getByRole('link', { name: '(512) 555-0142' })).toHaveAttribute('href', 'tel:5125550142');
    await list.getByRole('button', { name: 'Close' }).click();

    await LD.getByRole('button', { name: 'Use this location' }).click();
    await expect(L.getByText('Location set')).toBeVisible();
    await expect(LD.getByRole('button', { name: 'Not this time' })).toHaveCount(1);
    await LD.getByRole('button', { name: 'Not this time' }).click();
    await expect(LD).not.toContainText('waiting on you');
    await expect(LD).toContainText('The north lot at Zilker');
    await expect(LD).toContainText('Date TBD');
    await expect(LD).toContainText('Who’s pitching in');

    // The lead sets the date directly
    await LD.getByRole('button', { name: /Date TBD\s*Set/ }).click();
    const set = L.getByRole('dialog', { name: 'Set the date' });
    await set.getByLabel('Date and time').fill('2026-10-10T09:00');
    await expect(set).toContainText('Pick a day and time.');
    await set.getByRole('button', { name: 'Set date' }).click();
    await expect(LD).toContainText('Sat, Oct 10');
    await expect(LD).toContainText('9am');

    // What the lead is picturing
    await button(L, 'Say more about what you’re picturing').click();
    await L.getByRole('dialog', { name: 'Say more about it' }).getByRole('textbox').fill('Glow sticks and pizza after.');
    await L.getByRole('dialog').getByRole('button', { name: 'Add it to the spark' }).click();
    await expect(LD).toContainText('What you’re picturing');
    await expect(LD).toContainText('Glow sticks and pizza after.');

    // The vibe: lead adds and removes a photo; members only see it with photos
    await expect(LD).toContainText('0 / 3');
    await LD.getByLabel('Add a mood photo').setInputFiles({ name: 'mood.png', mimeType: 'image/png', buffer: PNG });
    await expect(LD).toContainText('1 / 3');
    await G.reload();
    await expect(GD.getByRole('button', { name: /^View mood photo/ })).toHaveCount(1);
    // Tapping a vibe photo opens it full screen; ✕ (or Escape) closes it
    await GD.getByRole('button', { name: 'View mood photo 1' }).click();
    const zoom = G.getByRole('dialog', { name: 'Photo' });
    await expect(zoom.getByRole('img', { name: 'Mood photo 1 of 1' })).toBeVisible();
    await zoom.getByRole('button', { name: 'Close' }).click();
    await expect(zoom).toHaveCount(0);
    await GD.getByRole('button', { name: 'View mood photo 1' }).click();
    await G.keyboard.press('Escape');
    await expect(zoom).toHaveCount(0);
    await expect(GD).toContainText('Sat, Oct 10');
    await LD.getByRole('button', { name: 'Remove photo' }).click();
    await expect(LD).toContainText('0 / 3');
    await G.reload();
    await expect(GD).not.toContainText('The vibe');

    // Un-interest
    await button(G, 'You’re interested').click();
    await expect(button(G, 'I’m interested')).toBeVisible();

    expect(lead.errors).toEqual([]);
    expect(guest.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(L, id).catch(() => {});
    await lead.context.close();
    await guest.context.close();
  }
});

test('"Most popular" puts the idea with the most interest first', async ({ browser }) => {
  const poster = await newLead(browser, 1, 'Pat');
  const fan = await newLead(browser, 2, 'Fay');
  const older = uniqueTitle('Popular');
  const newer = uniqueTitle('Quiet');
  const ids = [];
  try {
    ids.push(await postIdea(poster.page, { title: older }));
    ids.push(await postIdea(poster.page, { title: newer }));
    await openIdea(fan.page, ids[0]);
    await button(fan.page, 'I’m interested').click();
    await expect(fan.page.getByLabel('1 interested').first()).toBeVisible();

    const P = poster.page;
    await P.goto('/#/ideas');
    const order = async () => (await P.locator('[data-screen-label=Browse] [role=button]').allTextContents())
      .filter(t => t.includes(older) || t.includes(newer)).map(t => (t.includes(older) ? 'older' : 'newer'));
    await expect.poll(order).toEqual(['older', 'newer']);                       // Most popular (default)
    await P.getByRole('button', { name: 'Sort' }).click();
    await P.getByRole('menu', { name: 'Order by' }).getByRole('button', { name: 'Newest' }).click();
    await expect.poll(order).toEqual(['newer', 'older']);
    expect(poster.errors).toEqual([]);
    expect(fan.errors).toEqual([]);
  } finally {
    for (const id of ids) await deleteIdea(poster.page, id).catch(() => {});
    await poster.context.close();
    await fan.context.close();
  }
});

test('Edit profile: a new name shows everywhere', async ({ browser }) => {
  const me = await newLead(browser, 1, 'Sam');
  const title = uniqueTitle('Rename');
  let id;
  try {
    id = await postIdea(me.page, { title });
    await me.page.getByRole('button', { name: 'Profile' }).click();
    await button(me.page, 'Edit').click();
    const pe = me.page.getByRole('dialog', { name: 'Edit profile' });
    await expect(pe.getByRole('textbox').nth(1)).toHaveValue('e2e-lead-1@example.com');
    await pe.getByPlaceholder('First name').fill('Samira');
    await pe.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(me.page.getByText('Profile saved')).toBeVisible();
    await expect(me.page.locator('[data-screen-label=Profile]')).toContainText('Samira');
    await openIdea(me.page, id);
    await expect(me.page.locator('[data-screen-label="Idea page"]')).toContainText('Led by Samira');
    expect(me.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(me.page, id).catch(() => {});
    await me.context.close();
  }
});
