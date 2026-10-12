// Starting a group is a draft, a team and a review (owner, 2026-10-12; 20261202040000_group_drafts.sql): Start a group
// opens #/request; the starter fills in the draft, asks a friend to co-lead, the friend says yes in the app, and the
// draft goes for review. (The app owner's Approve is covered by tests/db/checks.sql: the e2e leads aren't app owners.)
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, asUser } = require('./helpers');

test('Draft a group, ask a co-lead, they say yes, send it for review', async ({ browser }) => {
  const starter = await newLead(browser, 1, 'Ada');
  const colead = await newLead(browser, 2, 'Bo');
  const A = starter.page, B = colead.page;
  const name = uniqueTitle('draft').slice(0, 40);
  let id;
  try {
    // Friends first: the team comes from your friends
    const code = await asUser(B, async (c) => (await c.rpc('my_friend_code', { p_new: false })).data);
    await asUser(A, async (c, _C, k) => c.rpc('add_friend_by_code', { p_code: k }), code);
    await A.reload();
    await expect(A.locator('html[data-loaded=true]')).toHaveCount(1);

    // Start a group → the request page → Start a draft
    await A.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    await A.locator('[data-screen-label=Groups]').getByRole('button', { name: 'Join or add a group' }).click();
    await A.getByRole('dialog', { name: 'Add a group' }).getByRole('button', { name: 'Start a group' }).click();
    const list = A.locator('[data-screen-label="Start a group"]');
    await expect(list.getByRole('heading', { name: 'Starting a group is a big deal' })).toBeVisible();
    await list.locator('[data-new-draft]').click();
    const draft = A.locator('[data-screen-label="Group request"]');
    await expect(draft).toContainText('DRAFT');
    await expect.poll(() => A.evaluate(() => location.hash)).toMatch(/^#\/request\/[0-9a-f-]{36}$/);
    id = (await A.evaluate(() => location.hash)).split('/').pop();

    // Fill it in; Send for review says what's still needed
    await draft.locator('[data-draft-name]').fill(name);
    await draft.locator('[data-draft-place_name]').fill('Walnut Creek');
    await draft.locator('[data-draft-pick="place_kind:neighborhood"]').click();
    await draft.locator('[data-draft-purpose]').fill('Neighbors getting together');
    await draft.locator('[data-draft-pick="join_rule:nearby"]').click();
    await draft.locator('[data-draft-pick="association:none"]').click();
    await draft.locator('[data-draft-agree]').click();
    await expect(draft.locator('[data-draft-send]')).toHaveAttribute('aria-disabled', 'true');
    await expect(draft).toContainText('Still needed: a co-lead who has said yes.');

    // Ask the friend to co-lead
    await draft.locator('[data-ask-role=colead]').click();
    const pick = A.getByRole('dialog', { name: 'Ask a co-lead' });
    await pick.locator('[data-pick-friend]').filter({ hasText: 'Bo' }).first().click();
    await expect(A.getByText('Asked Bo')).toBeVisible();
    await expect(draft.locator('[data-team-row]').filter({ hasText: 'Co-lead' })).toContainText('Asked');

    // The saved draft has everything typed (saving waits for a pause in typing)
    await expect.poll(() => asUser(A, async (c, _C, d) => (await c.from('group_drafts').select('name,place_name,purpose,join_rule,association,agreed_at').eq('id', d).single()).data, id))
      .toMatchObject({ name, place_name: 'Walnut Creek', purpose: 'Neighbors getting together', join_rule: 'nearby', association: 'none' });

    // The co-lead opens it and says yes
    await B.goto('/#/request/' + id);
    await expect(B.locator('html[data-loaded=true]')).toHaveCount(1);
    const ask = B.locator('[data-draft-ask]');
    await expect(ask).toContainText('asked you to be co-lead');
    await ask.locator('[data-draft-yes]').click();
    await expect(B.getByText('You’re on the team')).toBeVisible();
    await expect(ask).toContainText('You’re in.');
    await expect(B.locator('[data-draft-send]')).toHaveCount(0);   // only the starter sends it

    // Back to the starter: Send for review, now in review with Take it back
    await A.reload();
    await expect(A.locator('html[data-loaded=true]')).toHaveCount(1);
    await expect(draft.locator('[data-team-row]').filter({ hasText: 'Co-lead' })).toContainText('In');
    await expect(draft.locator('[data-draft-send]')).toHaveAttribute('aria-disabled', 'false');
    await draft.locator('[data-draft-send]').click();
    await expect(draft).toContainText('IN REVIEW');
    await expect(draft).toContainText('Take it back to edit');
    await expect(draft.locator('[data-draft-name]')).toHaveCount(0);   // read-only while it's in review
  } finally {
    if (id) await asUser(A, async (c, _C, d) => { await c.rpc('withdraw_group_draft', { p_draft: d }); await c.from('group_drafts').delete().eq('id', d); }, id).catch(() => {});
    await asUser(A, async (c) => {
      const f = (await c.rpc('friend_state')).data;
      for (const x of (f && f.friends) || []) if (/^Bo/.test(x.name || '')) await c.rpc('remove_friend', { p_other: x.id });
    }).catch(() => {});
    await starter.context.close(); await colead.context.close();
  }
});
