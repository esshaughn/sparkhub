// Groups: start one, invite with a code or link, join, switch, "new ideas" badges, the admin page.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, button, postIdea, deleteIdea } = require('./helpers');

test('start a group, invite someone, they join and post, the admin sees a badge', async ({ browser }) => {
  const admin = await newLead(browser, 1, 'Ada');
  const other = await newLead(browser, 2, 'Bo');
  const A = admin.page, B = other.page;
  const name = uniqueTitle('runners');
  let ideaId;
  try {
    // Start a group from Profile
    await A.getByRole('button', { name: 'Profile' }).click();
    await A.getByRole('button', { name: 'Start a group' }).click();
    const create = A.getByRole('dialog', { name: 'Start a group' });
    await expect(create).toContainText('You’ll run it, and get a code to invite others.');
    await expect(create.getByRole('button', { name: 'Create group' })).toHaveAttribute('aria-disabled', 'true');
    await create.getByLabel('Group name').fill(name);
    await create.getByRole('button', { name: 'Create group' }).click();
    const groupName = '[E2E] Runners ' + name.split(' ').pop().charAt(0).toUpperCase() + name.split(' ').pop().slice(1);
    await expect(create.getByRole('heading', { name: groupName + ' is ready' })).toBeVisible();
    const code = (await create.locator('div', { hasText: /^Invite code/ }).locator('div').nth(1).textContent()).trim();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    await expect(create).toContainText('/join/' + code);
    await create.getByRole('button', { name: 'Go to ' + groupName }).click();
    const browse = A.locator('[data-screen-label=Browse]');
    await expect(browse).toContainText(groupName);
    await expect(browse).toContainText('No ideas yet.');

    // Admin page: code, members, copy
    await A.getByRole('button', { name: 'Profile' }).click();
    const row = A.locator('[data-screen-label=Profile]').getByRole('button', { name: new RegExp(groupName.replace(/[[\]]/g, '\\$&')) });
    await expect(row).toContainText('Admin');
    await row.click();
    const gp = A.locator('[data-screen-label="Group you run"]');
    await expect(gp).toContainText('You’re an admin');
    await expect(gp).toContainText(code);
    await expect(gp.getByText('Members').locator('..')).toContainText('1');
    await button(A, 'Copy code').click();
    await expect(A.getByText('Code copied')).toBeVisible();

    // A wrong code, then the invite link
    await B.getByRole('button', { name: 'Profile' }).click();
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

    // The admin switches back to Torrez Fitness
    await A.goto('/');
    await A.getByRole('button', { name: 'Switch group' }).click();
    await A.getByRole('menu', { name: 'Your groups' }).getByRole('button', { name: /^Torrez Fitness/ }).click();
    await expect(A.getByRole('button', { name: 'Switch group' })).toContainText('Torrez Fitness');

    // They post into the new group; the admin sees a "1 new" badge on it
    ideaId = await postIdea(B, { title: uniqueTitle('Tempo run') });
    await A.reload();
    await A.getByRole('button', { name: 'Switch group' }).click();
    const menu = A.getByRole('menu', { name: 'Your groups' });
    await expect(menu.getByRole('button', { name: new RegExp(groupName.replace(/[[\]]/g, '\\$&')) })).toContainText('Admin');
    await expect(menu.getByLabel('1 new ideas')).toBeVisible();
    await menu.getByRole('button', { name: new RegExp(groupName.replace(/[[\]]/g, '\\$&')) }).click();
    await expect(A.getByRole('button', { name: 'Switch group' })).toContainText(groupName);

    // Admin page counts both members
    await A.goto('/');
    await A.getByRole('button', { name: 'Profile' }).click();
    await A.locator('[data-screen-label=Profile]').getByRole('button', { name: new RegExp(groupName.replace(/[[\]]/g, '\\$&')) }).click();
    await expect(A.locator('[data-screen-label="Group you run"]').getByText('Members').locator('..')).toContainText('2');

    expect(admin.errors).toEqual([]);
    expect(other.errors).toEqual([]);
  } finally {
    if (ideaId) await deleteIdea(B, ideaId).catch(() => {});
    await admin.context.close();
    await other.context.close();
  }
});

test('an invite link for someone signed out: code filled in on Welcome, joining asks them to sign in', async ({ browser }) => {
  const { page, context } = await newMember(browser, '/#/join/TORREZ');
  try {
    await expect(page.locator('[data-screen-label=Welcome]')).toBeVisible();
    await expect(page.getByLabel('Group code')).toHaveValue('TORREZ');
    await button(page, 'Join').click();
    const login = page.getByRole('dialog', { name: 'Sign in' });
    await expect(login).toContainText('Sign in to join a group.');

    // Start your own group also needs an account
    await login.getByRole('button', { name: 'Close' }).click();
    await button(page, 'Start your own group').click();
    await expect(page.getByRole('dialog', { name: 'Sign in' })).toBeVisible();
  } finally {
    await context.close();
  }
});
