// Crews (Design v9-1 5b; 20261204000000_crews.sql; owner 2026-10-17: the name is crew, lists retire): start one with
// a friend from My friends, the crew's page (name, standing calendar, thread), the friend's unread count, Plan
// something for the crew (shared with everyone in it, no Invite sheet), the pinned plan's Going?, and Leave crew.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, asUser, pickDate } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const friends = async (A, B) => {
  const code = await asUser(B, async (c) => (await c.rpc('my_friend_code', { p_new: false })).data);
  await asUser(A, async (c, _C, k) => c.rpc('add_friend_by_code', { p_code: k }), code);
};
const unfriend = (A, re) => asUser(A, async (c, _C, src) => {
  const f = (await c.rpc('friend_state')).data;
  for (const x of (f && f.friends) || []) if (new RegExp(src).test(x.name || '')) await c.rpc('remove_friend', { p_other: x.id });
}, re.source).catch(() => {});
// Leave every crew (leftovers from an earlier run; the last one out deletes it)
const leaveAll = (P) => asUser(P, async (c) => { for (const x of (await c.rpc('my_crews')).data || []) await c.rpc('crew_leave', { p_crew: x.id }); }).catch(() => {});
const toFriends = (P) => P.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Friends/ }).click();

test('crews: start one with a friend, chat, plan something for the crew, Going? on the pinned plan, leave', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Ada');
  const pal = await newLead(browser, 2, 'Bo');
  const A = host.page, B = pal.page;
  const name = 'Taco crew ' + Date.now().toString(36).slice(-4), title = uniqueTitle('Taco night');
  let id;
  try {
    await leaveAll(A); await leaveAll(B);
    await friends(A, B);
    await A.reload();
    await expect(A.locator('html[data-loaded=true]')).toHaveCount(1);
    await toFriends(A);

    // YOUR CREWS: no REQUEST chip any more, and no YOUR LISTS (retired)
    const crews = A.locator('[data-crews]');
    await expect(crews).toContainText('YOUR CREWS');
    await expect(crews.locator('[data-request-chip]')).toHaveCount(0);
    await expect(A.locator('[data-screen-label="Your lists"]')).toHaveCount(0);
    await crews.locator('[data-crew-start]').click();
    const ed = A.getByRole('dialog', { name: 'Start a crew' });
    await expect(ed.locator('[data-crew-save]')).toHaveAttribute('aria-disabled', 'true');
    await ed.getByLabel('Crew name').fill(name);
    await ed.locator('[data-crew-pick^="Bo"]').first().click();
    await ed.locator('[data-crew-every="2weeks"]').click();
    await ed.getByRole('radio', { name: 'Sunday' }).click();
    await expect(ed.locator('[data-crew-every-sum]')).toContainText('Every other Sunday');
    await ed.locator('[data-crew-save]').click();

    // Its page opens: name, one friend, nothing planned, four standing dates
    const page = A.locator('[data-screen-label="Crew page"]');
    await expect(page.locator('[data-crew-name]')).toHaveText(name);
    await expect(page).toContainText('1 friend · everyone here sees this');
    await expect(page.locator('[data-crew-none]')).toContainText('Nothing planned yet.');
    await expect(page.locator('[data-crew-standing]')).toContainText('Every other Sunday');
    await expect(page.locator('[data-crew-day]')).toHaveCount(4);
    await expect(A.getByRole('navigation', { name: 'Main' })).toHaveCount(0);   // the page covers the tab bar

    // Say something (Enter sends)
    await page.getByLabel('Say something to the crew').fill('Tacos Sunday?');
    await page.getByLabel('Say something to the crew').press('Enter');
    await expect(page.locator('[data-crew-msg]').last()).toContainText('Tacos Sunday?');
    await expect.poll(() => asUser(A, async (c, _C, n) => {
      const cr = ((await c.rpc('my_crews')).data || []).find(x => x.name === n);
      return cr ? ((await c.rpc('crew_thread', { p_crew: cr.id })).data || []).map(m => m.body) : null;
    }, name)).toEqual(['Tacos Sunday?']);

    // Bo sees the crew with one unread; opening it shows the message and clears the count
    await B.reload();
    await expect(B.locator('html[data-loaded=true]')).toHaveCount(1);
    await toFriends(B);
    const card = B.locator('[data-crew-card="' + name + '"]');
    await expect(card.locator('[data-crew-unread]')).toHaveText('1');
    await card.click();
    const bPage = B.locator('[data-screen-label="Crew page"]');
    await expect(bPage.locator('[data-crew-msg]')).toContainText('Tacos Sunday?');
    await bPage.getByRole('button', { name: 'Back' }).click();
    await expect(card).toBeVisible();
    await expect(card.locator('[data-crew-unread]')).toHaveCount(0);

    // Ada plans something for the crew: Post to says the crew, no Invite sheet, and it's in the crew
    await page.locator('[data-crew-plan]').click();
    const flow = A.locator('[data-screen-label="New spark"]');
    await expect(flow.locator('[data-post-to]')).toContainText(name);
    await flow.getByLabel('Event title').fill(title);
    await pickDate(flow.locator('[data-cp-row="when"]'), inDays(5));
    await flow.locator('[data-post]').click();
    await expect(A.locator('[data-screen-label="Plan page"]')).toBeVisible();
    await expect(A.getByText('Shared with ' + name)).toBeVisible();
    await expect(A.getByRole('dialog', { name: 'Invite people' })).toHaveCount(0);
    id = await A.evaluate(() => location.hash.split('/').pop());
    const row = await asUser(A, async (c, _C, s) => (await c.from('sparks').select('group_id,crew_id').eq('id', s).single()).data, id);
    expect(row.group_id).toBeNull();
    expect(row.crew_id).toBeTruthy();

    // Bo: the card names it next; on the page it's pinned, and Going? says yes right there
    await B.reload();
    await expect(B.locator('html[data-loaded=true]')).toHaveCount(1);
    await expect(card.locator('[data-crew-next]')).toContainText(title);
    await card.click();
    const pin = bPage.locator('[data-crew-pinned]');
    await expect(pin).toContainText('PINNED · NEXT UP');
    await expect(pin).toContainText(title);
    await pin.locator('[data-crew-going]').click();
    await expect.poll(() => asUser(B, async (c, _C, s) => (await c.from('rsvps').select('status').eq('spark_id', s).eq('user_id', (await c.auth.getUser()).data.user.id)).data, id))
      .toEqual([{ status: 'going' }]);

    // Ada leaves: ⋯ → Leave crew
    await toFriends(A);
    await A.locator('[data-crew-card="' + name + '"]').click();
    await page.getByRole('button', { name: 'Crew options' }).click();
    await A.getByRole('dialog', { name }).locator('[data-crew-menu-leave]').click();
    await A.getByRole('alertdialog', { name: 'Leave ' + name + '?' }).getByRole('button', { name: 'Leave crew' }).click();
    await expect(A.getByText('You left ' + name)).toBeVisible();
    await expect(A.locator('[data-crew-card="' + name + '"]')).toHaveCount(0);
  } finally {
    if (id) await asUser(A, async (c, _C, s) => c.rpc('delete_event', { p_spark: s, p_quiet: true }), id).catch(() => {});
    await leaveAll(A); await leaveAll(B);
    await unfriend(A, /^Bo/);
    await host.context.close(); await pal.context.close();
  }
});
