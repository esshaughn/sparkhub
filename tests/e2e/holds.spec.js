// Design's round after Update 16 (design/spark-hub/HANDOFF-to-CODE.md): soft holds on the Month views, the Start an
// event heads-up and the voting card's hold line (20261103000000_soft_holds.sql); Explore's Plans · Ideas · Past;
// Find more events at the end of Your calendar.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, openIdea, deleteIdea, asUser, pickView, pickDate, startPost, pickKind } = require('./helpers');

// Local dates, like the app
// The database counts holds in Central time (America/Chicago): after 7pm Central the runner's UTC date is a day ahead
const chicagoInDays = (n) => { const [y, m, d] = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }).split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const nav = (p) => p.getByRole('navigation', { name: 'Main' });
// An idea (or a plan) in Torrez Fitness, led by whoever's page this is
const makeEvent = (page, fields) => asUser(page, async (c, _C, f) => {
  const me = (await c.auth.getUser()).data.user.id;
  const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
  const r = await c.from('sparks').insert(Object.assign({ group_id: g, author_name: 'Hana', lead_name: 'Hana', lead_id: me, created_by: me }, f)).select('id').single();
  return r.error ? r.error.message : r.data.id;
}, fields);

test('soft holds: a date poll pencils its dates in on Month, warns Start an event, and the lead can keep holding', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Hana'), member = await newLead(browser, 2, 'Milo');
  const H = host.page, M = member.page, title = uniqueTitle('Book club'), day = inDays(5);
  let id;
  try {
    id = await makeEvent(H, { text: title });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    // Two dates in the poll; Milo votes for the first. The first date starts the hold (7 days)
    const opt = await asUser(H, async (c, _C, { id, day, day2 }) => {
      const a = await c.from('date_options').insert({ spark_id: id, day_date: day, day_time: '19:00', who: 'Hana' }).select('id').single();
      await c.from('date_options').insert({ spark_id: id, day_date: day2, who: 'Hana' });
      return a.data.id;
    }, { id, day, day2: inDays(6) });
    await asUser(M, async (c, _C, o) => c.from('date_votes').insert({ option_id: o }), opt);
    expect(await asUser(H, async (c, _C, id) => (await c.from('sparks').select('hold_until').eq('id', id).single()).data.hold_until, id)).toBe(chicagoInDays(7));

    // Milo's Explore Month: a hollow dot on the day, and PENCILLED IN under the grid once it's picked
    await M.reload();
    await nav(M).getByRole('button', { name: 'Explore', exact: true }).click();
    const cal = M.locator('[data-screen-label=Explore]');
    await pickView(cal, 'Month');
    if (day.slice(0, 7) !== inDays(0).slice(0, 7)) await cal.getByRole('button', { name: 'Next month' }).click();
    await expect(cal.locator('[data-hold-key]')).toContainText('Pencilled in');
    await cal.getByRole('button', { name: /1 pencilled in$/ }).first().click();
    const hold = cal.locator('[data-hold="' + title + '"]').first();
    await expect(cal).toContainText('PENCILLED IN');
    await expect(hold).toContainText(/7(:00)?pm · 1 vote so far · ✓ You voted/);
    await hold.click();   // the idea page, at Help pick when and where (never the event preview)
    await expect(M.locator('[data-screen-label="Idea page"]')).toBeVisible();
    await expect(M.locator('[data-hold-line]')).toContainText('Holding these dates on the Calendar until');
    await expect(M.locator('[data-hold-line]').getByRole('button', { name: 'Keep holding' })).toHaveCount(0);
    // Your calendar doesn't show holds
    await nav(M).getByRole('button', { name: 'Your calendar', exact: true }).click();
    await expect(M.locator('[data-hold]')).toHaveCount(0);
    await nav(M).getByRole('button', { name: 'Explore', exact: true }).click();
    await pickView(cal, 'List');

    // The voting card's dates are rows, most votes first; Hana keeps holding
    await openIdea(H, id);
    const rows = H.locator('[data-vote-box="day"] [data-poll-opt]');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('1 vote');
    await expect(H.locator('[data-hold-line]')).toContainText('Holding until');
    await H.locator('[data-hold-line]').getByRole('button', { name: 'Keep holding' }).click();
    await expect(H.getByText(/^Holding until /)).toBeVisible();

    // Start an event on a held date: a heads-up, and Next still works
    await startPost(H);
    await pickKind(H);
    const flow = H.locator('[data-screen-label="New spark"]');
    await flow.getByLabel('Event title').fill('Something else');
    await flow.getByRole('button', { name: 'Next' }).click();
    await pickDate(flow, day);
    await expect(flow.locator('[data-hold-note]')).toContainText(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' is holding 7(:00)?pm · voting until'));
    await expect(flow.getByRole('button', { name: 'Next' })).toHaveAttribute('aria-disabled', 'false');
    await flow.getByRole('button', { name: 'Close' }).click();
    await H.getByRole('dialog', { name: 'Save as draft' }).getByText('Discard', { exact: true }).click();
    expect(host.errors).toEqual([]);
    expect(member.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await member.context.close();
  }
});

test('Explore shows Plans, Ideas or Past; Your calendar ends with Find more events', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Hana'), member = await newLead(browser, 2, 'Milo');
  const H = host.page, M = member.page, idea = uniqueTitle('Idea walk'), plan = uniqueTitle('Plan walk');
  const ids = [];
  try {
    ids.push(await makeEvent(H, { text: idea }));
    ids.push(await makeEvent(H, { text: plan, planned: true, day_date: inDays(4) }));
    await asUser(M, async (c, _C, id) => c.from('rsvps').upsert({ spark_id: id, user_id: (await c.auth.getUser()).data.user.id, status: 'going' }), ids[1]);
    await M.reload();
    await expect(M.locator('html[data-loaded=true]')).toHaveCount(1);

    // Your calendar: the plan, then the green slot, which asks you to start an event (owner, 2026-10-03)
    const yc = M.locator('[data-screen-label="Your calendar"]');
    await expect(yc.locator('[data-plan="' + plan + '"]')).toBeVisible();
    await expect(yc.locator('[data-start-slot]')).toContainText('Start an event');
    await yc.locator('[data-start-slot]').click();
    const kind = M.getByRole('dialog', { name: 'Real or test?' });   // Start an event opens on Real or test?
    await expect(kind).toBeVisible();
    await kind.getByRole('button', { name: 'Close' }).click();   // closing it leaves the flow
    await expect(M.locator('[data-screen-label="New spark"]')).toHaveCount(0);
    await M.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Explore', exact: true }).click();
    const cal = M.locator('[data-screen-label=Explore]');
    await expect(cal.getByRole('heading', { name: 'Explore' })).toBeVisible();

    // Plans (the default) · Ideas · Past
    await expect(cal.locator('[data-plan="' + plan + '"]')).toBeVisible();
    await cal.getByRole('button', { name: 'Show: Plans' }).click();
    await expect(M.getByRole('menu', { name: 'Show' }).getByRole('menuitemradio')).toHaveText([/^Plans\d+$/, /^Ideas\d+$/, /^Past\d+$/]);
    await M.getByRole('menu', { name: 'Show' }).getByRole('menuitemradio', { name: /^Ideas/ }).click();
    await expect(cal.locator('[data-plan="' + idea + '"]')).toContainText('Idea');
    await expect(cal.locator('[data-plan="' + plan + '"]')).toHaveCount(0);
    await expect(cal.getByLabel(/needs? help$/)).toHaveCount(0);   // the discovery card is only on Plans
    await cal.getByRole('button', { name: 'Show: Ideas' }).click();
    await M.getByRole('menu', { name: 'Show' }).getByRole('menuitemradio', { name: /^Past/ }).click();
    await expect(cal.locator('[data-plan="' + idea + '"]')).toHaveCount(0);
    await cal.getByRole('button', { name: 'Show: Past' }).click();
    await M.getByRole('menu', { name: 'Show' }).getByRole('menuitemradio', { name: /^Plans/ }).click();
    await expect(cal.locator('[data-plan="' + plan + '"]')).toBeVisible();
    expect(member.errors).toEqual([]);
  } finally {
    for (const id of ids) if (id && /^[0-9a-f-]{36}$/.test(id)) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await member.context.close();
  }
});
