// Group invites (Design v8-22; 20261127000000_group_invites.sql): an owner invites someone from their profile (1a),
// the person invited joins from the bell (2a) and sees NEW · YOU JOINED on My groups (4b); owners and admins see who's
// INVITED in Members and can remind or take an invite back; Not now on the My groups card hides it, silently.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, newAccount, asUser } = require('./helpers');

const groupMenu = async (P) => { await P.locator('[data-screen-label=Browse]').getByRole('button', { name: 'Group options' }).click(); return P.getByRole('dialog', { name: 'Group options' }); };
const openGroupNamed = async (P, name) => {
  await P.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
  await P.locator('[data-screen-label=Groups]').getByRole('button', { name, exact: true }).click();
};
const openMembers = async (P, name) => {
  await openGroupNamed(P, name);
  await (await groupMenu(P)).getByRole('button', { name: 'Members, see all' }).click();
  return P.getByRole('dialog', { name: 'Members' });
};
const openBell = async (P) => {
  await P.getByRole('button', { name: /^Notifications/ }).first().click();
  return P.getByRole('dialog', { name: 'Notifications' });
};
const shortName = () => 'Iva' + Date.now().toString(36).slice(-4);

test('Invite to a group from a profile, then Join from the bell and NEW · YOU JOINED', async ({ browser }) => {
  const nameB = shortName();
  const owner = await newLead(browser, 1, 'Ada');
  const other = await newLead(browser, 2, nameB);
  const A = owner.page, B = other.page;
  const groupName = uniqueTitle('invites');
  let gid;
  try {
    gid = (await asUser(A, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], groupName)).id;
    await A.reload();
    await expect(A.locator('html[data-loaded=true]')).toHaveCount(1);

    // 1a: Torrez Fitness → Members → their profile → Invite to a group → tick the new group → Send invite · 1
    const mem = await openMembers(A, 'Torrez Fitness');
    await mem.getByLabel('Search members').fill(nameB);
    await mem.getByRole('button', { name: nameB, exact: true }).click();
    await mem.getByRole('button', { name: 'See profile' }).click();
    await A.getByRole('dialog', { name: nameB }).getByRole('button', { name: 'Invite to a group' }).click();
    const gpi = A.getByRole('dialog', { name: 'Invite to a group' });
    await expect(gpi).toContainText('Invite ' + nameB + ' to a group');
    await expect(gpi).toContainText('Groups you run');
    await expect(gpi.locator('[data-gpi-send]')).toHaveAttribute('aria-disabled', 'true');
    await gpi.getByRole('checkbox', { name: groupName }).click();
    await gpi.getByRole('button', { name: 'Send invite · 1' }).click();
    await expect(A.getByText('Invited ' + nameB + ' to ' + groupName)).toBeVisible();
    await expect(gpi).toHaveCount(0);
    // Opening it again: the group now reads Invited, with nothing to tick
    await mem.getByRole('button', { name: 'See profile' }).click();
    await A.getByRole('dialog', { name: nameB }).getByRole('button', { name: 'Invite to a group' }).click();
    await expect(gpi.locator('[data-gpi-row="' + groupName + '"] [data-gpi-state]')).toHaveText('Invited');
    await gpi.getByRole('button', { name: 'Close' }).click();

    // 2a: the bell row with Join / See group; See group opens the invite pop-up, Join joins
    await B.reload();
    await expect(B.locator('html[data-loaded=true]')).toHaveCount(1);
    const bell = await openBell(B);
    const row = bell.locator('[data-notif=ginv]');
    await expect(row).toContainText('invited you to ' + groupName);
    await row.getByRole('button', { name: 'See group' }).click();
    const pop = B.getByRole('dialog', { name: 'Group invite' });
    await expect(pop).toContainText(groupName);
    await expect(pop).toContainText('invited you · 1 member');
    await pop.getByRole('button', { name: 'Not now' }).click();   // the pop-up's Not now only closes it
    await expect(pop).toHaveCount(0);
    await row.locator('[data-ginv-join]').click();
    await expect(B.getByRole('status').getByText('You joined ' + groupName)).toBeVisible();
    await expect(bell.locator('[data-notif=ginv]')).toHaveCount(0);
    await expect(bell.locator('[data-notif=gjoined]')).toContainText('You joined ' + groupName);
    await bell.getByRole('button', { name: 'Close' }).click();
    expect(await asUser(B, async (c, _C, id) => (await c.from('memberships').select('group_id').eq('group_id', id)).data.length, gid)).toBe(1);

    // 4b: NEW · YOU JOINED at the top of My groups; See the group opens it and the card goes
    await B.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    const ng = B.locator('[data-ng="' + groupName + '"]');
    await expect(ng).toContainText('NEW · YOU JOINED');
    await expect(ng).toContainText('Invited by Ada');
    await ng.getByRole('button', { name: 'Say hi to Ada' }).click();
    await expect(B.getByText('We told Ada you said hi')).toBeVisible();
    await ng.getByRole('button', { name: 'See the group' }).click();
    await expect(B.locator('[data-screen-label=Browse]')).toContainText(groupName);
    await B.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    await expect(B.locator('[data-ng]')).toHaveCount(0);
  } finally {
    if (gid) await asUser(A, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), gid).catch(() => {});
    await owner.context.close();
    await other.context.close();
  }
});

test('Members shows who’s INVITED: Send a reminder, Take back invite; Not now on My groups is silent', async ({ browser }) => {
  const nameB = shortName();
  const owner = await newLead(browser, 1, 'Ada');
  const other = await newLead(browser, 2, nameB);
  const A = owner.page, B = other.page;
  const groupName = uniqueTitle('invited');
  let gid;
  try {
    gid = (await asUser(A, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], groupName)).id;
    const bid = await asUser(B, async (c) => (await c.auth.getUser()).data.user.id);
    const invite = () => asUser(A, async (c, _C, a) => (await c.rpc('send_group_invites', { p_groups: [a.gid], p_users: [a.bid] })).data, { gid, bid });
    expect(await invite()).toBe(1);
    await A.reload();
    await expect(A.locator('html[data-loaded=true]')).toHaveCount(1);

    const mem = await openMembers(A, groupName);
    await expect(mem.locator('[data-screen-label=Invited]')).toContainText('INVITED · 1');
    const inv = mem.locator('[data-invited="' + nameB + '"]');
    await expect(inv).toContainText('Invited by you');
    await inv.getByRole('button', { name: 'More for ' + nameB }).click();
    await inv.getByRole('button', { name: 'Send a reminder' }).click();
    await expect(A.getByText('Reminder sent to ' + nameB)).toBeVisible();
    await inv.getByRole('button', { name: 'More for ' + nameB }).click();
    await inv.getByRole('button', { name: 'Send a reminder' }).click();
    await expect(A.getByText('You already sent ' + nameB + ' a reminder today')).toBeVisible();
    await inv.getByRole('button', { name: 'More for ' + nameB }).click();
    await inv.getByRole('button', { name: 'Take back invite' }).click();
    await expect(A.getByText('Invite taken back')).toBeVisible();
    await expect(mem.locator('[data-invited]')).toHaveCount(0);

    // Taken back: nothing in the bell. Invited again: the card on My groups; Not now hides it for good
    await B.reload();
    await expect(B.locator('html[data-loaded=true]')).toHaveCount(1);
    const bell = await openBell(B);
    await expect(bell.locator('[data-notif=ginv]')).toHaveCount(0);
    await bell.getByRole('button', { name: 'Close' }).click();
    expect(await invite()).toBe(1);
    await B.reload();
    await expect(B.locator('html[data-loaded=true]')).toHaveCount(1);
    await B.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    const card = B.locator('[data-ginv-card="' + groupName + '"]');
    await expect(card).toContainText('Ada invited you to');
    await expect(card.getByRole('button', { name: 'Join · 1 member' })).toBeVisible();
    await card.getByRole('button', { name: 'Not now' }).click();
    await expect(card).toHaveCount(0);
    await B.reload();
    await expect(B.locator('html[data-loaded=true]')).toHaveCount(1);
    await B.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    await expect(B.locator('[data-ginv-card]')).toHaveCount(0);
    expect(await invite()).toBe(0);   // turned down: it can't be sent again
    // …and the owner still sees it waiting (Not now tells no one)
    await mem.getByRole('button', { name: 'Close' }).click();
    const mem2 = await openMembers(A, groupName);
    await expect(mem2.locator('[data-invited="' + nameB + '"]')).toBeVisible();
  } finally {
    if (gid) await asUser(A, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), gid).catch(() => {});
    await owner.context.close();
    await other.context.close();
  }
});

test('Get started: Join a group shows the invite waiting, and joining from it ticks the step', async ({ browser }) => {
  test.skip(process.env.E2E_DB !== 'local', 'needs the local Supabase (a brand-new account)');
  const owner = await newLead(browser, 1, 'Ada');
  const gia = await newAccount(browser, 'Gia');
  const A = owner.page, G = gia.page;
  const groupName = uniqueTitle('gs invite');
  let gid;
  try {
    gid = (await asUser(A, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], groupName)).id;
    await asUser(G, async (c) => c.rpc('join_group', { p_code: 'TORREZ' }));   // in a group, so Get started shows
    expect(await asUser(A, async (c, _C, a) => (await c.rpc('send_group_invites', { p_groups: [a.gid], p_users: [a.uid] })).data, { gid, uid: gia.id })).toBe(1);
    await G.reload();
    await expect(G.locator('html[data-loaded=true]')).toHaveCount(1);
    await G.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
    const gs = G.locator('[data-screen-label="Your calendar"] [data-get-started]');
    await gs.locator('[data-gs-toggle]').click();
    const row = gs.locator('[data-gs-step="join"]');
    await expect(row).toHaveAttribute('data-gs-invites', '1');
    await expect(row).toContainText('You have 1 invite');
    await row.getByRole('button', { name: 'Join', exact: true }).click();
    const pop = G.getByRole('dialog', { name: 'Group invite' });
    await expect(pop).toContainText(groupName);
    await expect(pop).toContainText('Ada invited you · 1 member');
    await pop.getByRole('button', { name: 'Join the group' }).click();
    await expect(G.getByRole('status').getByText('You joined ' + groupName)).toBeVisible();
    await expect(gs.locator('[data-gs-step="join"]')).toHaveAttribute('data-done', '');
  } finally {
    if (gid) await asUser(A, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), gid).catch(() => {});
    await owner.context.close();
    await gia.context.close();
  }
});
