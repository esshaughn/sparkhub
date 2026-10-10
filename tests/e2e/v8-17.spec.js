// Design round v8-17 (2026-10-09): offers to lead and the starter's pick, Your role, date vote rows, Feedback & questions.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, openIdea, deleteIdea, confirm, asUser, postIdea, postEvent, openProfile, rsvpTap } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('offer to lead: take it back, offer again, and the starter picks', async ({ browser }) => {
  test.setTimeout(150000);
  const host = await newLead(browser, 1, 'Hope');
  const other = await newLead(browser, 2, 'Otto');
  const H = host.page, O = other.page;
  let id;
  try {
    id = await postIdea(H, { title: uniqueTitle('Kite day') });
    const HS = H.locator('[data-screen-label="Idea page (8b)"]');
    await HS.locator('[data-rule="decide"]').click();   // Find a lead
    await expect(HS.locator('[data-rule="decide"]')).toHaveText('Find a lead');
    await expect(HS.locator('[data-rule="me"]')).toHaveText('I’ll lead it');

    // Otto sees NEEDS A LEAD, offers, takes it back, offers again
    await openIdea(O, id);
    const OS = O.locator('[data-screen-label="Idea page (8b)"]');
    await expect(OS.locator('[data-needs-lead]')).toContainText('NEEDS A LEAD');
    await expect(OS.locator('[data-needs-lead]')).toContainText('Hope floated this and is looking for someone to run it.');
    await OS.locator('[data-offer-lead]').click();
    const offer = O.getByRole('dialog', { name: 'Offer to lead' });   // a note for Hope, optional (Design v8-18, 4)
    await offer.locator('[data-send-offer]').click();
    await expect(OS.locator('[data-offered-lead]')).toContainText('You offered to lead');
    await expect(OS.locator('[data-help-make-plan] [data-todo="ld"]')).toContainText('You offered · waiting on Hope');
    await OS.locator('[data-offer-back]').click();
    await expect(OS.locator('[data-needs-lead]')).toBeVisible();
    await OS.locator('[data-offer-lead]').click();
    await offer.getByLabel('A note for Hope').fill('I ran one of these last spring');
    await offer.locator('[data-send-offer]').click();
    await expect(OS.locator('[data-offered-lead]')).toBeVisible();
    await expect(O.locator('html[data-saving]')).toHaveCount(0);

    // Hope's What's left shows the offer under the lead row; Pick asks once
    await openIdea(H, id);
    await expect(HS.locator('[data-make-this-plan]')).toContainText('What’s left');
    await expect(HS.locator('[data-make-this-plan]')).toContainText('1 person offered · pick below');
    await expect(HS.locator('[data-offer-note]')).toHaveText('I ran one of these last spring');   // in italics on the Pick line
    await HS.locator('[data-pick-lead]').click();
    const ask = H.getByRole('alertdialog');
    await expect(ask).toContainText('Make Otto the lead?');
    await expect(ask).toContainText('Otto picks the date and makes it happen.');
    await confirm(H, 'Make Otto the lead');
    await expect(HS.locator('[data-led-by8]')).toContainText('Otto');   // Hope is a member of it now
    await openIdea(O, id);
    await expect(OS.locator('[data-led-line]')).toContainText('Led by you');
  } finally {
    await asUser(O, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, id).catch(() => {});
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await other.context.close();
  }
});

test('Your role: the lead hands it to a co-lead in one tap, and the other steps back', async ({ browser }) => {
  test.setTimeout(150000);
  const host = await newLead(browser, 1, 'Hope');
  const other = await newLead(browser, 2, 'Otto');
  const H = host.page, O = other.page;
  let id;
  try {
    id = await postEvent(H, { title: uniqueTitle('Chili'), date: inDays(12), time: '17:30' });
    const ottoId = await asUser(O, async (c) => (await c.auth.getUser()).data.user.id);
    await asUser(H, async (c, _C, { id, u }) => { const r = await c.rpc('add_cohost', { p_spark: id, p_user: u }); return r.error ? r.error.message : ''; }, { id, u: ottoId });
    await openIdea(H, id);
    const HP = H.locator('[data-screen-label="Plan page"]');
    const bar = HP.locator('[data-rsvp-bar="host"]');
    await expect(bar).toContainText('You’re leading');
    await bar.locator('[data-role-change]').click();
    const role = H.getByRole('dialog', { name: 'Your role' });
    await expect(role.locator('[data-role-hand-co]')).toContainText('Hand it to Otto');
    await expect(role.locator('[data-role-hand-co]')).toContainText('One tap. Otto leads, you co-lead.');
    await expect(role.locator('[data-role-hand-other]')).toContainText('Pick a person, add a note');
    await expect(role.locator('[data-role-step-back]')).toContainText('Otto takes over');
    await expect(role.locator('[data-role-rsvp="going"]')).toHaveAttribute('aria-pressed', 'true');
    // Cancel steps forward in the same sheet, and Keep it leaves
    await role.locator('[data-role-ask-cancel]').click();
    await expect(role).toContainText('Everyone going gets a notification.');
    await role.locator('[data-role-back]').click();
    await role.locator('[data-role-hand-co]').click();
    await expect(H.getByRole('status')).toContainText('Otto is leading it. You’re a co-lead.');
    await expect(HP.locator('[data-rsvp-bar="host"]')).toContainText('You’re co-leading');

    await openIdea(O, id);
    const OP = O.locator('[data-screen-label="Plan page"]');
    await expect(OP.locator('[data-rsvp-bar="host"]')).toContainText('You’re leading');
  } finally {
    if (id) await deleteIdea(O, id).catch(() => deleteIdea(H, id).catch(() => {}));
    await host.context.close();
    await other.context.close();
  }
});

test('date votes are rows with a checkbox and a faces pill; Feedback & questions has three chips', async ({ browser }) => {
  test.setTimeout(150000);
  const host = await newLead(browser, 1, 'Hope');
  const H = host.page;
  let id;
  try {
    id = await postIdea(H, { title: uniqueTitle('Picnic') });
    await asUser(H, async (c, _C, { id, a, b }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const r = await c.from('date_options').insert([{ spark_id: id, day_date: a, who: 'Hope' }, { spark_id: id, day_date: b, who: 'Hope' }]).select('id');
      await c.from('date_votes').insert({ option_id: r.data[0].id, user_id: me });
      return r.error ? r.error.message : '';
    }, { id, a: inDays(10), b: inDays(11) });
    await openIdea(H, id);
    const rows = H.locator('[data-when] [data-date-votes] [data-cal-page]');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('You can go · most votes');
    await expect(rows.last()).toContainText('No votes yet');
    await expect(rows.last().locator('[data-who-date]')).toHaveCount(0);
    await rows.last().click();
    await expect(rows.last()).toHaveAttribute('aria-checked', 'true');
    await expect(rows.last()).toContainText('You can go');
    // The faces never vote: they open who can go
    await rows.first().locator('[data-who-date]').click();
    await expect(H.getByRole('dialog', { name: 'Who can go' })).toContainText('1 can go');
    await H.getByRole('dialog', { name: 'Who can go' }).getByRole('button', { name: 'Done' }).click();
    await expect(rows.first()).toHaveAttribute('aria-checked', 'true');

    // Feedback & questions: three chips; the one picked changes the words
    await openProfile(H);
    await H.getByRole('button', { name: 'Feedback & questions' }).click();
    const fb = H.getByRole('dialog', { name: 'Give feedback' });
    await expect(fb).toContainText('FEEDBACK & QUESTIONS');
    await expect(fb).toContainText('What can I help with?');
    await fb.locator('[data-fb-topic="bug"]').click();
    await expect(fb).toContainText('What went wrong?');
    await fb.locator('[data-fb-topic="idea"]').click();
    await expect(fb).toContainText('What do you think so far?');
    await fb.getByRole('button', { name: 'Close' }).click().catch(() => {});
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
  }
});
