// Design round v8-26 (2026-10-11): one job card for everyone who isn't hosting (Sign up, N signed up), Questions?
// Contact {Lead} and the People can contact you switch, the named invite landing (1b), and picking your days again
// after a lead moves or takes off a day.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, newMember, asUser, openIdea, deleteIdea } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('Job card for members: small Sign up, N signed up; Questions? Contact goes with People can contact you', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Hope');
  const mem = await newLead(browser, 2, 'Mo');
  const H = host.page, M = mem.page, title = uniqueTitle('Book swap');
  let id;
  try {
    id = await asUser(H, async (c, _C, { title, day }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Hope', lead_name: 'Hope', lead_id: me, created_by: me, text: title, planned: true, day_date: day, day_time: '10:00' }).select('id').single();
      if (r.error) return r.error.message;
      const j = await c.from('signup_items').insert([{ spark_id: r.data.id, item: 'Folding tables', need: 2, descr: 'Two tables from the shed.\nKey is under the mat.\nBring them back after.' }]);
      return j.error ? j.error.message : r.data.id;
    }, { title, day: inDays(6) });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    await openIdea(M, id);
    const P = M.locator('[data-screen-label="Plan page"]');
    const card = P.locator('[data-signup="Folding tables"]');
    // 5a: before signing up, the small Sign up, open slots, Nobody yet, the description clamped with More
    await expect(card).toHaveAttribute('data-job-card', '');
    await expect(card.locator('[data-held-meta]')).toHaveText('2 open slots');
    await expect(card.locator('[data-job-count]')).toHaveText('Nobody yet');
    await expect(card.locator('[data-held-more]')).toHaveText(/More/);
    await card.locator('[data-held-more]').click();
    await expect(card.locator('[data-held-more]')).toHaveText(/Less/);
    // Item 6: Questions? Contact Hope on the Sign up heading, the same pop-up as Led by → Contact
    await expect(P.locator('[data-su-ask]')).toContainText('Questions?Contact Hope');
    await P.locator('[data-su-ask]').getByRole('button', { name: 'Contact Hope' }).click();
    const req = M.getByRole('alertdialog', { name: 'Contacting the leads isn’t here yet' });
    await expect(req).toBeVisible();
    await req.getByRole('button', { name: 'Not now' }).click();
    // Signing up: the green ✓ You're in tag, 1 signed up
    await card.locator('[data-part-claim]').click();
    const recap = M.getByRole('dialog', { name: 'You’re signed up' });
    await recap.locator('[data-onit-done]').click();
    await expect(card).toHaveAttribute('data-held', '');
    await expect(card.locator('[data-held-meta]')).toHaveText('1 open slot');
    await expect(card.locator('[data-job-count]')).toHaveText('1 signed up');
    await expect(card.locator('[data-part-give-up]')).toBeVisible();
    // The host still gets the host card, and no Questions? line
    await openIdea(H, id);
    await expect(H.locator('[data-screen-label="Plan page"] [data-signup="Folding tables"] [data-job-card]')).toHaveCount(0);
    await expect(H.locator('[data-su-ask]')).toHaveCount(0);

    // Item 7: the host turns People can contact you off in Edit event → Who can see it
    const err = await asUser(H, async (c, _C, id) => (await c.from('sparks').update({ contact: false }).eq('id', id)).error?.message || null, id);
    expect(err).toBeNull();
    await M.reload();
    await expect(M.locator('html[data-loaded=true]')).toHaveCount(1);
    await expect(P.locator('[data-signup="Folding tables"]')).toBeVisible();
    await expect(P.locator('[data-su-ask]')).toHaveCount(0);
    await expect(P.locator('[data-lead-contact]')).toHaveCount(0);
  } finally {
    if (id) await deleteIdea(H, id);
    await host.context.close();
    await mem.context.close();
  }
});

test('A named invite link: the group first, who shared it, then the sign-in landing', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Hope');
  const by = (await asUser(host.page, async (c) => (await c.auth.getUser()).data.user.id)).slice(0, 8);
  const { page, context } = await newMember(browser, '/#/join/TORREZ?by=' + by);
  try {
    const land = page.locator('[data-inv-named]');
    await expect(land.locator('[data-inv-by]')).toContainText('invited you');
    await expect(land.getByRole('heading', { name: 'Torrez Fitness' })).toBeVisible();
    await expect(land.locator('[data-inv-meta]')).toContainText(/\d+ members/);
    await expect(land).toContainText('Spark Hub is where Torrez Fitness plans get-togethers.');
    await expect(land).not.toContainText(by);
    await land.getByRole('button', { name: 'Join Torrez Fitness' }).click();
    // 1a: the sign-in landing, as before
    const signIn = page.locator('[data-screen-label=Invite]');
    await expect(signIn).toContainText('You’re invited to');
    await expect(signIn.getByRole('button', { name: 'Email sign-in code' })).toBeVisible();
    // Someone outside the group gets no name, just the group
    await page.goto('/#/join/TORREZ?by=00000000');
    await expect(page.locator('[data-inv-named]').getByRole('heading', { name: 'Torrez Fitness' })).toBeVisible();
    await expect(page.locator('[data-inv-by]')).toHaveCount(0);
  } finally {
    await context.close();
    await host.context.close();
  }
});

test('A lead takes a day off an Each day event: the people who’d picked it pick again', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Hope');
  const mem = await newLead(browser, 2, 'Mo');
  const H = host.page, M = mem.page, title = uniqueTitle('Plant sale');
  const d1 = inDays(8), d2 = inDays(9), d3 = inDays(10);
  let id;
  try {
    id = await asUser(H, async (c, _C, { title, d1, d2, d3 }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Hope', lead_name: 'Hope', lead_id: me, created_by: me, text: title, planned: true, day_date: d1, day_time: '09:00',
        schedule: { kind: 'days', each: true, days: [{ d: d1, t: '09:00' }, { d: d2, t: '09:00' }, { d: d3, t: '09:00' }] } }).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, { title, d1, d2, d3 });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const e1 = await asUser(M, async (c, _C, { id, d1, d3 }) => {
      const me = (await c.auth.getUser()).data.user.id;
      return (await c.from('rsvps').insert({ spark_id: id, user_id: me, status: 'going', days: [d1, d3] })).error?.message || null;
    }, { id, d1, d3 });
    expect(e1).toBeNull();
    // The lead takes the third day off
    const e2 = await asUser(H, async (c, _C, { id, d1, d2 }) => (await c.from('sparks').update({ schedule: { kind: 'days', each: true, days: [{ d: d1, t: '09:00' }, { d: d2, t: '09:00' }] } }).eq('id', id)).error?.message || null, { id, d1, d2 });
    expect(e2).toBeNull();

    // The member's note asks them to pick again, and opening the event opens When will you attend?
    await M.reload();
    await expect(M.locator('html[data-loaded=true]')).toHaveCount(1);
    await openIdea(M, id);
    const pick = M.getByRole('dialog', { name: 'When will you attend?' });
    await expect(pick).toBeVisible({ timeout: 10000 });
    await expect(pick.locator('[data-day-card]')).toHaveCount(2);
    await pick.locator('[data-day-card="' + d2 + '"]').getByRole('button', { name: 'Going' }).click();
    await pick.locator('[data-day-pick-go]').click();
    await expect(pick).toHaveCount(0);
    await expect.poll(async () => asUser(M, async (c, _C, id) => (await c.from('rsvps').select('repick').eq('spark_id', id).eq('user_id', (await c.auth.getUser()).data.user.id).single()).data?.repick, id)).toBe(false);
  } finally {
    if (id) await deleteIdea(H, id);
    await host.context.close();
    await mem.context.close();
  }
});
