// Design round v8-18 (2026-10-10): Plan an event's polish (cards that start grey, the description's formatting, photos in
// the description card, Post to, Limit RSVPs), and an event at its cap with a waitlist.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, openIdea, deleteIdea, asUser, startPost, pickDate, pickPostTo, closeAskFirst, ideaIdFromUrl, rsvpTap, saved, PNG } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const GREY = 'rgb(223, 226, 231)', WHITE = 'rgb(255, 255, 255)';

test('Plan an event: grey cards turn white, formatting, photos, Post to and Limit RSVPs', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Marisol');
  const page = host.page, title = uniqueTitle('Soup swap');
  let id;
  try {
    await startPost(page, { group: false });
    const flow = page.locator('[data-screen-label="New spark"]');
    // Every card starts grey; tapping into the description alone leaves it grey
    for (const k of ['[data-cp-when-where]', '[data-cp-desc]', '[data-post-to]', '[data-cp-vis]', '[data-cp-inv]', '[data-cap]']) await expect(flow.locator(k)).toHaveCSS('background-color', GREY);
    await flow.getByLabel('Event description').click();
    await expect(flow.locator('[data-cp-desc]')).toHaveCSS('background-color', GREY);
    // Post to: nothing picked is a purple Pick a group (owner, 2026-10-10: Design's purple, not row 198's red)
    await expect(flow.locator('[data-post-sum]')).toHaveText('Pick a group');
    await expect(flow.locator('[data-post-sum]')).toHaveCSS('color', 'rgb(91, 74, 232)');
    await flow.getByLabel('Event title').fill(title);
    await pickDate(flow.locator('[data-cp-row="when"]'), inDays(9));
    await expect(flow.locator('[data-cp-when-where]')).toHaveCSS('background-color', WHITE);
    // The date picker is a centred pop-up with a ×, and no Clear on the event's date
    await flow.locator('[data-cp-row="when"]').getByRole('button', { name: 'Date', exact: true }).click();
    await expect(page.locator('[data-calendar]').getByRole('button', { name: 'Clear the date' })).toHaveCount(0);
    await page.locator('[data-calendar]').getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('[data-calendar]')).toHaveCount(0);
    // Formatting: bold, then a bulleted list; the count is the text without the formatting
    const box = flow.getByLabel('Event description');
    await box.click();
    await flow.getByRole('button', { name: 'Bold' }).click();
    await page.keyboard.type('Bring a pot');
    await flow.getByRole('button', { name: 'Bold' }).click();
    await page.keyboard.press('Enter');
    await flow.getByRole('button', { name: 'Bulleted list' }).click();
    await page.keyboard.type('Soup');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Bread');
    await expect(flow.locator('[data-desc-count]')).toHaveText('22/500');   // Bring a pot · Soup · Bread, and the line breaks
    await expect(flow.locator('[data-cp-desc]')).toHaveCSS('background-color', WHITE);
    // Photos: Add photos in the card, the tiles under it, then Add another · 2 more
    await flow.locator('[data-cp-inspo] input[type=file]').setInputFiles({ name: 'pot.png', mimeType: 'image/png', buffer: PNG });
    await expect(flow.locator('[data-cp-photos] [aria-label="View photo 1"]')).toBeVisible();
    await expect(flow.locator('[data-cp-desc]')).toContainText('Add another');
    await expect(flow.locator('[data-cp-desc]')).toContainText('2 more');
    // Picking a group turns the whole VISIBILITY section white; Limit RSVPs starts at 20, then 1s down
    await pickPostTo(page);
    for (const k of ['[data-post-to]', '[data-cp-vis]', '[data-cp-inv]', '[data-cap]']) await expect(flow.locator(k)).toHaveCSS('background-color', WHITE);
    await expect(flow.locator('[data-post-sum]')).toHaveText('Torrez Fitness');
    await flow.getByRole('switch', { name: 'Limit RSVPs' }).click();
    await expect(flow.locator('[data-cap-n]')).toHaveText('20 people');
    await flow.getByRole('button', { name: 'Fewer people' }).click();
    await expect(flow.locator('[data-cap-n]')).toHaveText('19 people');
    await expect(flow.locator('[data-cap]')).toContainText('Once it’s full, people can join a waitlist.');
    await flow.locator('[data-post]').click();
    await expect(page.locator('[data-screen-label="Plan page"]')).toBeVisible();
    await closeAskFirst(page);
    id = ideaIdFromUrl(page);
    const row = await asUser(page, async (c, _C, id) => (await c.from('sparks').select('cap,vision,mood').eq('id', id).single()).data, id);
    expect(row.cap).toBe(19);
    expect(row.vision).toBe('**Bring a pot**\n- Soup\n- Bread');
    expect(row.mood.length).toBe(1);
    // The event page draws the formatting
    const desc = page.locator('[data-screen-label="Plan page"] [data-desc]');
    await expect(desc.locator('b')).toHaveText('Bring a pot');
    await expect(desc.locator('ul li')).toHaveText(['Soup', 'Bread']);
    expect(host.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(page, id);
    await host.context.close();
  }
});

test('Limit RSVPs: Full, Join waitlist, and the first in line moves up', async ({ browser }) => {
  test.setTimeout(150000);
  const host = await newLead(browser, 1, 'Hope');
  const other = await newLead(browser, 2, 'Otto');
  const H = host.page, O = other.page;
  let id;
  try {
    // A plan for two, the lead one of them; the lead's own browser takes the second place as a test person can't, so
    // Hope's plan fills with her and a plus-one (plus-ones count)
    id = await asUser(H, async (c, _C, f) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert(Object.assign({ group_id: g, author_name: 'Hope', lead_name: 'Hope', lead_id: me, created_by: me, planned: true, cap: 2 }, f)).select('id').single();
      if (r.error) return r.error.message;
      await c.from('rsvps').update({ plus_count: 1 }).eq('spark_id', r.data.id).eq('user_id', me);
      return r.data.id;
    }, { text: uniqueTitle('Tiny supper'), day_date: inDays(6), day_time: '18:00' });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await openIdea(O, id);
    const OP = O.locator('[data-screen-label="Plan page"]');
    await expect(OP.locator('[data-rsvp-full]')).toContainText('Full · 2 of 2');
    await expect(OP.locator('[data-join-waitlist]')).toContainText('You’d be 1st');
    // Going straight to the database is refused too
    expect(await asUser(O, async (c, _C, id) => {
      const me = (await c.auth.getUser()).data.user.id;
      return (await c.from('rsvps').insert({ spark_id: id, user_id: me, status: 'going' })).error ? 'refused' : 'ALLOWED';
    }, id)).toBe('refused');
    await OP.locator('[data-join-waitlist]').click();
    await expect(O.getByRole('status')).toContainText('You’re on the waitlist');
    await expect(OP.locator('[data-rsvp-bar="wait"]')).toContainText('Waitlist · 1st in line');
    await saved(O);
    // Hope's plus-one can't come: a place opens and Otto is Going
    await asUser(H, async (c, _C, id) => { const me = (await c.auth.getUser()).data.user.id; await c.from('rsvps').update({ plus_count: 0 }).eq('spark_id', id).eq('user_id', me); }, id);
    await expect.poll(() => asUser(O, async (c, _C, id) => { const me = (await c.auth.getUser()).data.user.id;
      return ((await c.from('rsvps').select('status').eq('spark_id', id).eq('user_id', me)).data[0] || {}).status; }, id)).toBe('going');
    await openIdea(O, id);
    await expect(OP.locator('[data-rsvp-bar="going"]')).toBeVisible();
    expect(other.errors.filter(e => !/status of 400/.test(e))).toEqual([]);   // the refused insert above
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await other.context.close();
  }
});
