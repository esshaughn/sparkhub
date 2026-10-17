// Design round v9-1 (HANDOFF-to-CODE v9-1): the join moment (2a–2c, Join by code), Starting a group (3a–3e), Place &
// purpose and the Dashboard (4a, 4d), crews (5b) and after the event, joy first (Q57).
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, asUser } = require('./helpers');

// 2b · 2c · Join by code: the Join {group}? pop-up shows the place card and How are you connected?; the rule greys out
// what it doesn't take; if the rule changes before Join, the answer that no longer fits goes inactive with a red line
test('the join moment: Join by code opens Join {group}? with the place and the question; a changed rule says so', async ({ browser }) => {
  const owner = await newLead(browser, 1, 'Ada');
  const other = await newLead(browser, 2, 'Bo');
  const A = owner.page, B = other.page;
  const name = uniqueTitle('join').slice(0, 40);
  let gid;
  try {
    const g = await asUser(A, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], name);
    gid = g.id;
    await asUser(A, async (c, _C, id) => {
      await c.rpc('set_community_place', { p_group: id, p_name: 'Walnut Creek', p_kind: 'neighborhood', p_lat: 30.3925, p_lon: -97.6887, p_radius_m: 800, p_purpose: 'Block parties and park cleanups.' });
      await c.rpc('set_join_rule', { p_group: id, p_rule: 'nearby' });
    }, gid);

    // Join a group → the code → Join {group} opens the pop-up instead of joining straight away
    await B.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    await B.getByRole('button', { name: 'Join or add a group' }).click();
    await B.getByRole('dialog', { name: 'Add a group' }).getByRole('button', { name: 'Join a group' }).click();
    const join = B.getByRole('dialog', { name: 'Join a group' });
    await join.getByLabel('Invite link or code').fill(g.code);
    await join.getByRole('button', { name: 'Join ' + name }).click();
    await expect(join).toHaveCount(0);
    const ask = B.getByRole('dialog', { name: 'Join ' + name + '?' });
    await expect(ask.locator('[data-place-card]')).toContainText('Walnut Creek');
    await expect(ask.locator('[data-place-card]')).toContainText('· Neighborhood');
    await expect(ask.locator('[data-place-ask]')).toHaveText('Is this the one you want to join?');
    await expect(ask).toContainText('How are you connected to Walnut Creek?');
    await expect(ask).toContainText('This group is for people who live here or nearby.');
    await expect(ask.locator('[data-conn=visiting]')).toHaveAttribute('aria-disabled', 'true');
    const go = ask.locator('[data-inv-confirm-join]');
    await expect(go).toHaveText('Join as Bo');
    await expect(go).toHaveAttribute('aria-disabled', 'true');   // grey until a pill is picked
    await ask.locator('[data-conn=nearby]').click();
    await expect(ask.locator('[data-conn=nearby]')).toHaveAttribute('aria-checked', 'true');
    await expect(go).toHaveAttribute('aria-disabled', 'false');

    // 2c: the owner narrows it to neighbors before Bo taps Join
    await asUser(A, async (c, _C, id) => c.rpc('set_join_rule', { p_group: id, p_rule: 'neighbors' }), gid);
    await go.click();
    await expect(ask.locator('[data-rule-changed]')).toHaveText('The group just changed who can join. Nearby isn’t open any more.');
    await expect(ask.locator('[data-conn=nearby]')).toHaveAttribute('aria-disabled', 'true');
    await expect(ask).toContainText('This group is for people who live here.');
    await expect(go).toHaveAttribute('aria-disabled', 'true');
    await ask.locator('[data-conn=here]').click();
    await expect(ask.locator('[data-rule-changed]')).toHaveCount(0);
    await go.click();
    await expect(B.locator('[data-screen-label="Welcome to the group"]')).toContainText('Welcome to ' + name);
    const conn = await asUser(A, async (c, _C, id) => (await c.rpc('group_members', { p_group: id })).data, gid);
    expect(conn.find(m => m.name === 'Bo' || (m.email || '').includes('lead-')) && conn.some(m => m.connection === 'here')).toBe(true);
  } finally {
    if (gid) await asUser(A, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), gid).catch(() => {});
    await owner.context.close();
    await other.context.close();
  }
});

// Q57, after the event, joy first: the past event keeps the event page with joy on top; someone who went shares joy
// (step 1: chips, the lead pre-picked to thank, a moment, I'd come again), then step 2; the page celebrates it; the lead
// sees the thanks in the bell and on Me. #/idea/<id>/photo opens the photo moment
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
test('after the event: share your joy in two steps, How it felt celebrates it, the lead is thanked', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Ada');
  const guest = await newLead(browser, 2, 'Bo');
  const A = host.page, B = guest.page, title = uniqueTitle('Taco night');
  let id;
  try {
    id = await asUser(A, async (c, _C, { title, day }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Ada', lead_name: 'Ada', lead_id: me, created_by: me, text: title, planned: true, day_date: day, day_time: '18:00', spot: 'Pease Park', vision: 'Bring a dish.' }).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, { title, day: inDays(-1) });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const rs = await asUser(B, async (c, _C, sid) => { const me = (await c.auth.getUser()).data.user.id; const r = await c.from('rsvps').insert({ spark_id: sid, user_id: me, status: 'going' }); return r.error ? r.error.message : 'ok'; }, id);
    expect(rs).toBe('ok');

    // Bo opens it: still the event page, joy first
    await B.goto('/#/idea/' + id);
    await expect(B.locator('html[data-loaded=true]')).toHaveCount(1);
    const page = B.locator('[data-screen-label="It happened"]');
    await expect(page).toContainText('It happened!');
    await expect(page.locator('[data-past-expect]')).toContainText('Bring a dish.');
    await expect(page.locator('[data-who-came]')).toContainText('Who came · 2');
    const card = page.locator('[data-joy-card]');
    await expect(card).toContainText('What gave you joy?');
    await card.locator('[data-joy-share]').click();
    const sheet = B.getByRole('dialog', { name: 'Share your joy' });
    await expect(sheet).toContainText('What made ' + title + ' good?');
    await expect(sheet.locator('[data-joy-thank="Ada"]')).toHaveAttribute('aria-checked', 'true');   // the lead, pre-picked
    const next = sheet.locator('[data-joy-next]');
    await expect(next).toHaveText('Tap what gave you joy');
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await sheet.locator('[data-joy-chip="Laughing"]').click();
    await sheet.locator('[data-joy-own]').click();
    await sheet.locator('[data-joy-own-text]').fill('The tacos');
    await sheet.locator('[data-joy-line]').fill('Everyone stayed way longer than planned.');
    await sheet.locator('[data-joy-again-tick]').click();
    await expect(next).toHaveText('Share my joy');
    await next.click();
    // Step 2 opens right after, in the same sheet
    await expect(sheet.locator('[data-joy-unlock]')).toHaveText('Thanks! Ada will see your thanks. One more, if you want.');
    await sheet.locator('[data-joy-could-chip="Bring a friend"]').click();
    await sheet.locator('[data-joy-more-chip="Food after"]').click();
    await sheet.locator('[data-joy-done]').click();
    await expect(B.getByText('Shared. Thank you!'), guest.errors.join(' / ')).toBeVisible();
    await expect(card).toContainText('Thanks for sharing your joy');
    const felt = page.locator('[data-how-felt]');
    await expect(felt.locator('[data-joy-quote]')).toContainText('Everyone stayed way longer than planned.');
    await expect(felt.locator('[data-most-loved]')).toHaveText('Most loved: laughing · the tacos');
    await expect(felt.locator('[data-thanks-given]')).toContainText('Ada · 🙏 1');
    await expect(felt.locator('[data-joy-could]')).toHaveText('Next time: 1 will bring a friend.');
    await expect(felt.locator('[data-joy-wishes]')).toHaveCount(0);   // wishes show from day 2
    await expect(page.locator('[data-joy-again]')).toContainText('1 would come again');

    // The photo moment from its push link
    await B.goto('/#/idea/' + id + '/photo');
    const snap = B.getByRole('dialog', { name: 'Snap a photo' });
    await expect(snap).toContainText('Snap one for the album');
    await expect(snap.locator('[data-photo-tiles]')).toContainText('Yours goes here');
    await snap.getByRole('button', { name: 'Not now' }).click();

    // Ada, the lead: the thanks in the bell and on Me; her own card asks how it felt to lead it
    await A.reload();
    await expect(A.locator('html[data-loaded=true]')).toHaveCount(1);
    await A.goto('/#/idea/' + id);
    await expect(A.locator('[data-joy-card]')).toContainText('How did it feel to lead it?');
    await expect(A.locator('[data-how-felt] [data-joy-quote]')).toContainText('Everyone stayed way longer than planned.');
    await A.goto('/#/me');
    await expect(A.locator('[data-me-thanks]')).toContainText('Thanks you’ve had');
    await A.locator('[data-me-thanks]').click();
    await expect(A.locator('[data-notif=thanks]').first()).toContainText('Bo thanked you for leading ' + title + ' 🙏');
  } finally {
    if (id) await asUser(A, async (c, _C, sid) => { await c.from('sparks').delete().eq('id', sid); }, id).catch(() => {});
    await host.context.close(); await guest.context.close();
  }
});
