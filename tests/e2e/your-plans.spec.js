// V5 update: Your plans (Tiles / List / Grid with the helping list and the lead's dashboard),
// the sign-up time, and the all-groups Calendar with role pills and filters.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, postEvent, openIdea, deleteIdea } = require('./helpers');

// Local dates, like the app (toISOString would be UTC, a day ahead in the evening)
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('Your plans and the Calendar: the host’s dashboard, a helper’s list with times, role pills', async ({ browser }) => {
  test.setTimeout(150000);
  const host = await newLead(browser, 1, 'Hope');
  const helper = await newLead(browser, 2, 'Hal');
  const H = host.page, O = helper.page;
  const title = uniqueTitle('Block party');
  let id;
  try {
    id = await postEvent(H, { title, date: inDays(4), time: '16:00', where: 'Hunters Lane' });

    // The host adds sign-ups; one has a time (hosts only)
    const HP = H.locator('[data-screen-label="Plan page"]');
    for (const [item, need, time] of [['Folding tables', '2', '15:30'], ['Ice', '1', ''], ['Speaker', '1', '']]) {
      await HP.getByLabel('Add a sign-up').fill(item);
      await HP.getByLabel('How many needed').fill(need);
      if (time) await HP.getByLabel('Sign-up time').selectOption(time);
      await HP.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(HP.locator('[data-signup="' + item + '"]')).toBeVisible();
    }
    await expect(HP.locator('[data-signup="Folding tables"]')).toContainText('3:30pm');

    // Hal says he's going and takes three things
    await openIdea(O, id);
    const OP = O.locator('[data-screen-label="Plan page"]');
    await OP.getByRole('button', { name: 'I’m going' }).click();
    await expect(OP.getByRole('button', { name: '✓ Going' })).toBeVisible();
    for (const item of ['Folding tables', 'Ice', 'Speaker']) {
      await OP.locator('[data-signup="' + item + '"]').getByRole('button', { name: 'Sign up' }).click();
      await expect(OP.locator('[data-signup="' + item + '"]').getByText('✓ You’re on it')).toBeVisible();
    }

    // Hal's Your plans: the tile shows what he's helping with (two, then "+1 more"), with the time
    await O.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Your plans', exact: true }).click();
    const oHome = O.locator('[data-screen-label=Home]');
    const tile = oHome.locator('[data-plan="' + title + '"]');
    await expect(tile).toContainText('Hunters Lane');
    await expect(tile).toContainText('YOU’RE HELPING:');
    await expect(tile).toContainText('Folding tables');
    await expect(tile).toContainText('3:30pm');
    await expect(tile).toContainText('+1 more');
    await tile.getByText('+1 more').click();
    await expect(tile).toContainText('Speaker');
    await expect(tile).toContainText('Show less');
    await oHome.getByRole('radio', { name: 'Grid' }).click();
    await expect(tile.getByLabel('You’re helping')).toBeVisible();
    await oHome.getByRole('radio', { name: 'List' }).click();
    await expect(tile).toContainText('YOU’RE HELPING:');
    await oHome.getByRole('radio', { name: 'Tiles' }).click();

    // Hope's Your plans: Leading, with Going · Maybe · Sign-ups and the Actions tile
    await H.reload();
    await H.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Your plans', exact: true }).click();
    const hTile = H.locator('[data-screen-label=Home] [data-plan="' + title + '"]');
    await expect(hTile.getByLabel('You’re leading')).toBeVisible();
    await expect(hTile.getByLabel('1 going')).toBeVisible();
    await expect(hTile.getByLabel('0 maybe')).toBeVisible();
    await expect(hTile.getByLabel('Sign-ups: 3 of 4')).toBeVisible();
    await expect(hTile.getByLabel(/^\d+ actions?$|^All set$/)).toBeVisible();

    // Calendar: Hope sees "Leading", Hal sees "Going" with his helping chip; the Helping filter keeps it
    await H.getByRole('button', { name: 'Calendar', exact: true }).click();
    await expect(H.locator('[data-screen-label=Calendar] [data-cal="' + title + '"]')).toContainText('Leading');
    await O.getByRole('button', { name: 'Calendar', exact: true }).click();
    const oCal = O.locator('[data-screen-label=Calendar]');
    const row = oCal.locator('[data-cal="' + title + '"]');
    await expect(row).toContainText('Going');
    await expect(row).toContainText('Helping · Folding tables, Ice, Speaker');
    await expect(row).toContainText('4pm · Torrez Fitness');
    await oCal.getByRole('tab', { name: /^Helping/ }).click();
    await expect(row).toBeVisible();
    await oCal.getByRole('tab', { name: /^Leading/ }).click();
    await expect(row).toHaveCount(0);

    expect(host.errors).toEqual([]);
    expect(helper.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await helper.context.close();
  }
});
