// Discussion on a plan (Design v8-1, 20261105000000_event_comments.sql): the new-updates banner for people coming,
// comments and replies (folded until opened), the lead's Send an update, and deleting your own comment.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, postEvent, openIdea, deleteIdea, asUser, confirm } = require('./helpers');

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
    // The lead: the box says Write to everyone going…, with the Send update pill by the heading (v8-9); no banner for leads
    const hd = HP.locator('[data-discussion]');
    await expect(hd).not.toContainText('No comments yet.');
    await expect(hd.locator('[data-send-update]')).toHaveText('Send update');
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
    await OP.locator('[data-rsvp]').getByRole('button', { name: /^Going/ }).click();
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
