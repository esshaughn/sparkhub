// Groups: Edit group (cover, rename, invite, members and roles, delete), joining, pins, admins editing ideas.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, button, postIdea, openIdea, deleteIdea, confirm, asUser, PNG } = require('./helpers');

const rx = (t) => new RegExp(t.replace(/[[\]]/g, '\\$&'));

// v7 Update 15: Edit group and Leave group live in the group page's ⋯ menu
const groupMenu = async (P) => { await P.locator('[data-screen-label=Browse]').getByRole('button', { name: 'Group options' }).click(); return P.getByRole('dialog', { name: 'Group options' }); };
const editGroup = async (P) => (await groupMenu(P)).getByRole('button', { name: 'Edit group' }).click();

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

    // Groups → the new group → its page → Edit group (owners and admins)
    await A.getByRole('button', { name: 'Groups', exact: true }).click();
    const cardA = A.locator('[data-screen-label=Groups]').getByRole('button', { name: groupName, exact: true });
    await expect(cardA).toContainText('OWNER');
    await cardA.click();
    // A new group's Plans tab (Update 9, 80a): the calendar fan, No plans yet, Start an event
    await expect(A.locator('[data-plans-empty]')).toContainText('No plans yet');
    await expect(A.locator('[data-plans-empty]').getByRole('button', { name: 'Start an event' })).toBeVisible();
    await editGroup(A);
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
    await B.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    await B.getByRole('button', { name: 'Add a group or friend' }).click();
    await B.getByRole('dialog', { name: 'Add people' }).getByRole('button', { name: 'Join a group' }).click();
    const join = B.getByRole('dialog', { name: 'Join a group' });
    await join.getByLabel('Group code').fill('ZZZZ22');
    await join.getByRole('button', { name: 'Join' }).click();
    await expect(join).toContainText('That code didn’t match a group. Check it with whoever sent it.');
    await join.getByRole('button', { name: 'Close' }).click();
    // Signed in before the tap: one confirm (E3), then Welcome to {group} (4) → its Plans tab
    await B.goto('/#/join/' + code);
    const joinAsk = B.getByRole('dialog', { name: 'Join ' + groupName + '?' });
    await expect(joinAsk).toContainText('You’ll join as:');
    await expect(joinAsk).not.toContainText(code);   // the code is never shown
    await joinAsk.getByRole('button', { name: /^Join as / }).click();
    const welcome = B.locator('[data-screen-label="Welcome to group"]');
    await expect(welcome).toContainText('Welcome to' + groupName);
    await expect(welcome).toContainText('Nothing planned yet. Start the first one?');
    await welcome.getByRole('button', { name: 'See what’s coming up' }).click();
    await expect(B.locator('[data-screen-label=Browse]')).toContainText(groupName);
    // The link again, already a member (E2): the group page and a toast, no Welcome
    await B.goto('/#/join/' + code);
    await joinAsk.getByRole('button', { name: /^Join as / }).click();
    await expect(B.getByText('You’re already in ' + groupName)).toBeVisible();
    await expect(welcome).toHaveCount(0);
    await expect(B.locator('[data-screen-label=Browse]')).toContainText(groupName);

    // Groups: pin puts it in the big cards at the top; the gear (owners/admins) opens Edit group
    await A.goto('/');
    await expect(A.locator('html[data-loaded=true]')).toHaveCount(1);
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
    await expect(big).not.toContainText('events');   // no chip row under pinned cards (owner, 2026-09-27)
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
    await detail.getByRole('button', { name: 'Edit idea' }).click();   // an admin gets the round pencil too (the title only); an idea's pop-up says idea
    const sec = A.getByRole('dialog', { name: 'Edit idea' });
    await expect(sec.locator('[data-edit-photo]')).toHaveCount(0);               // only the lead changes the photo
    await sec.getByLabel('Idea title').fill('[E2E] Tempo run, moved indoors');
    await sec.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(detail).toContainText('moved indoors');
    await expect(detail.locator('[data-led-by]')).toContainText('Bo');
    // Led by opens Bo's profile: name, the groups you share, a friend button (owner, 2026-10-01)
    await detail.locator('[data-led-by]').getByRole('button', { name: /^Led by Bo/ }).click();   // the name row (an admin also sees the co-lead ask)
    const person = A.getByRole('dialog', { name: 'Bo' });
    await expect(person.locator('[data-screen-label="Person"]')).toContainText('Bo');
    await expect(person.locator('[data-person-groups]')).toContainText(groupName);
    await expect(person.locator('[data-person-friend]')).toBeVisible();   // Add friend, Requested or Friends: you share a group
    await person.getByRole('button', { name: 'Close' }).click();
    await expect(person).toHaveCount(0);
    // Someone's in it, so it's Cancel or delete; deleting tells no one
    await button(A, /^(Cancel or delete|Delete) this (event|idea)$/).click();
    const takeDown = A.getByRole('dialog', { name: 'Cancel or delete' });
    if (await takeDown.count()) await takeDown.getByRole('button', { name: 'Delete without telling anyone' }).click();
    else await confirm(A, 'Delete it');
    await expect(A.locator('[data-screen-label=Browse]')).not.toContainText('moved indoors');
    ideaId = null;

    // All ideas → Edit (admins) → Members: a row's chevron opens a short profile (email, joined) and actions;
    // Bo becomes an admin, then a second owner
    await editGroup(A);
    await expect(gp).toContainText('2 members');
    await gp.getByRole('button', { name: 'See all members' }).click();
    const members = A.getByRole('dialog', { name: 'Members' });
    const bo = members.locator('[data-member="Bo"]');
    await expect(members.locator('[data-member="Ada"]')).toContainText('(you)');
    await expect(bo.locator('[data-member-panel]')).toHaveCount(0);
    await bo.getByRole('button', { name: 'Bo', exact: true }).click();
    await expect(bo.locator('[data-member-panel]')).toContainText(/Email.*@example\.com/);
    await expect(bo.locator('[data-member-panel]')).toContainText('Joined ');
    await expect(bo.getByRole('button', { name: 'Remove from group' })).toBeVisible();
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
    await expect(B.locator('html[data-loaded=true]')).toHaveCount(1);   // fresh data, not the cached screen
    await B.getByRole('button', { name: 'Groups', exact: true }).click();
    const cardB = B.locator('[data-screen-label=Groups]').getByRole('button', { name: groupName, exact: true });
    await expect(cardB).toContainText('OWNER');
    await cardB.click();
    await editGroup(B);
    await B.getByRole('button', { name: 'See all members' }).click();
    const ada = B.getByRole('dialog', { name: 'Members' }).locator('[data-member="Ada"]');
    await ada.getByRole('button', { name: 'Ada', exact: true }).click();
    await ada.getByRole('button', { name: 'Remove as owner' }).click();
    await confirm(B, 'Remove as owner');
    await expect(B.getByText('Ada is no longer an owner')).toBeVisible();
    await ada.getByRole('button', { name: 'Remove as admin' }).click();
    await expect(B.getByText('Ada is no longer an admin')).toBeVisible();

    // Ada is a plain member now: no badge, no Edit link
    await A.goto('/');
    await expect(A.locator('html[data-loaded=true]')).toHaveCount(1);
    await A.getByRole('button', { name: 'Groups', exact: true }).click();
    await expect(A.locator('[data-screen-label=Groups]').getByRole('button', { name: groupName, exact: true })).not.toContainText(/OWNER|ADMIN/);
    await A.locator('[data-screen-label=Groups]').getByRole('button', { name: groupName, exact: true }).click();
    const plainMenu = await groupMenu(A);
    await expect(plainMenu.getByRole('button', { name: 'Edit group' })).toHaveCount(0);
    await expect(plainMenu).not.toContainText('ADMINS ONLY');
    await plainMenu.getByRole('button', { name: 'Close' }).click();

    // Bo removes Ada from the group and blocks her; the database agrees she's gone, and her code doesn't work
    await ada.getByRole('button', { name: 'Remove and block' }).click();
    await confirm(B, 'Remove and block');
    await expect(B.getByText('Ada was removed and blocked')).toBeVisible();
    await expect(ada).toHaveCount(0);
    await expect.poll(() => asUser(A, async (c, _C, id) => (await c.from('memberships').select('group_id').eq('group_id', id)).data.length, g.id)).toBe(0);
    expect(await asUser(A, async (c, _C, code) => (await c.rpc('join_group', { p_code: code })).data, g.code)).toBeNull();
    // Members lists her under Blocked until someone unblocks her
    const blocked = B.getByRole('dialog', { name: 'Members' }).locator('[data-blocked-row="Ada"]');
    await expect(blocked).toBeVisible();
    await blocked.getByRole('button', { name: 'Unblock' }).click();
    await expect(B.getByText('Ada can rejoin with the link')).toBeVisible();
    await expect(blocked).toHaveCount(0);

    // Bo gets a new invite link: the code changes
    await B.getByRole('dialog', { name: 'Members' }).getByRole('button', { name: 'Close' }).click();
    const gpB = B.locator('[data-screen-label="Edit group"]');
    await expect(gpB).toContainText(g.code);
    await gpB.getByRole('button', { name: 'Get a new invite link' }).click();
    await confirm(B, 'Get a new link');
    await expect(B.getByText('New invite link ready')).toBeVisible();
    await expect(gpB).not.toContainText(g.code);

    // Bo deletes the group: type DELETE
    await B.locator('[data-screen-label="Edit group"]').getByRole('button', { name: 'Delete group' }).click();
    const del = B.getByRole('dialog', { name: 'Delete group' });
    await expect(del.getByRole('heading')).toHaveText('Delete ' + groupName + '?');
    await expect(del).toContainText('for its 1 member');
    await expect(del.getByRole('button', { name: 'Delete group' })).toHaveAttribute('aria-disabled', 'true');
    await del.getByLabel('Type DELETE to confirm').fill('delete');
    await expect(del.getByLabel('Type DELETE to confirm')).toHaveValue('DELETE');
    await del.getByRole('button', { name: 'Delete group' }).click();
    await expect(B.getByText(groupName + ' was deleted')).toBeVisible();
    await expect(B.locator('[data-screen-label="Your calendar"]')).toBeVisible();

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

test('leaving a group: a member leaves from the bottom of its page; its only owner can’t', async ({ browser }) => {
  const owner = await newLead(browser, 2, 'Olive');
  const member = await newLead(browser, 1, 'Mo');
  const O = owner.page, M = member.page;
  const name = '[E2E] Leavers ' + Date.now().toString(36);
  let gid;
  try {
    const g = await asUser(O, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], name);
    gid = g.id;
    await asUser(M, async (c, _C, code) => c.rpc('join_group', { p_code: code }), g.code);

    // The member leaves: confirm, then the Groups page without it, and the database agrees
    await M.goto('/'); await M.reload();
    await M.getByRole('button', { name: 'Groups', exact: true }).click();
    await M.locator('[data-screen-label=Groups]').getByRole('button', { name: name, exact: true }).click();
    // At the foot of the ⋯ menu (v7 Update 15; it was a link under Plans)
    await (await groupMenu(M)).locator('[data-leave-group]').click();
    const c = M.getByRole('alertdialog', { name: 'Leave ' + name + '?' });
    await expect(c).toContainText('The events you posted and your RSVPs stay. You can rejoin with the group’s link.');
    await c.getByRole('button', { name: 'Leave', exact: true }).click();
    await expect(M.getByText('You left ' + name)).toBeVisible();
    await expect(M.locator('[data-screen-label=Groups]')).not.toContainText(name);
    expect(await asUser(M, async (c, _C, id) => (await c.from('memberships').select('group_id').eq('group_id', id)).data.length, gid)).toBe(0);

    // The only owner can't leave: they're told what to do instead, and stay in
    await O.goto('/'); await O.reload();
    await O.getByRole('button', { name: 'Groups', exact: true }).click();
    await O.locator('[data-screen-label=Groups]').getByRole('button', { name: name, exact: true }).click();
    await (await groupMenu(O)).locator('[data-leave-group]').click();
    await O.getByRole('alertdialog').getByRole('button', { name: 'Leave', exact: true }).click();
    await expect(O.getByText('You’re its only owner. Make someone else an owner first (Edit group → Members), or delete the group.')).toBeVisible();
    expect(await asUser(O, async (c, _C, id) => (await c.from('memberships').select('group_id').eq('group_id', id)).data.length, gid)).toBe(1);
    expect(member.errors).toEqual([]);
  } finally {
    if (gid) await asUser(O, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), gid).catch(() => {});
    await owner.context.close();
    await member.context.close();
  }
});

test('an invite link for someone signed out: the group’s landing with sign-in on it; a bad link; inside Instagram', async ({ browser }) => {
  const { page, context, errors } = await newMember(browser, '/#/join/TORREZ');
  try {
    // 1a: the group's name leads; the code never shows; Google, or an email code
    const land = page.locator('[data-screen-label=Invite]');
    await expect(land).toContainText('You’re invited to');
    await expect(land.getByRole('heading', { name: 'Torrez Fitness' })).toBeVisible();
    await expect(land).not.toContainText('TORREZ');
    await expect(land.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await expect(land.getByRole('button', { name: 'Email me a code' })).toHaveAttribute('aria-disabled', 'true');
    await land.getByLabel('Email').fill('someone@example.com');
    await expect(land.getByRole('button', { name: 'Email me a code' })).toHaveAttribute('aria-disabled', 'false');
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);

    // E1: a code that matches nothing; Go to Spark Hub goes to the usual Welcome
    await page.goto('/#/join/ZZZZ99');
    const bad = page.locator('[data-screen-label="Bad invite link"]');
    await expect(bad).toContainText('This invite link isn’t working');
    await expect(bad).not.toContainText('ZZZZ99');
    await bad.getByRole('button', { name: 'Go to Spark Hub' }).click();
    await expect(page.locator('[data-screen-label=Welcome]')).toBeVisible();
    expect(errors).toEqual([]);

    // E4: inside Instagram's browser Google can't work, so email leads and Copy link helps them out
    await context.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0' }));
    await page.goto('about:blank');
    await page.goto('/#/join/TORREZ');
    await expect(land.getByRole('heading', { name: 'Torrez Fitness' })).toBeVisible();
    await expect(land.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);
    await expect(land).toContainText('It won’t work inside this app.');
    await expect(land.getByRole('button', { name: 'Email me a code' })).toBeVisible();
  } finally {
    await context.close();
  }
});
