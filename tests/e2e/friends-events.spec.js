// Events without a group (owner, 2026-10-12; 20261202000000_events_without_groups.sql): Plan an event's Post to offers
// Just people I invite. The event has no group and is private: the friend you invite sees it and RSVPs; nobody else
// in the host's groups does. Lists live in the account (20261202010000_lists.sql), and lists left on a device move up.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, asUser, startPost, pickDate, rsvpTap, openIdea } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const friends = async (A, B) => {
  const code = await asUser(B, async (c) => (await c.rpc('my_friend_code', { p_new: false })).data);
  await asUser(A, async (c, _C, k) => c.rpc('add_friend_by_code', { p_code: k }), code);
};
const unfriend = (A, re) => asUser(A, async (c, _C, src) => {
  const f = (await c.rpc('friend_state')).data;
  for (const x of (f && f.friends) || []) if (new RegExp(src).test(x.name || '')) await c.rpc('remove_friend', { p_other: x.id });
}, re.source).catch(() => {});

test('Just people I invite: a private event with no group; the friend invited sees it and RSVPs', async ({ browser }) => {
  test.setTimeout(90000);
  const host = await newLead(browser, 1, 'Ada');
  const pal = await newLead(browser, 2, 'Bo');
  const A = host.page, B = pal.page;
  const title = uniqueTitle('Dinner');
  let id;
  try {
    await friends(A, B);
    await A.reload();
    await expect(A.locator('html[data-loaded=true]')).toHaveCount(1);

    await startPost(A, { group: false });
    const flow = A.locator('[data-screen-label="New spark"]');
    await flow.getByLabel('Event title').fill(title);
    await pickDate(flow.locator('[data-cp-row="when"]'), inDays(6));
    await flow.locator('[data-post-to]').click();
    const to = A.getByRole('dialog', { name: 'Post to' });
    await to.getByRole('checkbox', { name: 'Just people I invite' }).click();
    await expect(to.getByRole('checkbox', { name: 'Just people I invite' })).toHaveAttribute('aria-checked', 'true');
    await to.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(flow.locator('[data-post-to]')).toContainText('Just people I invite');
    await expect(flow.locator('[data-cp-vis]')).toContainText('Only the people you invite');
    await flow.locator('[data-post]').click();
    await expect(A.locator('[data-screen-label="Plan page"]')).toBeVisible();
    id = await A.evaluate(() => location.hash.split('/').pop());
    expect(await asUser(A, async (c, _C, s) => (await c.from('sparks').select('group_id,visibility,planned').eq('id', s).single()).data, id))
      .toEqual({ group_id: null, visibility: 'invite', planned: true });

    // Straight to inviting: the friend is there; Send · 1
    const sheet = A.getByRole('dialog', { name: 'Invite people' });
    await sheet.getByLabel('Search friends').fill('Bo');
    const row = sheet.locator('[data-invitee^="Bo"]').first();
    await row.getByRole('checkbox').click();
    await sheet.getByRole('button', { name: 'Send · 1' }).click();
    await expect(sheet).toHaveCount(0);

    // The friend opens it and says Going; it's on their calendar
    await openIdea(B, id);
    const page = B.locator('[data-screen-label="Plan page"]');
    await expect(page).toContainText(title);
    await rsvpTap(page, 'Going');
    await expect.poll(() => asUser(B, async (c, _C, s) => (await c.from('rsvps').select('status').eq('spark_id', s).eq('user_id', (await c.auth.getUser()).data.user.id)).data, id))
      .toEqual([{ status: 'going' }]);

    // Someone else in the host's group (Torrez Fitness) doesn't see it
    const other = await newLead(browser, 3, 'Cy');
    try {
      expect(await asUser(other.page, async (c, _C, s) => (await c.from('sparks').select('id').eq('id', s)).data, id)).toEqual([]);
    } finally { await other.context.close(); }
  } finally {
    if (id) await asUser(A, async (c, _C, s) => c.rpc('delete_event', { p_spark: s, p_quiet: true }), id).catch(() => {});
    await unfriend(A, /^Bo/);
    await host.context.close(); await pal.context.close();
  }
});

test('lists live in the account: a list left on this device moves up, and a new one saves there', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Ada');
  const pal = await newLead(browser, 2, 'Bo');
  const A = host.page;
  try {
    await friends(A, pal.page);
    const palId = await asUser(pal.page, async (c) => (await c.auth.getUser()).data.user.id);
    const me = await asUser(A, async (c) => (await c.auth.getUser()).data.user.id);
    await asUser(A, async (c) => { await c.from('lists').delete().is('group_id', null); });
    // An old list on this device
    await A.evaluate(([me, pal]) => localStorage.setItem('spark-hub-friend-lists-' + me, JSON.stringify([{ id: '1', name: 'Old crew', people: [pal] }])), [me, palId]);
    await A.reload();
    await expect(A.locator('html[data-loaded=true]')).toHaveCount(1);
    await A.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Friends', exact: true }).click();
    await expect(A.locator('[data-screen-label]').first()).toContainText('Old crew');
    await expect.poll(() => asUser(A, async (c) => (await c.from('lists').select('name,people').is('group_id', null)).data))
      .toEqual([{ name: 'Old crew', people: [palId] }]);
    expect(await A.evaluate((me) => localStorage.getItem('spark-hub-friend-lists-' + me), me)).toBeNull();
    // Only the owner sees a list, not the people on it
    expect(await asUser(pal.page, async (c) => (await c.from('lists').select('id')).data)).toEqual([]);
  } finally {
    await asUser(A, async (c) => { await c.from('lists').delete().is('group_id', null); }).catch(() => {});
    await unfriend(A, /^Bo/);
    await host.context.close(); await pal.context.close();
  }
});

test('a list plans its own event: Plan something, its people come picked, and the list shows what’s next', async ({ browser }) => {
  test.setTimeout(90000);
  const host = await newLead(browser, 1, 'Ada');
  const pal = await newLead(browser, 2, 'Bo');
  const A = host.page;
  const title = uniqueTitle('Crew night');
  let id;
  try {
    await friends(A, pal.page);
    const palId = await asUser(pal.page, async (c) => (await c.auth.getUser()).data.user.id);
    await asUser(A, async (c, _C, p) => { await c.from('lists').delete().is('group_id', null); await c.from('lists').insert({ name: 'Dinner crew', people: [p] }); }, palId);
    await A.reload();
    await expect(A.locator('html[data-loaded=true]')).toHaveCount(1);
    await A.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Friends', exact: true }).click();
    await A.locator('[data-friend-list="Dinner crew"]').click();
    const sheet = A.getByRole('dialog', { name: 'Dinner crew' });
    await expect(sheet.locator('[data-list-coming]')).toContainText('Nothing planned with Dinner crew yet.');
    await sheet.locator('[data-list-plan]').click();

    const flow = A.locator('[data-screen-label="New spark"]');
    await expect(flow.locator('[data-post-to]')).toContainText('Dinner crew');
    await flow.getByLabel('Event title').fill(title);
    await pickDate(flow.locator('[data-cp-row="when"]'), inDays(5));
    await flow.locator('[data-post]').click();
    await expect(A.locator('[data-screen-label="Plan page"]')).toBeVisible();
    id = await A.evaluate(() => location.hash.split('/').pop());

    // Invite people opens with the list picked
    const inv = A.getByRole('dialog', { name: 'Invite people' });
    await expect(inv.locator('[data-inv-list="Dinner crew"]')).toHaveAttribute('aria-checked', 'true');
    await inv.getByRole('button', { name: 'Send · 1' }).click();
    await expect(inv).toHaveCount(0);
    const listId = await asUser(A, async (c) => (await c.from('lists').select('id').eq('name', 'Dinner crew').single()).data.id);
    expect(await asUser(A, async (c, _C, s) => (await c.from('sparks').select('group_id,list_id').eq('id', s).single()).data, id))
      .toEqual({ group_id: null, list_id: listId });

    // The list now shows it next
    await A.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Friends', exact: true }).click();
    await expect(A.locator('[data-friend-list="Dinner crew"] [data-list-sub]')).toContainText(title);
    await A.locator('[data-friend-list="Dinner crew"]').click();
    await expect(A.getByRole('dialog', { name: 'Dinner crew' }).locator('[data-list-next]')).toContainText(title);
  } finally {
    if (id) await asUser(A, async (c, _C, s) => c.rpc('delete_event', { p_spark: s, p_quiet: true }), id).catch(() => {});
    await asUser(A, async (c) => { await c.from('lists').delete().is('group_id', null); }).catch(() => {});
    await unfriend(A, /^Bo/);
    await host.context.close(); await pal.context.close();
  }
});
