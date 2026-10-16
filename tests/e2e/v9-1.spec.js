// Design round v9-1 (HANDOFF-to-CODE v9-1): the join moment (2a–2c, Join by code), Starting a group (3a–3e), Place &
// purpose and the Dashboard (4a, 4d), crews (5b) and after the event, joy first (Q57).
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, asUser } = require('./helpers');

// 2b · 2c · Join by code: the Join {group}? pop-up shows the place card and How are you connected?; the rule greys out
// what it doesn't take; if the rule changes before Join, the answer that no longer fits goes inactive with a red line
test('the join moment: Join by code opens Join {group}? with the place and the question; a changed rule says so', async ({ browser }) => {
  const owner = await newLead(browser, 1, 'Ada');
  const other = await newLead(browser, 2, 'Bo');
  const A = owner.page, B = other.page;
  const name = uniqueTitle('join').slice(0, 40);
  let gid;
  try {
    const g = await asUser(A, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], name);
    gid = g.id;
    await asUser(A, async (c, _C, id) => {
      await c.rpc('set_community_place', { p_group: id, p_name: 'Walnut Creek', p_kind: 'neighborhood', p_lat: 30.3925, p_lon: -97.6887, p_radius_m: 800, p_purpose: 'Block parties and park cleanups.' });
      await c.rpc('set_join_rule', { p_group: id, p_rule: 'nearby' });
    }, gid);

    // Join a group → the code → Join {group} opens the pop-up instead of joining straight away
    await B.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    await B.getByRole('button', { name: 'Join or add a group' }).click();
    await B.getByRole('dialog', { name: 'Add a group' }).getByRole('button', { name: 'Join a group' }).click();
    const join = B.getByRole('dialog', { name: 'Join a group' });
    await join.getByLabel('Invite link or code').fill(g.code);
    await join.getByRole('button', { name: 'Join ' + name }).click();
    await expect(join).toHaveCount(0);
    const ask = B.getByRole('dialog', { name: 'Join ' + name + '?' });
    await expect(ask.locator('[data-place-card]')).toContainText('Walnut Creek');
    await expect(ask.locator('[data-place-card]')).toContainText('· Neighborhood');
    await expect(ask.locator('[data-place-ask]')).toHaveText('Is this the one you want to join?');
    await expect(ask).toContainText('How are you connected to Walnut Creek?');
    await expect(ask).toContainText('This group is for people who live here or nearby.');
    await expect(ask.locator('[data-conn=visiting]')).toHaveAttribute('aria-disabled', 'true');
    const go = ask.locator('[data-inv-confirm-join]');
    await expect(go).toHaveText('Join as Bo');
    await expect(go).toHaveAttribute('aria-disabled', 'true');   // grey until a pill is picked
    await ask.locator('[data-conn=nearby]').click();
    await expect(ask.locator('[data-conn=nearby]')).toHaveAttribute('aria-checked', 'true');
    await expect(go).toHaveAttribute('aria-disabled', 'false');

    // 2c: the owner narrows it to neighbors before Bo taps Join
    await asUser(A, async (c, _C, id) => c.rpc('set_join_rule', { p_group: id, p_rule: 'neighbors' }), gid);
    await go.click();
    await expect(ask.locator('[data-rule-changed]')).toHaveText('The group just changed who can join. Nearby isn’t open any more.');
    await expect(ask.locator('[data-conn=nearby]')).toHaveAttribute('aria-disabled', 'true');
    await expect(ask).toContainText('This group is for people who live here.');
    await expect(go).toHaveAttribute('aria-disabled', 'true');
    await ask.locator('[data-conn=here]').click();
    await expect(ask.locator('[data-rule-changed]')).toHaveCount(0);
    await go.click();
    await expect(B.locator('[data-screen-label="Welcome to the group"]')).toContainText('Welcome to ' + name);
    const conn = await asUser(A, async (c, _C, id) => (await c.rpc('group_members', { p_group: id })).data, gid);
    expect(conn.find(m => m.name === 'Bo' || (m.email || '').includes('lead-')) && conn.some(m => m.connection === 'here')).toBe(true);
  } finally {
    if (gid) await asUser(A, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), gid).catch(() => {});
    await owner.context.close();
    await other.context.close();
  }
});
