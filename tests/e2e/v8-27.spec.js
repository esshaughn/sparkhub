// Design round v8-27 (2026-10-12): add friends from a group's Members list (round buttons, Everyone · Not friends
// yet), FIND FRIENDS IN YOUR GROUPS on Friends, Group ⋯ → View as a member, sign-up notes (You're signed up!, the job
// card, Who's signed up) and Who's signed up as a centred pop-up.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, asUser, openIdea, deleteIdea, saved } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const uid = (page) => asUser(page, async (c) => (await c.auth.getUser()).data.user.id);
const unfriend = (page, other) => asUser(page, async (c, _C, id) => c.rpc('remove_friend', { p_other: id }), other).catch(() => {});
const nav = (P) => P.getByRole('navigation', { name: 'Main' });
const groupMenu = async (P) => { await P.locator('[data-screen-label=Browse]').getByRole('button', { name: 'Group options' }).click(); return P.getByRole('dialog', { name: 'Group options' }); };

test('Members: round friend buttons, Not friends yet, cancel a request; Find friends in your groups', async ({ browser }) => {
  const a = await newLead(browser, 1, 'Ivy Asker');
  const b = await newLead(browser, 2, 'Jo Answer');
  const A = a.page, B = b.page;
  let bId;
  try {
    bId = await uid(B);
    await unfriend(A, bId);   // a leftover from an earlier run
    await A.reload();

    await nav(A).getByRole('button', { name: 'Groups', exact: true }).click();
    await A.locator('[data-screen-label=Groups]').getByRole('button', { name: 'Torrez Fitness', exact: true }).click();
    await (await groupMenu(A)).getByRole('button', { name: 'Members, see all' }).click();
    const members = A.getByRole('dialog', { name: 'Members' });
    // Everyone · Not friends yet · N, opening on Everyone
    await expect(members.locator('[data-members-all]')).toHaveAttribute('aria-pressed', 'true');
    await expect(members.locator('[data-members-nf]')).toHaveText(/^Not friends yet · \d+$/);
    await members.locator('[data-members-nf]').click();
    await expect(members.locator('[data-members-nf]')).toHaveAttribute('aria-pressed', 'true');
    await expect(members.locator('[data-member]').filter({ hasText: '(you)' })).toHaveCount(0);
    await members.getByLabel('Search members').fill('Jo Answer');
    const jo = members.locator('[data-member="Jo Answer"]');
    // Add: the round button; no grey line until there's a state
    await expect(jo.locator('[data-friend-line]')).toHaveCount(0);
    await jo.getByRole('button', { name: 'Add friend' }).click();
    await expect(A.getByText('Friend request sent to Jo')).toBeVisible();
    await expect(jo.locator('[data-friend-line]')).toHaveText('Requested');
    await expect(jo.locator('[data-member-panel]')).toHaveCount(0);   // the button doesn't open the row
    // Requested → Cancel your request to Jo? → back to Add
    await jo.getByRole('button', { name: 'Requested' }).click();
    const cancel = A.getByRole('alertdialog', { name: 'Cancel your request to Jo?' });
    await expect(cancel).toContainText('Jo won’t be told.');
    await cancel.getByRole('button', { name: 'Cancel request' }).click();
    await expect(jo.getByRole('button', { name: 'Add friend' })).toBeVisible();
    await saved(A);
    // Opening the row: no Add friend pill inside any more, See profile still there
    await jo.getByRole('button', { name: 'Jo Answer', exact: true }).click();
    await expect(jo.locator('[data-member-panel]')).toBeVisible();
    await expect(jo.locator('[data-member-panel]').getByRole('button', { name: 'Add friend' })).toHaveCount(0);
    await expect(jo.locator('[data-member-panel]').getByRole('button', { name: 'See profile' })).toBeVisible();
    await jo.getByRole('button', { name: 'Add friend' }).click();
    await expect(jo.locator('[data-friend-line]')).toHaveText('Requested');
    await saved(A);

    // Jo: Friends → FIND FRIENDS IN YOUR GROUPS → Torrez Fitness opens Members on Not friends yet, with Accept
    await B.reload();
    await nav(B).getByRole('button', { name: /^Friends/ }).click();
    const find = B.locator('[data-find-friends="Torrez Fitness"]');
    await expect(find).toContainText(/\d+ (person|people) not friends yet/);
    await find.click();
    const bm = B.getByRole('dialog', { name: 'Members' });
    await expect(bm.locator('[data-members-nf]')).toHaveAttribute('aria-pressed', 'true');
    await bm.getByLabel('Search members').fill('Ivy Asker');
    const ivy = bm.locator('[data-member="Ivy Asker"]');
    await expect(ivy.locator('[data-friend-line]')).toHaveText('Asked to be your friend');
    await ivy.getByRole('button', { name: 'Accept' }).click();
    await expect(B.getByText('You and Ivy are friends')).toBeVisible();
    await bm.locator('[data-members-all]').click();
    await expect(ivy.locator('[data-friend-line]')).toHaveText('Friends');
    await expect(ivy.locator('[data-friend-state="friends"]')).toBeVisible();
    await bm.getByRole('button', { name: 'Close' }).click();
    await expect(B.locator('[data-screen-label=Friends]')).toBeVisible();   // back on Friends
  } finally {
    if (bId) await unfriend(A, bId);
    await a.context.close();
    await b.context.close();
  }
});

test('Group ⋯ → View as a member: no admin tools until Exit', async ({ browser }) => {
  const admin = await newLead(browser, 1, 'Kai');
  const A = admin.page, name = uniqueTitle('viewers');
  let gid;
  try {
    gid = await asUser(A, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0].id, name);
    await A.reload();
    await nav(A).getByRole('button', { name: 'Groups', exact: true }).click();
    await A.locator('[data-screen-label=Groups]').getByRole('button', { name, exact: true }).click();
    let gm = await groupMenu(A);
    await expect(gm.getByText('ADMINS ONLY')).toBeVisible();
    await gm.getByRole('button', { name: 'View as a member' }).click();
    await expect(A.getByText('This is what members of ' + name + ' see')).toBeVisible();
    const pill = A.locator('[data-group-member-view]');
    await expect(pill).toContainText('Viewing as a member');
    await expect(pill).toContainText(name);
    // Taps work as normal; the ⋯ menu has no admin section
    gm = await groupMenu(A);
    await expect(gm.getByText('ADMINS ONLY')).toHaveCount(0);
    await expect(gm.getByRole('button', { name: 'Leave group' })).toBeVisible();
    await gm.getByRole('button', { name: 'Close' }).click();
    await pill.getByRole('button', { name: 'Exit' }).click();
    await expect(A.getByText('Back to your admin view')).toBeVisible();
    await expect(pill).toHaveCount(0);
    gm = await groupMenu(A);
    await expect(gm.getByText('ADMINS ONLY')).toBeVisible();
  } finally {
    if (gid) await asUser(A, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), gid).catch(() => {});
    await admin.context.close();
  }
});

test('Sign-up notes: on You’re signed up!, the job card (Edit, + Add a note) and the centred Who’s signed up', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Hope');
  const mem = await newLead(browser, 2, 'Mo');
  const H = host.page, M = mem.page, title = uniqueTitle('Picnic');
  let id;
  try {
    id = await asUser(H, async (c, _C, { title, day }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Hope', lead_name: 'Hope', lead_id: me, created_by: me, text: title, planned: true, day_date: day, day_time: '12:00' }).select('id').single();
      if (r.error) return r.error.message;
      const j = await c.from('signup_items').insert([{ spark_id: r.data.id, item: 'Bring a dish', need: 4 }]);
      return j.error ? j.error.message : r.data.id;
    }, { title, day: inDays(5) });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    await openIdea(M, id);
    const P = M.locator('[data-screen-label="Plan page"]');
    const card = P.locator('[data-signup="Bring a dish"]');
    await card.locator('[data-part-claim]').click();
    const recap = M.getByRole('dialog', { name: 'You’re signed up' });
    const field = recap.locator('[data-onit-note]');
    await expect(field).toContainText('ADD A NOTE');
    await expect(field).toContainText('Everyone going sees this.');
    await field.getByLabel('Add a note').fill('Lemon bars');
    await expect(field.locator('[data-note-count]')).toHaveText('10/60');
    await recap.locator('[data-onit-done]').click();
    await saved(M);
    // The job card: You · Lemon bars, first, with ✎ Edit
    await expect(card.locator('[data-job-note-row]')).toHaveText(/You · Lemon bars\s*Edit/);
    // Saved for real: still there after a reload
    await M.reload();
    await expect(M.locator('html[data-loaded=true]')).toHaveCount(1);
    await expect(card.locator('[data-job-note-row]')).toContainText('Lemon bars');
    // Who's signed up: a centred pop-up, the note under the name
    await card.locator('[data-held-who]').click();
    const who = M.getByRole('dialog', { name: 'Who’s signed up' });
    await expect(who).toHaveAttribute('data-who-signed-up', '');
    await expect(who.locator('[data-roster-note]')).toHaveText('Lemon bars');
    await who.getByRole('button', { name: 'Close' }).click();
    // Edit: clear it → Note removed → + Add a note; then add one with Enter
    await card.locator('[data-note-edit-btn]').click();
    const ed = card.locator('[data-note-edit]');
    await expect(ed).toBeFocused();
    await ed.fill('');
    await card.locator('[data-note-save]').click();
    await expect(M.getByText('Note removed')).toBeVisible();
    await expect(card.locator('[data-job-note-row]')).toHaveCount(0);
    await card.locator('[data-note-add]').click();
    await card.locator('[data-note-edit]').fill('Bringing plates too');
    await card.locator('[data-note-edit]').press('Enter');
    await expect(M.getByText('Note saved')).toBeVisible();
    await saved(M);
    // Esc cancels without changing it
    await card.locator('[data-note-edit-btn]').click();
    await card.locator('[data-note-edit]').fill('Never mind');
    await card.locator('[data-note-edit]').press('Escape');
    await expect(card.locator('[data-job-note-row]')).toContainText('Bringing plates too');
    // The host sees the note in Who's signed up
    await openIdea(H, id);
    await H.locator('[data-screen-label="Plan page"] [data-signup="Bring a dish"] [data-part-row]').click();
    await expect(H.getByRole('dialog', { name: 'Who’s signed up' }).locator('[data-roster-note]')).toHaveText('Bringing plates too');
  } finally {
    if (id) await deleteIdea(H, id);
    await host.context.close();
    await mem.context.close();
  }
});
