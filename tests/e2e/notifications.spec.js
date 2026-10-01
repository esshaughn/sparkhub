// V5 notifications: built from what's stored. A new plan shows for the group with RSVP buttons;
// the host hears about replies; updates show with their text; read state and settings persist.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, postEvent, deleteIdea, confirm } = require('./helpers');

const esc = (t) => t.replace(/[[\]]/g, '\\$&');
// Local dates, like the app (toISOString would be UTC, a day ahead in the evening)
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('notifications: a new plan, replying from the feed, the host hears back, updates, read state, settings', async ({ browser }) => {
  test.setTimeout(150000);
  const host = await newLead(browser, 1, 'Hope');
  const other = await newLead(browser, 2, 'Omar');
  const H = host.page, O = other.page;
  const title = uniqueTitle('Bike ride');
  let id;
  try {
    id = await postEvent(H, { title, date: inDays(6), time: '09:00' });

    // Omar: the bell shows new ones; the plan is in the feed with RSVP buttons
    await O.reload();
    await expect(O.getByRole('button', { name: /^Notifications, \d+ new$/ })).toBeVisible();
    await O.getByRole('button', { name: /^Notifications/ }).click();
    const feed = O.getByRole('dialog', { name: 'Notifications' });
    const row = feed.locator('[data-notif=newevent]').filter({ hasText: title });
    await expect(row).toContainText('New: ' + title);
    await expect(row).toContainText(/\w+ is leading · /);   // leads are shared between parallel tests, so names can change
    await expect(feed.getByRole('radio', { name: 'New', exact: true })).toBeVisible();   // was "Invites"; nobody is invited
    await expect(row.getByLabel('Unread')).toBeVisible();
    await row.getByRole('button', { name: 'I’m going' }).click();
    await expect(O.getByText('You’re going. See you there!')).toBeVisible();
    await expect(row.getByRole('button', { name: 'I’m going' })).toHaveCount(0);
    await expect(row.getByLabel('Unread')).toHaveCount(0);

    // Hope hears about it (Hosting) and posts an update
    await H.reload();
    await H.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^Your tasks/ }).click();
    await H.getByRole('button', { name: /^Notifications/ }).click();
    const hfeed = H.getByRole('dialog', { name: 'Notifications' });
    await hfeed.getByRole('radio', { name: 'Leading' }).click();
    await expect(hfeed.locator('[data-notif=rsvp]').filter({ hasText: title })).toContainText(new RegExp('\\w+ is going to ' + esc(title)));
    await hfeed.locator('[data-notif=rsvp]').filter({ hasText: title }).click();
    await expect(H.locator('[data-screen-label="Plan page"]')).toBeVisible();
    await H.getByRole('button', { name: 'Send everyone an update' }).click();
    const blast = H.getByRole('dialog', { name: 'Send an update' });
    await blast.getByLabel('Your update').fill('Helmets on, please.');
    await blast.getByRole('button', { name: 'Post update' }).click();
    await expect(H.getByText('Posted to the event')).toBeVisible();

    // Omar: the update, with its text, under Updates; Mark all read sticks after a reload
    await O.reload();
    await O.getByRole('button', { name: /^Notifications/ }).click();   // v6: a sheet from the bell
    await feed.getByRole('radio', { name: 'Updates' }).click();
    const upd = feed.locator('[data-notif=update]').filter({ hasText: title });
    await expect(upd).toContainText(title + ' · Helmets on, please.');   // Round 65a: "{event} · {update}", From {host}
    await expect(upd).toContainText(/From \w+/);
    await feed.getByRole('radio', { name: 'All' }).click();
    const saved = O.waitForResponse(r => r.url().includes('/rest/v1/notif_state') && r.request().method() === 'POST');
    await feed.getByText('Mark all read').click();
    await saved;
    await expect(feed.getByLabel('Unread')).toHaveCount(0);
    await expect(O.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
    await O.reload();
    await O.getByRole('button', { name: /^Notifications/ }).click();   // v6: a sheet from the bell
    await expect(feed.getByLabel('Unread')).toHaveCount(0);

    // Settings: turning a topic off hides it; back on shows it again
    await feed.getByRole('button', { name: 'Notification settings' }).click();
    const set = O.getByRole('dialog', { name: 'Notification settings' });
    await set.getByRole('switch', { name: 'Updates from leads' }).click();
    await expect(set.getByRole('switch', { name: 'Updates from leads' })).toHaveAttribute('aria-checked', 'false');
    await set.getByRole('button', { name: 'Close' }).click();
    await expect(set).toHaveCount(0);
    await expect(feed.locator('[data-notif=update]').filter({ hasText: title })).toHaveCount(0);
    await O.reload();
    await O.getByRole('button', { name: /^Notifications/ }).click();   // v6: a sheet from the bell
    await expect(feed.locator('[data-notif=update]').filter({ hasText: title })).toHaveCount(0);
    await feed.getByRole('button', { name: 'Notification settings' }).click();
    await set.getByRole('switch', { name: 'Updates from leads' }).click();
    await expect(set.getByRole('switch', { name: 'Updates from leads' })).toHaveAttribute('aria-checked', 'true');

    expect(host.errors).toEqual([]);
    expect(other.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await other.context.close();
  }
});
