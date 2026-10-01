// Friends (v6 Update 13): a request from a group's Members list, Accept on the Friends tab, inviting a
// friend to an event (they hear about it in the bell), the long-press profile with Remove friend, and the
// friend link (/add/CODE: yes makes you friends straight away).
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, asUser, postEvent, deleteIdea } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const uid = (page) => asUser(page, async (c) => (await c.auth.getUser()).data.user.id);
const unfriend = (page, other) => asUser(page, async (c, _C, id) => c.rpc('remove_friend', { p_other: id }), other).catch(() => {});

test('friends: request, accept, invite to an event, remove, and the friend link', async ({ browser }) => {
  const a = await newLead(browser, 1, 'Fay Friendly');
  const b = await newLead(browser, 2, 'Gus Friendly');
  const A = a.page, B = b.page;
  const nav = (P) => P.getByRole('navigation', { name: 'Main' });
  let id, aId, bId;
  try {
    [aId, bId] = [await uid(A), await uid(B)];
    await unfriend(A, bId);   // a leftover from an earlier run
    await B.reload();
    await A.reload();

    // A asks from Torrez Fitness's Members list (the member count on the group's header opens it, for everyone)
    await nav(A).getByRole('button', { name: 'Groups', exact: true }).click();
    await A.locator('[data-screen-label=Groups]').getByRole('button', { name: 'Torrez Fitness', exact: true }).click();
    await A.locator('[data-screen-label=Browse]').getByRole('button', { name: 'See members' }).click();
    const members = A.getByRole('dialog', { name: 'Members' });
    await members.getByLabel('Search members').fill('Gus Friendly');
    await members.getByRole('button', { name: 'Gus Friendly', exact: true }).click();
    await members.locator('[data-member-panel]').getByRole('button', { name: 'Add friend' }).click();
    await expect(A.getByText('Friend request sent to Gus')).toBeVisible();
    await expect(members.locator('[data-member-panel]')).toContainText('Requested');
    await members.getByRole('button', { name: 'Close' }).click();

    // B sees it on the Friends tab and accepts
    await B.reload();
    await nav(B).getByRole('button', { name: 'Groups', exact: true }).click();
    const people = B.locator('[data-screen-label=Groups]');
    await people.getByRole('tab', { name: /^Friends/ }).click();
    const req = people.locator('[data-friend-request="Fay Friendly"]');
    await expect(req).toContainText('Wants to be friends');
    await req.getByRole('button', { name: 'Accept Fay Friendly' }).click();
    await expect(B.getByText('You and Fay are friends')).toBeVisible();
    await expect(people.getByRole('button', { name: 'Fay Friendly', exact: true })).toBeVisible();

    // A invites B to an event: tap the friend, the invite bar, pick the event
    const title = uniqueTitle('Friends night');
    id = await postEvent(A, { title, date: inDays(9), time: '18:00' });
    await nav(A).getByRole('button', { name: 'Groups', exact: true }).click();
    const aPeople = A.locator('[data-screen-label=Groups]');
    await aPeople.getByRole('tab', { name: /^Friends/ }).click();
    await aPeople.getByRole('button', { name: 'Gus Friendly', exact: true }).click();
    await expect(aPeople.getByRole('button', { name: 'Gus Friendly', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await aPeople.locator('[data-invite-bar]').getByText('Invite Gus to…').click();
    const pick = A.getByRole('dialog', { name: 'Invite friends' });
    await expect(pick).toContainText('Invite Gus');
    await pick.locator('[data-invite-event="' + title + '"]').click();
    await expect(A.getByText('Invited Gus to ' + title + '.')).toBeVisible();
    await expect(aPeople.locator('[data-invite-bar]')).toHaveCount(0);
    // Inviting again skips them quietly
    await aPeople.getByRole('button', { name: 'Gus Friendly', exact: true }).click();
    await aPeople.locator('[data-invite-bar]').getByText('Invite Gus to…').click();
    await A.getByRole('dialog', { name: 'Invite friends' }).locator('[data-invite-event="' + title + '"]').click();
    await expect(A.getByText('Gus was already invited.')).toBeVisible();

    // B hears about it in the bell
    await B.reload();
    await B.locator('[data-screen-label=Groups]').getByRole('button', { name: /^Notifications/ }).click();
    const bell = B.getByRole('dialog', { name: 'Notifications' });
    await expect(bell.locator('[data-notif=invited]').first()).toContainText('Fay Friendly invited you to ' + title);
    await bell.getByRole('button', { name: 'Close' }).click();

    // B long-presses (right-click here) Fay: the short profile, Remove friend
    await B.locator('[data-screen-label=Groups]').getByRole('tab', { name: /^Friends/ }).click();
    await B.locator('[data-screen-label=Groups]').getByRole('button', { name: 'Fay Friendly', exact: true }).click({ button: 'right' });
    const prof = B.getByRole('dialog', { name: 'Fay Friendly' });
    await expect(prof).toContainText('Friends since');
    await prof.getByRole('button', { name: 'Remove friend' }).click();
    await B.getByRole('alertdialog').getByRole('button', { name: 'Remove friend' }).click();
    await expect(B.getByText('Removed Fay')).toBeVisible();
    await expect(B.locator('[data-screen-label=Groups]').getByRole('button', { name: 'Fay Friendly', exact: true })).toHaveCount(0);

    // The friend link: B opens A's link and says yes
    const code = await asUser(A, async (c) => (await c.rpc('my_friend_code')).data);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    await B.goto('/#/add/' + code);
    const ask = B.getByRole('dialog', { name: 'Add a friend' });
    await expect(ask).toContainText('Add Fay Friendly as a friend?');
    await ask.getByRole('button', { name: 'Add friend' }).click();
    await expect(B.getByText('You and Fay are friends')).toBeVisible();
    await expect(B.locator('[data-screen-label=Groups]').getByRole('button', { name: 'Fay Friendly', exact: true })).toBeVisible();
    // Your own link says so
    await A.goto('/#/add/' + code);
    await expect(A.getByRole('dialog', { name: 'Friend link' })).toContainText('That’s your link');
  } finally {
    if (aId && bId) await unfriend(A, bId);
    if (id) await deleteIdea(A, id).catch(() => {});
    await a.context.close();
    await b.context.close();
  }
});
