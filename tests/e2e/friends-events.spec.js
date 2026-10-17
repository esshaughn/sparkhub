// Events without a group (owner, 2026-10-12; 20261202000000_events_without_groups.sql): Plan an event's Post to offers
// Just people I invite. The event has no group and is private: the friend you invite sees it and RSVPs; nobody else
// in the host's groups does. (Lists retired in the app when crews shipped, owner 2026-10-17: see crews.spec.js.)
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
