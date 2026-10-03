// Your schedule's strips (v6), the sign-up time, the Calendar's role strips, back navigation,
// and the host's Hosting list.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, postEvent, openIdea, deleteIdea, pickView, addJob } = require('./helpers');

// Local dates, like the app (toISOString would be UTC, a day ahead in the evening)
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('Your schedule and the Calendar: role strips, a helper’s sign-ups with times, the host’s dashboard', async ({ browser }) => {
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
      await addJob(H, { item, need: +need, time });
      await expect(HP.locator('[data-signup="' + item + '"]')).toBeVisible();
    }
    await expect(HP.locator('[data-signup="Folding tables"]')).toContainText('3:30pm');

    // Hal says he's going and takes three things
    await openIdea(O, id);
    const OP = O.locator('[data-screen-label="Plan page"]');
    await OP.locator('[data-rsvp]').getByRole('button', { name: /^Going/ }).click();
    await expect(OP.locator('[data-rsvp]').getByRole('button', { name: /^Going/ })).toHaveAttribute('aria-pressed', 'true');
    for (const item of ['Folding tables', 'Ice', 'Speaker']) {
      await OP.locator('[data-signup="' + item + '"]').getByRole('button', { name: 'Sign up' }).click();
      await expect(OP.locator('[data-signup="' + item + '"]').getByText('You’re in')).toBeVisible();
    }

    // Hal's Your schedule: a Helping strip, "3 tasks", expanding in place to his sign-ups with the time
    await O.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Your calendar', exact: true }).click();
    const oHome = O.locator('[data-screen-label="Your calendar"]');
    await pickView(oHome, 'Tiles');
    const tile = oHome.locator('[data-plan="' + title + '"]');
    await expect(tile).toContainText('Hunters Lane');
    await expect(tile).toContainText('Helping');
    await tile.getByText('3 tasks').click();
    await expect(tile).toContainText('Folding tables');
    await expect(tile).toContainText('3:30pm');
    await expect(tile).toContainText('Speaker');
    await pickView(oHome, 'Up next');
    await expect(tile).toContainText('Helping');

    // Hope's Your schedule: Leading, with her to-dos (or All set)
    await H.reload();
    await H.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Your calendar', exact: true }).click();
    await pickView(H.locator('[data-screen-label="Your calendar"]'), 'Tiles');   // Up next lists the hero's to-dos open, without a count
    const hTile = H.locator('[data-screen-label="Your calendar"] [data-plan="' + title + '"]');
    await expect(hTile).toContainText('Leading');
    await expect(hTile).toContainText(/\d+ tasks?|All set/);

    // Calendar: the same strip as Your schedule (audit, 2026-10-01: no "Manage"); Hal's says Helping
    await H.getByRole('button', { name: 'Explore', exact: true }).click();
    const hCard = H.locator('[data-screen-label=Explore] [data-plan="' + title + '"]');
    await expect(hCard).toContainText('Leading');
    await expect(hCard).toContainText(/\d+ tasks?|All set/);
    await expect(hCard).not.toContainText('Manage');
    await O.getByRole('button', { name: 'Explore', exact: true }).click();
    const oCal = O.locator('[data-screen-label=Explore]');
    const row = oCal.locator('[data-plan="' + title + '"]');
    await expect(row).toContainText('Helping');
    await expect(row).toContainText('4pm · Hunters Lane');

    // Back from an event page returns to where it was opened from (here, the Calendar), then Your schedule
    await row.locator('div').first().click();
    // The Calendar opens the event preview first (v7 Update 15, 13a); See the full event goes on to the page
    const peek = O.getByRole('dialog', { name: 'Event preview' });
    await expect(peek.locator('[data-peek-title]')).toHaveText(title);
    await expect(peek).toContainText('Led by');
    await expect(peek).toContainText('Hunters Lane');
    await peek.getByRole('button', { name: 'See the full event' }).click();
    await O.locator('[data-screen-label="Plan page"]').getByRole('button', { name: 'Back to Explore' }).click();
    await expect(oCal).toBeVisible();
    await O.getByRole('button', { name: 'Your calendar', exact: true }).click();
    await tile.click();
    await O.locator('[data-screen-label="Plan page"]').getByRole('button', { name: 'Back to Your calendar' }).click();
    await expect(oHome.getByRole('heading', { name: 'Your calendar' })).toBeVisible();

    // Hope's Hosting (Update 8): her plan under Planning with its date; a tap opens it
    await H.goto('/#/own');
    const hosting = H.locator('[data-screen-label="Leading"]');
    const own = hosting.getByRole('region', { name: 'Planning' }).locator('[data-host="' + title + '"]');
    await expect(own).toContainText(new Date(inDays(4) + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    await own.click();
    await expect(H.locator('[data-screen-label="Plan page"]').getByRole('button', { name: 'Back to Leading' })).toBeVisible();

    expect(host.errors).toEqual([]);
    expect(helper.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await helper.context.close();
  }
});
