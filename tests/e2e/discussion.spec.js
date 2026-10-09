// Discussion on a plan (Design v8-1, 20261105000000_event_comments.sql): the new-updates banner for people coming,
// comments and replies (folded until opened), the lead's Send an update, and deleting your own comment.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, postEvent, openIdea, deleteIdea, asUser, confirm, donePlus, rsvpTap } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

test('discussion: the new-update banner, comments, replies, Send an update and delete', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Hope');
  const member = await newLead(browser, 2, 'Omar');
  const H = host.page, O = member.page;
  const title = uniqueTitle('Porch talk');
  let id;
  try {
    id = await postEvent(H, { title, date: inDays(6), time: '18:00' });
    const HP = H.locator('[data-screen-label="Plan page"]');
    // The lead: the box says Write to everyone going…, with the Post update pill by the heading (v8-9; v8-13 renamed it); no banner for leads
    const hd = HP.locator('[data-discussion]');
    await expect(hd).not.toContainText('No comments yet.');
    await expect(hd.locator('[data-send-update]')).toHaveText('Post update');
    await expect(hd.getByLabel('Write a comment')).toHaveAttribute('placeholder', 'Write to everyone going…');
    await hd.getByLabel('Write a comment').fill('Bring a chair if you have one');
    await hd.locator('[data-send-update]').click();
    const blast = H.getByRole('dialog', { name: 'Post an update' });
    await expect(blast.locator('textarea')).toHaveValue('Bring a chair if you have one');   // what was typed comes along
    await blast.getByRole('button', { name: 'Close' }).click();
    // An update straight in the table (the composer's own tests cover posting it)
    await asUser(H, async (c, _C, id) => c.from('plan_updates').insert({ spark_id: id, body: 'Moved to the back porch', audience: 'going' }), id);

    // Omar hasn't replied: he reads but can't write; once Going he gets the banner
    await openIdea(O, id);
    const OP = O.locator('[data-screen-label="Plan page"]'), od = OP.locator('[data-discussion]');
    await expect(od.locator('[data-update]')).toHaveText('Moved to the back porch');
    await expect(od.getByLabel('Write a comment')).toHaveCount(0);
    await expect(OP.locator('[data-upd-banner]')).toHaveCount(0);
    await rsvpTap(OP.locator('[data-rsvp]'), 'Going');
    await donePlus(O);
    await expect(OP.locator('[data-upd-banner]')).toHaveText(/1 new update/);
    await OP.locator('[data-upd-banner]').click();
    await expect(OP.locator('[data-upd-banner]')).toHaveCount(0);   // seen on this device
    await od.getByLabel('Write a comment').fill('Can I bring my dog?');
    await od.getByLabel('Write a comment').press('Enter');
    await expect(od.locator('[data-comment]')).toHaveText(['Can I bring my dog?']);
    await expect(od.getByLabel('Write a comment')).toHaveValue('');

    // Hope answers under it; the reply shows LEAD
    await H.reload();
    await expect(hd.locator('[data-comment]')).toHaveText(['Can I bring my dog?']);
    await hd.locator('[data-post-row="cmt"]').getByText('Reply', { exact: true }).click();
    await hd.locator('[data-reply-input]').fill('Of course!');
    await hd.locator('[data-reply-input]').press('Enter');
    await expect(hd.locator('[data-reply-row]')).toContainText('Of course!');
    await expect(hd.locator('[data-reply-row]')).toContainText('LEAD');

    // Omar sees it folded: View 1 reply opens it
    await O.reload();
    await expect(od.locator('[data-reply-row]')).toHaveCount(0);
    await od.locator('[data-view-replies]').click();
    await expect(od.locator('[data-reply-row]')).toContainText('Of course!');
    // A heart first in the Reply row: pink with a count once liked, tap again to undo (Design v8-15, Q42)
    const heart = od.locator('[data-post-row="cmt"] [data-like]').first();
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    await heart.click();
    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    await expect(heart.locator('[data-like-n]')).toHaveText('1');
    await O.reload();
    await expect(od.locator('[data-post-row="cmt"] [data-like]').first()).toHaveAttribute('aria-pressed', 'true');
    await od.locator('[data-post-row="cmt"] [data-like]').first().click();
    await expect(od.locator('[data-post-row="cmt"] [data-like-n]')).toHaveCount(0);
    // The emoji button adds an emoji to what's typed
    await od.locator('[data-emoji-btn]').click();
    await od.locator('[data-emoji-tray]').getByLabel('🎉').click();
    await expect(od.getByLabel('Write a comment')).toHaveValue('🎉');
    await od.getByLabel('Write a comment').fill('');
    await od.locator('[data-view-replies]').click();
    await expect(OP.locator('[data-discussion] h2 + span')).toHaveText('3');   // the update, the comment, the reply
    // He deletes his comment, and the reply goes with it
    await od.locator('[data-post-row="cmt"] [data-delete-comment]').click();
    await confirm(O, 'Delete');
    await expect(od.locator('[data-comment]')).toHaveCount(0);
    expect(host.errors).toEqual([]);
    expect(member.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await member.context.close();
  }
});

// A comment someone else posts shows on a page that's already open, without restarting the app; a half-typed comment stays
test('discussion: a new comment appears on an open page after a refresh, and typing survives it', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Hope');
  const member = await newLead(browser, 2, 'Omar');
  const H = host.page, O = member.page;
  const title = uniqueTitle('Fresh chat');
  let id;
  try {
    id = await postEvent(H, { title, date: inDays(6), time: '18:00' });
    await openIdea(O, id);
    const OP = O.locator('[data-screen-label="Plan page"]'), od = OP.locator('[data-discussion]');
    await rsvpTap(OP.locator('[data-rsvp]'), 'Going');
    await donePlus(O);
    await expect(od.locator('[data-comment]')).toHaveCount(0);
    await od.getByLabel('Write a comment').fill('half a thou');
    // Hope posts while Omar is looking; Omar's page picks it up on the next refresh
    await asUser(H, async (c, _C, id) => { const r = await c.from('event_comments').insert({ spark_id: id, body: 'Parking is on 51st' }); if (r.error) throw new Error(r.error.message); }, id);
    await O.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(od.locator('[data-comment]')).toHaveText(['Parking is on 51st']);
    await expect(od.getByLabel('Write a comment')).toHaveValue('half a thou');
    // …and a second comment shows after leaving and reopening the event
    await asUser(H, async (c, _C, id) => { await c.from('event_comments').insert({ spark_id: id, body: 'Bring water' }); }, id);
    await O.waitForTimeout(10500);   // the cached list counts as stale after 10 seconds
    await openIdea(O, id);
    await expect(od.locator('[data-comment]')).toHaveCount(2);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close(); await member.context.close();
  }
});
