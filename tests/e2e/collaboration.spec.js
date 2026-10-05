// A lead and a member on one idea: the shared link, "I'm interested", suggestions everyone votes on,
// the lead picking, the mood board, making it a plan. A guest (no account) is asked to make one.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, leadEmail, button, pickDate, pickTime, saved, postIdea, openIdea, deleteIdea, answerGuestPrompt, confirm, PNG, openProfile } = require('./helpers');

test('a member with the link takes part; everyone votes; the lead picks and makes it a plan', async ({ browser }) => {
  const lead = await newLead(browser, 1, 'Lena');
  const guest = await newLead(browser, 2, 'Gus');
  const visitor = await newMember(browser);
  const L = lead.page, G = guest.page, V = visitor.page;
  const title = uniqueTitle('Laser tag');
  let id;
  try {
    id = await postIdea(L, { title, basics: ['teams by class'] });
    const LD = L.locator('[data-screen-label="Idea page"]');
    await expect(LD.getByLabel('Steps to a plan')).toContainText('Details');
    await expect(LD.locator('[data-plan-needs]')).toContainText('1 thing to go');   // a date: a plan needs a lead and a date (owner, 2026-10-02)
    await expect(LD.locator('[data-plan-needs] [data-plan-row="location"]')).toHaveCount(0);
    await expect(LD.locator('#sec-when [data-empty-date]')).toContainText('No date yet');   // the lead: Set a date or Run a poll (owner's mock, 2026-10-01)
    await expect(LD.locator('#sec-when [data-empty-date]').getByRole('button', { name: 'Set a date' })).toBeVisible();

    // A guest (no account) with the link sees the idea, but "I'm interested" asks them to make an account
    await openIdea(V, id);
    await expect(V.locator('[data-screen-label="Idea page"]')).toContainText('Teams by class');
    await button(V, 'I’m interested').click();
    const signIn = V.getByRole('dialog', { name: 'Sign in' });
    await expect(signIn).toContainText('Create a free account');
    await signIn.getByRole('button', { name: 'Close' }).click();
    await expect(button(V, 'I’m interested')).toBeVisible();

    // A member opens the shared link
    await openIdea(G, id);
    const GD = G.locator('[data-screen-label="Idea page"]');
    await expect(GD.locator('[data-led-by]')).toContainText('Lena');
    await expect(GD).toContainText('Teams by class');
    await expect(GD.getByRole('button', { name: 'Edit' })).toHaveCount(0);

    // "I'm interested" counts them
    await button(G, 'I’m interested').click();
    await expect(button(G, 'You’re interested')).toBeVisible({ timeout: 1000 });   // changes with the tap (owner, 2026-10-02), like RSVP
    await expect(GD.locator('#sec-people')).toContainText('1 interested');

    // Add a location and a date (owner's mock, 2026-10-02): they go on the vote, with my vote on them unless I untick it
    await GD.locator('[data-suggest-spot]').click();   // before any vote, the date & place card's + Add a location
    const offer = G.getByRole('dialog', { name: 'Add a location' });
    await expect(offer.locator('[data-offer-vote]')).toHaveAttribute('aria-checked', 'true');
    await offer.getByLabel('Location').fill('the north lot at Zilker');
    await offer.getByRole('button', { name: 'Add location', exact: true }).click();
    await expect(G.getByText(/^Location added\./)).toBeVisible();
    await expect(GD.locator('[data-picking]')).toContainText('Help pick');
    await expect(GD.getByRole('button', { name: /^Remove your vote for The north lot at Zilker \(1 vote, suggested by Gus\)/ })).toHaveAttribute('aria-pressed', 'true');
    // A tap takes the vote back, with Undo on the toast
    await GD.getByRole('button', { name: /^Remove your vote for The north lot at Zilker/ }).click();
    await expect(GD.getByRole('button', { name: /^Vote for The north lot at Zilker \(0 votes/ })).toHaveAttribute('aria-pressed', 'false', { timeout: 1000 });
    await G.getByText('Undo', { exact: true }).click();
    await expect(GD.getByRole('button', { name: /^Remove your vote for The north lot at Zilker \(1 vote/ })).toBeVisible();
    await GD.locator('[data-add-day]').click();
    const dateOffer = G.getByRole('dialog', { name: 'Add a date' });
    await pickDate(dateOffer, '2026-11-14');   // our own date picker and time list, not the browser's
    await dateOffer.getByRole('button', { name: 'Optional', exact: true }).click();
    await pickTime(dateOffer, '18:30');
    await dateOffer.getByRole('button', { name: 'Add date', exact: true }).click();
    await expect(G.getByRole('dialog')).toHaveCount(0);
    await expect(GD.getByRole('button', { name: /^Remove your vote for Sat, Nov 14 · 6:30pm \(1 vote, suggested by Gus\)/ })).toBeVisible();
    await expect(GD.locator('[data-vote-foot]')).toHaveText('You voted for 1 date and 1 location');
    await saved(G);

    // The lead sees who's interested and the suggestions, and picks
    await L.reload();
    await LD.getByRole('button', { name: 'See who’s interested' }).click();
    const list = L.getByRole('dialog', { name: 'Who’s interested' });
    await expect(list).toContainText('Gus');
    await expect(list.getByRole('link')).toHaveCount(0);   // no phone numbers: guests don't leave one
    await list.getByRole('button', { name: 'Close' }).click();
    // Pick closes each poll (as on a plan)
    await LD.getByRole('button', { name: /^Pick The north lot at Zilker/ }).click();
    await confirm(L, 'Use this location');
    await expect(LD.locator('[data-poll-opt]')).toHaveCount(1);
    await LD.getByRole('button', { name: /^Pick Sat, Nov 14/ }).click();
    await confirm(L, 'Use this date');
    await expect(LD.locator('[data-poll-opt]')).toHaveCount(0);
    await expect(LD.locator('#sec-when')).toContainText('Saturday, Nov 14');
    await expect(LD.locator('#sec-when')).toContainText('The north lot at Zilker');

    // "What you're picturing" is retired (owner, 2026-09-30): Basic details is the one place for notes
    await expect(LD.getByText('Say more about what you’re picturing')).toHaveCount(0);
    await expect(LD).not.toContainText('What you’re picturing');

    // Inspo: lead adds and removes a photo; members only see it with photos
    await expect(LD).toContainText('0 / 3');
    await LD.getByLabel('Add a mood photo').setInputFiles({ name: 'mood.png', mimeType: 'image/png', buffer: PNG });
    await expect(LD).toContainText('1 / 3');
    await G.reload();
    await expect(GD.getByRole('button', { name: /^View mood photo/ })).toHaveCount(1);
    await GD.getByRole('button', { name: 'View mood photo 1' }).click();
    const zoom = G.getByRole('dialog', { name: 'Photo' });
    await expect(zoom.getByRole('img', { name: 'Photo 1 of 1' })).toBeVisible();
    await zoom.getByRole('img', { name: 'Photo 1 of 1' }).click();   // a tap on the photo closes it, like the ✕
    await expect(zoom).toHaveCount(0);
    await LD.getByRole('button', { name: 'Remove photo' }).click();
    await expect(LD).toContainText('0 / 3');
    // Several at once (Joseph, 2026-10-03): two in one pick, one save; then only the room that's left is used
    const moodPng = (n) => ({ name: 'mood' + n + '.png', mimeType: 'image/png', buffer: PNG });
    await LD.getByLabel('Add a mood photo').setInputFiles([moodPng(1), moodPng(2)]);
    await expect(LD).toContainText('2 / 3');
    await expect(LD.getByRole('button', { name: 'View mood photo 1' })).toBeVisible();
    await expect(LD.getByRole('button', { name: 'View mood photo 2' })).toBeVisible();
    await LD.getByLabel('Add a mood photo').setInputFiles([moodPng(3), moodPng(4)]);
    await expect(L.getByText('Only 3 photos fit. Added the first 1.')).toBeVisible();
    await expect(LD).toContainText('3 / 3');
    await expect(LD.getByRole('button', { name: /^View mood photo/ })).toHaveCount(3);
    for (const n of ['2 / 3', '1 / 3', '0 / 3']) {
      await LD.getByRole('button', { name: 'Remove photo' }).first().click();
      await expect(LD).toContainText(n);
    }

    // Make it a plan: the interested member shows as going
    await expect(LD.getByLabel('Steps to a plan').locator('[data-make-plan]')).toContainText('Make it a plan!');   // in the gold strip (owner's mock, 2026-10-01)
    await LD.getByRole('button', { name: 'Make it a plan' }).click();
    await confirm(L, 'Make it a plan');
    const LP = L.locator('[data-screen-label="Plan page"]');
    await expect(LP).toContainText('YOU’RE LEADING');
    await expect(LP.locator('[data-going]')).toHaveAttribute('aria-label', 'See everyone going (2)');   // the lead is going too (20261101160000_lead_going.sql)
    await G.reload();
    const GP = G.locator('[data-screen-label="Plan page"]');
    await expect(GP.locator('[data-rsvp]').getByRole('button', { name: /^Going/ })).toHaveAttribute('aria-pressed', 'true');

    expect(lead.errors).toEqual([]);
    expect(guest.errors).toEqual([]);
    expect(visitor.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(L, id).catch(() => {});
    await lead.context.close();
    await guest.context.close();
    await visitor.context.close();
  }
});

test('the Ideas board puts the idea with the most interest first', async ({ browser }) => {
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
    await expect(fan.page.locator('#sec-people')).toContainText('1 interested');
    await saved(fan.page);

    const P = poster.page;
    await P.goto('/#/ideas');
    await P.locator('[data-screen-label=Browse]').getByRole('tab', { name: /^Ideas/ }).click();
    // The Ideas board (v6 Update 2) keeps Most popular order across its two columns: read it by rank
    const order = async () => (await P.locator('[data-screen-label=Browse] [data-card]').evaluateAll(els => els
      .map(el => [+el.getAttribute('data-rank'), el.getAttribute('data-card')]).sort((a, b) => a[0] - b[0]).map(x => x[1])))
      .filter(t => t === older || t === newer).map(t => (t === older ? 'older' : 'newer'));
    await expect.poll(order).toEqual(['older', 'newer']);
    // The quiet sort row (v6 Update 4): Newest puts the later post first
    const sortRow = P.getByRole('group', { name: 'Sort ideas' });
    await expect(sortRow.getByRole('button', { name: 'Most interest' })).toHaveAttribute('aria-pressed', 'true');
    await sortRow.getByRole('button', { name: 'Newest' }).click();
    await expect(sortRow.getByRole('button', { name: 'Newest' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(order).toEqual(['newer', 'older']);
    // The board ends with the dashed Start an event card (owner, 2026-10-01); it opens Create event
    const prompt = P.locator('[data-screen-label=Browse] [data-idea-prompt]');
    await expect(prompt).toContainText('Got a “we should…”?');
    await prompt.click();
    await expect(P.locator('[data-screen-label="New spark"]')).toContainText('1/6');
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
    await openProfile(me.page);
    await button(me.page, 'Edit profile').click();
    const pe = me.page.getByRole('dialog', { name: 'Edit profile' });
    await expect(pe.getByLabel('Email')).toHaveValue(leadEmail(1));
    await pe.getByPlaceholder('First name').fill('Samira');
    await pe.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(me.page.getByText('Profile saved')).toBeVisible();
    await expect(me.page.locator('[data-screen-label=Me]')).toContainText('Samira');
    await openIdea(me.page, id);
    await expect(me.page.locator('[data-screen-label="Idea page"]')).toBeVisible();   // (the lead doesn't see a Led by card on their own event, as on plans)
    expect(me.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(me.page, id).catch(() => {});
    await me.context.close();
  }
});
