// A lead and a member on one idea: the shared link, "I'm interested", suggestions everyone votes on,
// the lead picking, the mood board, making it a plan. A guest (no account) is asked to make one.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, leadEmail, button, pickDate, pickTime, saved, postIdea, openIdea, deleteIdea, answerGuestPrompt, confirm, PNG, openProfile, rsvpBar } = require('./helpers');
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

// An idea with a lead (v8-8, Q31 1a + 1b + 1e): the member's Led by card, suggestions, the lead's Pick pop-ups, then
// Make it a plan! opens Review prefilled and Post it turns the idea into the event; everyone interested is Maybe
test('a member with the link takes part; the lead picks and makes it a plan', async ({ browser }) => {
  const lead = await newLead(browser, 1, 'Lena');
  const guest = await newLead(browser, 2, 'Gus');
  const visitor = await newMember(browser);
  const L = lead.page, G = guest.page, V = visitor.page;
  const title = uniqueTitle('Laser tag');
  let id;
  try {
    id = await postIdea(L, { title });
    const LD = L.locator('[data-screen-label="Idea page (8b)"]');
    await expect(LD.locator('[data-led-line]')).toContainText('Led by you');
    await expect(LD.locator('[data-make-it-plan]')).toHaveText('Add a date first');

    // A guest (no account) with the link sees the idea, but "I'm interested" asks them to make an account
    await openIdea(V, id);
    const VD = V.locator('[data-screen-label="Idea page (8b)"]');
    await expect(VD).toContainText(title.charAt(0).toUpperCase() + title.slice(1));
    await VD.locator('[data-im-interested]').click();
    const signIn = V.getByRole('dialog', { name: 'Sign in' });
    await expect(signIn).toContainText('Sign In / Create Account');
    await signIn.getByRole('button', { name: 'Close' }).click();
    // Discussion is behind sign-in: a count card (v8-8 item 9)
    await expect(VD.locator('[data-disc-signin]')).toContainText('Sign in to read and join in');

    // A member opens the shared link: Led by Lena, Picking a date
    await openIdea(G, id);
    const GD = G.locator('[data-screen-label="Idea page (8b)"]');
    await expect(GD.locator('[data-led-by8]')).toContainText('Lena');
    await expect(GD.locator('[data-led-by8]')).toContainText('Picking a date');
    await expect(GD.locator('[data-idea-edit]')).toHaveCount(0);
    // The lead counts as interested and leads the list, which anyone can open (owner, 2026-10-07)
    await GD.getByLabel('See who’s interested').first().click();
    const wi = G.getByRole('dialog', { name: 'Who’s interested' });
    await expect(wi.locator('[data-interested]').first()).toContainText('Lena');
    await expect(wi.locator('[data-lead-chip]')).toHaveText('Leading');
    await G.keyboard.press('Escape');
    await expect(wi).toHaveCount(0);
    await GD.locator('[data-im-interested]').click();
    await expect(GD.locator('[data-im-interested]')).toHaveText('✓ You’re interested', { timeout: 1000 });
    await expect(GD.getByLabel('See who’s interested').first()).toContainText('2 people so far');
    // Suggest a date and a location; one of each is a suggestion, not a poll (v8-8 item 5)
    await GD.locator('[data-help-make-plan] [data-todo="d"]').click();   // the To dos notepad's Pick a date row (Design v8-18, 1h)
    const sd = G.getByRole('dialog', { name: 'Suggest a date' });
    await sd.getByLabel('Date').fill(inDays(12));
    await sd.locator('[data-ip-pop-done]').click();
    await expect(G.getByRole('status')).toContainText('Date added');
    await expect(GD.locator('[data-when] [data-suggested]')).toContainText('Suggested');
    await expect(GD.locator('[data-when]')).not.toContainText('Choose all dates you could attend.');
    await GD.locator('[data-help-make-plan] [data-todo="l"]').click();
    const sl = G.getByRole('dialog', { name: 'Suggest a location' });
    await sl.getByLabel('Location').fill('The north lot at Zilker');
    await sl.locator('[data-ip-pop-done]').click();
    await expect(G.getByRole('status')).toContainText('Location added');
    await saved(G);

    // The lead confirms the suggestions in the Pick pop-ups, then Make it a plan!
    await L.reload();
    await expect(LD.locator('[data-plan-date]')).toHaveText('Pick');
    await expect(LD.locator('[data-make-this-plan]')).toContainText('Suggested:');
    await LD.locator('[data-plan-date]').click();
    const pd = L.getByRole('dialog', { name: 'Pick a date' });
    await expect(pd).toContainText('Confirm the suggested date, or set another.');
    await pd.locator('[data-pick-confirm]').click();
    await LD.locator('[data-plan-loc]').click();
    const pl = L.getByRole('dialog', { name: 'Pick a location' });
    await expect(pl).toContainText('Confirm the suggested location, or enter your own.');
    // Somewhere else starts from the suggestion, so its wording can be changed (ideas audit, owner 2026-10-08)
    await pl.locator('[data-pick-own]').click();
    await expect(pl.getByLabel('Location')).toHaveValue('The north lot at Zilker');
    await pl.getByLabel('Location').press('End');
    await pl.getByLabel('Location').pressSequentially(' Park');   // key by key: Confirm reads the field as it is now
    await pl.locator('[data-pick-confirm]').click();
    await expect(LD.locator('[data-where-set]')).toContainText('The north lot at Zilker Park');
    await expect(LD.locator('[data-where-set]')).not.toContainText('Suggested');
    await expect(LD.locator('[data-make-this-plan]')).toContainText('We’ll tell the 1 person interested.');
    await LD.locator('[data-make-it-plan]').click();
    const flow = L.locator('[data-screen-label="New spark"]');
    await expect(flow.locator('[data-review-edit="where"]')).toContainText('The north lot at Zilker Park');
    await flow.locator('[data-post]').click();
    const LP = L.locator('[data-screen-label="Plan page"]');
    await expect(LP).toBeVisible();
    await expect(L.getByRole('status')).toContainText('It’s a Plan! We told the 1 person interested.');
    // Gus was interested, so he's down as Maybe (Q31 1e)
    await G.reload();
    const GP = G.locator('[data-screen-label="Plan page"]');
    await expect(rsvpBar(GP.locator('[data-rsvp]'), 'maybe')).toBeVisible();

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
    await fan.page.locator('[data-im-interested]').click();
    await expect(fan.page.locator('[data-im-interested]')).toHaveText('✓ You’re interested');
    await saved(fan.page);

    const P = poster.page;
    await P.goto('/#/browse');   // a group's Ideas · Plans · Past (#/ideas is the Ideas tab since v8-4)
    await P.locator('[data-screen-label=Browse]').getByRole('tab', { name: /^Ideas/ }).click();
    // A group's Ideas use the Ideas tab's board (owner, 2026-10-07): the same cards, sort menu and Tiles · Grid picker
    const B = P.locator('[data-screen-label=Browse]');
    const order = async () => (await B.locator('[data-idea-card]').evaluateAll(els => els.map(el => el.getAttribute('data-idea-card'))))
      .filter(t => t === older || t === newer).map(t => (t === older ? 'older' : 'newer'));
    const sortBy = async (label) => { await B.locator('[data-ia-sort]').click(); await P.getByRole('option', { name: label }).click(); };
    if (await B.locator('[data-ia-views]').getAttribute('aria-label') !== 'View: Tiles') { await B.locator('[data-ia-views]').click(); await P.locator('[data-ia-view="full"]').click(); }
    await sortBy('Popular');
    await expect.poll(order).toEqual(['older', 'newer']);
    await sortBy('Newest');
    await expect.poll(order).toEqual(['newer', 'older']);
    // The board ends with Float an Idea for this group; it opens the Float an idea sheet
    const prompt = B.locator('[data-idea-prompt]');
    await expect(prompt).toHaveText('+ Float an Idea');
    await prompt.click();
    await expect(P.locator('[data-screen-label="Float an Idea"]')).toBeVisible();
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
    await expect(me.page.locator('[data-screen-label="Idea page (8b)"] [data-led-line]')).toContainText('Led by you');   // the lead gets no Led by card on their own idea
    await expect(me.page.locator('[data-led-by8]')).toHaveCount(0);
    expect(me.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(me.page, id).catch(() => {});
    await me.context.close();
  }
});
