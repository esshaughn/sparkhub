// Design round v8-24 (2026-10-10): Ways to participate on You're going!, the outlined Invite people for someone going,
// the event's Invite people sheet on the group sheet's template, members inviting to a group when the switch is on,
// and the bell's red count clearing once you've looked.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, asUser, openIdea, deleteIdea, rsvpTap } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('Going: Ways to participate signs you up; Invite people opens the new sheet', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Hope');
  const mem = await newLead(browser, 2, 'Mo');
  const H = host.page, M = mem.page, title = uniqueTitle('Creek cleanup');
  let id;
  try {
    id = await asUser(H, async (c, _C, { title, day }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Hope', lead_name: 'Hope', lead_id: me, created_by: me, text: title, planned: true, day_date: day, day_time: '09:00', spot: 'Pease Park' }).select('id').single();
      if (r.error) return r.error.message;
      const j = await c.from('signup_items').insert([{ spark_id: r.data.id, item: 'Trash bags', need: 3 }, { spark_id: r.data.id, item: 'Water jugs', need: 1 }, { spark_id: r.data.id, item: 'Cheer people on' }]);
      return j.error ? j.error.message : r.data.id;
    }, { title, day: inDays(5) });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    // The bell (item 2): the red count, then looking at the list clears it; the rows stay unread
    await M.reload();
    await expect(M.locator('html[data-loaded=true]')).toHaveCount(1);
    await expect(M.getByRole('button', { name: /^Notifications, \d+ new$/ }).first()).toBeVisible();
    await M.getByRole('button', { name: /^Notifications/ }).first().click();
    const bell = M.getByRole('dialog', { name: 'Notifications' });
    await expect(bell.locator('[data-notif=newevent]').filter({ hasText: title })).toBeVisible();
    await M.waitForTimeout(1400);   // just having it open clears the count (owner, 2026-10-11)
    await expect(bell.locator('[data-notif=newevent]').filter({ hasText: title }).getByLabel('Unread')).toBeVisible();
    await bell.getByRole('button', { name: 'Close' }).first().click();
    await expect(M.getByRole('button', { name: /^Notifications, \d+ new$/ })).toHaveCount(0);

    await openIdea(M, id);
    const P = M.locator('[data-screen-label="Plan page"]');
    await rsvpTap(P.locator('[data-rsvp]'), 'Going');
    const pop = M.getByRole('dialog', { name: 'You’re going' });
    const ways = pop.locator('[data-plus-ways]');
    await expect(ways).toContainText('Ways to participate');
    // Most needed first, No limit last
    await expect(ways.locator('[data-plus-way]')).toHaveCount(3);
    await expect(ways.locator('[data-plus-way]').nth(0)).toContainText('Trash bags');
    await expect(ways.locator('[data-plus-way]').nth(0)).toContainText('3 slots open');
    await expect(ways.locator('[data-plus-way]').nth(1)).toContainText('1 slot open');
    await expect(ways.locator('[data-plus-way]').nth(2)).toContainText('No limit');
    await ways.getByRole('button', { name: 'Sign up for Trash bags' }).click();
    await expect(pop).toHaveCount(0);
    const recap = M.getByRole('dialog', { name: 'You’re signed up' });
    await expect(recap).toContainText('Trash bags');
    await recap.locator('[data-onit-done]').click();
    await expect(recap).toHaveCount(0);
    await expect(P.locator('[data-signup="Trash bags"]')).toContainText('2 open slots');

    // Going to a Plan they don't lead: the outlined Invite people, opening the template (the event title over Invite people)
    await P.locator('[data-invite-people-out]').click();
    const sheet = M.getByRole('dialog', { name: 'Invite people' });
    await expect(sheet.locator('[data-inv-eyebrow]')).toHaveText(title);
    await expect(sheet.getByRole('searchbox', { name: 'Search friends' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Send', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(sheet).toContainText('Not on Spark Hub yet?');
    await expect(sheet.getByRole('button', { name: 'Copy link' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'QR code' })).toHaveCount(0);   // leads only
    await sheet.getByRole('button', { name: 'Close' }).click();
    // The lead keeps the solid button, not the outlined one
    await openIdea(H, id);
    await expect(H.locator('[data-invite-people]')).toBeVisible();
    await expect(H.locator('[data-invite-people-out]')).toHaveCount(0);
  } finally {
    if (id) await deleteIdea(H, id);
    await host.context.close();
    await mem.context.close();
  }
});

test('Members can invite people: off, members get no Invite; on, they do', async ({ browser }) => {
  test.setTimeout(120000);
  const own = await newLead(browser, 1, 'Ada');
  const mem = await newLead(browser, 2, 'Bo');
  const A = own.page, B = mem.page, name = uniqueTitle('Invite club');
  let gid;
  try {
    gid = (await asUser(A, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], name)).id;
    const code = await asUser(A, async (c, _C, g) => (await c.rpc('group_code', { p_group: g })).data, gid);
    const joined = await asUser(B, async (c, _C, code) => { const r = await c.rpc('join_group', { p_code: code }); return r.error ? r.error.message : 'ok'; }, code);
    expect(joined).toBe('ok');
    // Off: a member has no Invite round and can't read the link
    expect(await asUser(B, async (c, _C, g) => (await c.rpc('group_code', { p_group: g })).data, gid)).toBeNull();
    // The group's page from My groups (after a reload, so a join or the switch made from Node shows), then ⋯
    const menu = async (P) => {
      await P.reload();
      await expect(P.locator('html[data-loaded=true]')).toHaveCount(1);
      await P.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
      await P.locator('[data-screen-label=Groups]').getByRole('button', { name, exact: true }).click();
      await P.locator('[data-screen-label=Browse]').getByRole('button', { name: 'Group options' }).click();
      return P.getByRole('dialog', { name: 'Group options' });
    };
    let bm = await menu(B);
    await expect(bm.getByRole('button', { name: 'Invite', exact: true })).toHaveCount(0);
    await expect(bm.getByRole('switch', { name: 'Members can invite people' })).toHaveCount(0);   // owners and admins only
    // The owner turns it on
    const am = await menu(A);
    await am.getByRole('switch', { name: 'Members can invite people' }).click();
    await expect(A.getByText('Members can invite people now')).toBeVisible();
    // On: the member gets the Invite round and the sheet with the link
    bm = await menu(B);
    await bm.getByRole('button', { name: 'Invite', exact: true }).click();
    const inv = B.getByRole('dialog', { name: 'Invite people' });
    await expect(inv.locator('[data-inv-eyebrow]')).toHaveText(name);
    await expect(inv.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
    expect(await asUser(B, async (c, _C, g) => (await c.rpc('group_code', { p_group: g })).data, gid)).toBe(code);
  } finally {
    if (gid) await asUser(A, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), gid).catch(() => {});
    await own.context.close();
    await mem.context.close();
  }
});
