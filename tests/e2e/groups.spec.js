// Groups: Edit group (cover, rename, invite, members and roles, delete), joining, pins, admins editing ideas.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, button, postIdea, openIdea, deleteIdea, confirm, asUser, PNG, openProfile } = require('./helpers');

const rx = (t) => new RegExp(t.replace(/[[\]]/g, '\\$&'));

test('a group end to end: edit group, cover, rename, invite, pin, admin edits, roles, delete', async ({ browser }) => {
  const admin = await newLead(browser, 1, 'Ada');
  const other = await newLead(browser, 2, 'Bo');
  const A = admin.page, B = other.page;
  let groupName = uniqueTitle('runners');
  let ideaId;
  try {
    // Groups are started behind the scenes now; the starter is its owner
    const g = await asUser(A, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], groupName);
    const code = g.code;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    await A.reload();

    // Profile → Your groups → Edit group
    await openProfile(A);
    const row = A.locator('[data-screen-label=Profile]').getByRole('button', { name: rx(groupName) });
    await expect(row).toContainText('Owner');
    await row.click();
    const gp = A.locator('[data-screen-label="Edit group"]');
    await expect(gp).toContainText('You’re the owner');
    await expect(gp).toContainText(code);
    await expect(gp).toContainText('1 member');
    await expect(gp).toContainText('/join/' + code);
    await gp.getByRole('button', { name: 'Copy code' }).click();
    await expect(A.getByText('Code copied')).toBeVisible();
    await gp.getByRole('button', { name: 'Copy invite link' }).click();
    await expect(A.getByText('Invite link copied')).toBeVisible();

    // Add a cover → the positioner → drag, zoom, save
    await gp.getByLabel('Add a cover').setInputFiles({ name: 'group.png', mimeType: 'image/png', buffer: PNG });
    const ph = A.getByRole('dialog', { name: 'Position photo' });
    await expect(ph).toContainText('Header photo');
    await expect(ph).toContainText('Drag the photo. This is exactly how it’ll show.');
    const box = await ph.getByLabel('Drag to reposition the photo').boundingBox();
    await A.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await A.mouse.down();
    await A.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 + 20, { steps: 5 });
    await A.mouse.up();
    await ph.getByLabel('Zoom').fill('1.5');
    await ph.getByRole('button', { name: 'Save' }).click();
    await expect(A.getByText('Photo saved')).toBeVisible();
    await expect(ph).toHaveCount(0);
    const saved = await asUser(A, async (c, _C, id) => (await c.from('groups').select('photo,photo_pos').eq('id', id).single()).data, g.id);
    expect(saved.photo).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/);
    expect(saved.photo_pos.zoom).toBe(1.5);
    expect(saved.photo_pos.x).toBeGreaterThan(50);            // dragged left → focal point moves right
    await expect(gp.getByText('Change cover')).toBeVisible();

    // Rename in place (owner): Enter saves
    await gp.getByRole('button', { name: 'Rename group' }).click();
    groupName = groupName + ' club';
    await gp.getByLabel('Group name').fill(groupName);
    await gp.getByLabel('Group name').press('Enter');
    await expect(A.getByText('Group renamed')).toBeVisible();
    await expect(gp).toContainText(groupName);

    // A wrong code, then the invite link
    await openProfile(B);
    await B.getByRole('button', { name: 'Join with a code' }).click();
    const join = B.getByRole('dialog', { name: 'Join a group' });
    await join.getByLabel('Group code').fill('ZZZZ22');
    await join.getByRole('button', { name: 'Join' }).click();
    await expect(join).toContainText('That code didn’t match a group. Check it with your organiser.');
    await join.getByRole('button', { name: 'Close' }).click();
    await B.goto('/#/join/' + code);
    await expect(B.getByRole('dialog', { name: 'Join a group' }).getByLabel('Group code')).toHaveValue(code);
    await B.getByRole('dialog', { name: 'Join a group' }).getByRole('button', { name: 'Join' }).click();
    await expect(B.locator('[data-screen-label=Browse]')).toContainText(groupName);

    // Groups: pin puts it in the big cards at the top; the gear (owners/admins) opens Edit group
    await A.goto('/');
    await A.getByRole('button', { name: 'Groups', exact: true }).click();
    const gl = A.locator('[data-screen-label=Groups]');
    await gl.getByRole('button', { name: 'Pin ' + groupName }).click();
    await expect(A.getByText('Pinned', { exact: true })).toBeVisible();
    await expect(gl.getByRole('button', { name: 'Unpin ' + groupName })).toBeVisible();
    await expect.poll(() => asUser(A, async (c, _C, id) => (await c.from('memberships').select('pinned').eq('group_id', id)).data.map(m => m.pinned), g.id)).toEqual([true]);
    await A.reload();
    const big = gl.getByRole('button', { name: groupName, exact: true });
    await expect(big).toContainText('OWNER');
    await expect(big).toContainText('2 members');   // Ada and Bo
    await expect(big).toContainText('0 events');
    await big.getByRole('button', { name: 'Edit ' + groupName }).click();
    await expect(A.locator('[data-screen-label="Edit group"]')).toContainText('You’re the owner');
    await A.locator('[data-screen-label="Edit group"]').getByRole('button', { name: 'Back' }).first().click();
    await expect(gl).toBeVisible();
    await big.click();
    await expect(A.locator('[data-screen-label=Browse]')).toContainText(groupName);

    // Bo posts; the admin edits and deletes it (Bo stays the lead)
    ideaId = await postIdea(B, { title: uniqueTitle('Tempo run') });
    await openIdea(A, ideaId);
    const detail = A.locator('[data-screen-label="Idea page"]');
    await detail.getByRole('button', { name: 'Edit' }).first().click();
    await expect(A.locator('[data-screen-label="Edit idea"]')).toContainText('You’re editing as an admin of ' + groupName + '; Bo still leads it.');
    await A.getByLabel('The idea').fill('[E2E] Tempo run, moved indoors');
    await button(A, 'Save changes').click();
    await expect(detail).toContainText('moved indoors');
    await expect(detail).toContainText('Led by Bo');
    await detail.getByRole('button', { name: 'Edit' }).first().click();
    await button(A, 'Delete this idea').click();
    await confirm(A, 'Delete it');
    await expect(A.locator('[data-screen-label=Browse]')).not.toContainText('moved indoors');
    ideaId = null;

    // All ideas → Edit (admins) → Members: Bo becomes an admin, then a second owner
    await A.locator('[data-screen-label=Browse]').getByRole('button', { name: 'Edit group' }).click();
    await expect(gp).toContainText('2 members');
    await gp.getByRole('button', { name: 'See all members' }).click();
    const members = A.getByRole('dialog', { name: 'Members' });
    const bo = members.locator('[data-member="Bo"]');
    await expect(members.locator('[data-member="Ada"]')).toContainText('(you)');
    await bo.getByRole('button', { name: 'Make admin' }).click();
    await expect(A.getByText('Bo is now an admin')).toBeVisible();
    await expect(bo).toContainText('Admin');
    await bo.getByRole('button', { name: 'Make owner' }).click();
    await confirm(A, 'Make them an owner');
    await expect(A.getByText('Bo is now an owner')).toBeVisible();
    await members.getByLabel('Search members').fill('zz');
    await expect(members).toContainText('No one by that name.');
    await members.getByRole('button', { name: 'Close' }).click();

    // Bo removes Ada as owner, then as admin
    await B.goto('/');
    await openProfile(B);
    const bRow = B.locator('[data-screen-label=Profile]').getByRole('button', { name: rx(groupName) });
    await expect(bRow).toContainText('Owner');
    await bRow.click();
    await B.getByRole('button', { name: 'See all members' }).click();
    const ada = B.getByRole('dialog', { name: 'Members' }).locator('[data-member="Ada"]');
    await ada.getByRole('button', { name: 'Remove' }).click();
    await confirm(B, 'Remove as owner');
    await expect(B.getByText('Ada is no longer an owner')).toBeVisible();
    await ada.getByRole('button', { name: 'Remove' }).click();
    await expect(B.getByText('Ada is no longer an admin')).toBeVisible();

    // Ada is a plain member now: no badge, no Edit link
    await A.goto('/');
    await openProfile(A);
    await expect(A.locator('[data-screen-label=Profile]').getByRole('button', { name: rx(groupName) })).not.toContainText(/Owner|Admin/);

    // Bo deletes the group: type DELETE
    await B.getByRole('dialog', { name: 'Members' }).getByRole('button', { name: 'Close' }).click();
    await B.locator('[data-screen-label="Edit group"]').getByRole('button', { name: 'Delete group' }).click();
    const del = B.getByRole('dialog', { name: 'Delete group' });
    await expect(del.getByRole('heading')).toHaveText('Delete ' + groupName + '?');
    await expect(del).toContainText('for all 2 members');
    await expect(del.getByRole('button', { name: 'Delete group' })).toHaveAttribute('aria-disabled', 'true');
    await del.getByLabel('Type DELETE to confirm').fill('delete');
    await expect(del.getByLabel('Type DELETE to confirm')).toHaveValue('DELETE');
    await del.getByRole('button', { name: 'Delete group' }).click();
    await expect(B.getByText(groupName + ' was deleted')).toBeVisible();
    await expect(B.locator('[data-screen-label=Home]')).toBeVisible();

    expect(admin.errors).toEqual([]);
    expect(other.errors).toEqual([]);
  } finally {
    if (ideaId) await deleteIdea(B, ideaId).catch(() => {});
    const suffix = groupName.split(' ')[2];
    for (const P of [A, B]) {
      await asUser(P, async (c, _C, suffix) => {
        const g = (await c.from('groups').select('id').ilike('name', '%' + suffix + '%')).data || [];
        for (const x of g) await c.rpc('e2e_delete_group', { p_group: x.id });
      }, suffix).catch(() => {});
    }
    await admin.context.close();
    await other.context.close();
  }
});

test('an invite link for someone signed out: Welcome names the code, signing in opens Join', async ({ browser }) => {
  const { page, context } = await newMember(browser, '/#/join/TORREZ');
  try {
    const welcome = page.locator('[data-screen-label=Welcome]');
    await expect(welcome).toContainText('Sign in to join the group TORREZ');
    await welcome.getByRole('button', { name: 'Continue with email' }).click();
    await expect(page.getByRole('dialog', { name: 'Sign in' })).toContainText('Sign in to join a group.');
  } finally {
    await context.close();
  }
});
