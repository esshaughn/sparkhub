// Store safety (Design v8-18 item 1s, 20261124000000_store_safety.sql): reporting and blocking from a comment, the
// member's ⋯ on an event, a group's Reports inbox, Delete my account end to end, and a guest's Remove my sign-ups.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, newMember, newAccount, emailCode, postEvent, openIdea, deleteIdea, asUser, donePlus, rsvpTap, openProfile, answerGuestPrompt } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

test('a comment: report it (and undo), block its writer (and show it), then unblock in Settings', async ({ browser }) => {
  test.setTimeout(150000);
  const host = await newLead(browser, 1, 'Hope');
  const member = await newLead(browser, 2, 'Omar');
  const H = host.page, O = member.page;
  let id;
  try {
    id = await postEvent(H, { title: uniqueTitle('Porch report'), date: inDays(6), time: '18:00' });
    await openIdea(O, id);
    const OP = O.locator('[data-screen-label="Plan page"]'), od = OP.locator('[data-discussion]');
    await rsvpTap(OP.locator('[data-rsvp]'), 'Going');
    await donePlus(O);
    await od.getByLabel('Write a comment').fill('Selling raffle tickets, DM me');
    await od.getByLabel('Write a comment').press('Enter');
    await expect(od.locator('[data-comment]')).toHaveText(['Selling raffle tickets, DM me']);
    await expect(od.locator('[data-comment-more]')).toHaveCount(0);   // never on your own comment

    // Hope: ⋯ → Report comment → What's wrong? (Send report grey until a reason) → Thanks → folded, Undo brings it back
    await H.reload();
    const hd = H.locator('[data-screen-label="Plan page"] [data-discussion]');
    await hd.locator('[data-post-row="cmt"] [data-comment-more]').click();
    const menu = H.getByRole('dialog', { name: 'Omar’s comment' });
    await menu.locator('[data-sf-row="report"]').click();
    const rep = H.getByRole('dialog', { name: 'What’s wrong?' });
    await expect(rep).toContainText('Omar’s comment');
    await expect(rep.locator('[data-sf-send]')).toHaveAttribute('aria-disabled', 'true');
    await rep.locator('[data-sf-reason="Spam"]').click();
    await rep.getByLabel('Note').fill('Not what this is for');
    await rep.locator('[data-sf-send]').click();
    const sent = H.getByRole('dialog', { name: 'Thanks for telling us' });
    await expect(sent).toContainText('A group lead will look at this, and we review reports within 48 hours.');
    await sent.locator('[data-sf-done]').click();
    await expect(hd.locator('[data-sf-fold="reported"]')).toContainText('You reported this');
    await expect(hd.locator('[data-comment]')).toHaveCount(0);
    const cid = await asUser(H, async (c, _C, id) => (await c.from('event_comments').select('id').eq('spark_id', id).single()).data.id, id);
    const mine = () => asUser(H, async (c, _C, cid) => (await c.rpc('my_safety')).data.reports.filter(r => r.target === cid).length, cid);
    expect(await mine()).toBe(1);
    await hd.locator('[data-sf-fold-act]').click();   // Undo
    await expect(hd.locator('[data-comment]')).toHaveText(['Selling raffle tickets, DM me']);
    await expect.poll(mine).toBe(0);

    // Block Omar: a red Block; his comment folds to "Comment from someone you blocked · Show"
    await hd.locator('[data-post-row="cmt"] [data-comment-more]').click();
    await H.getByRole('dialog', { name: 'Omar’s comment' }).locator('[data-sf-row="block"]').click();
    const blk = H.getByRole('dialog', { name: 'Block' });
    await expect(blk).toContainText('Block Omar?');
    await blk.locator('[data-sf-block-go]').click();
    await expect(H.getByText('Blocked Omar')).toBeVisible();
    await expect(hd.locator('[data-sf-fold="blocked"]')).toContainText('Comment from someone you blocked');
    await hd.locator('[data-sf-fold-act]').click();   // Show
    await expect(hd.locator('[data-comment]')).toHaveText(['Selling raffle tickets, DM me']);

    // Settings → Blocked people → Unblock
    await openProfile(H);
    await H.locator('[data-me-settings]').click();
    await H.getByRole('dialog', { name: 'Settings' }).locator('[data-blocked-people]').click();
    const page = H.getByRole('dialog', { name: 'Blocked people' });
    await expect(page.locator('[data-blocked-person="Omar"]')).toBeVisible();
    await page.locator('[data-unblock]').click();
    await expect(H.getByText('Unblocked Omar')).toBeVisible();
    await expect(page.locator('[data-sf-none]')).toHaveText('No one yet.');
    await expect.poll(() => asUser(H, async (c) => (await c.rpc('my_safety')).data.blocks.filter(b => b.name === 'Omar').length)).toBe(0);
    // Not the app owner: no All reports row
    await page.getByRole('button', { name: 'Back' }).click();
    expect(host.errors).toEqual([]);
    expect(member.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await asUser(H, async (c, _C, who) => c.rpc('unblock_user', { p_user: who }), await asUser(O, async (c) => (await c.auth.getUser()).data.user.id)).catch(() => {});
    await host.context.close();
    await member.context.close();
  }
});

test('an event: members get ⋯ (Share link · Report this event), and the group’s Reports inbox acts on it', async ({ browser }) => {
  test.setTimeout(150000);
  const owner = await newLead(browser, 1, 'Olive');
  const member = await newLead(browser, 2, 'Mo');
  const W = owner.page, M = member.page;
  const name = '[E2E] Reports ' + Date.now().toString(36);
  let gid, id;
  try {
    // Mo starts a group and posts in it; Olive joins (and is a member there, so sees ⋯, not the host tools)
    const g = await asUser(M, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], name);
    gid = g.id;
    await asUser(W, async (c, _C, code) => c.rpc('join_group', { p_code: code }), g.code);
    id = await asUser(M, async (c, _C, { gid, title, day }) => { const me = (await c.auth.getUser()).data.user.id; return (await c.from('sparks').insert({ lead_id: me, created_by: me, group_id: gid, text: title, author_name: 'Mo', lead_name: 'Mo', planned: true, day_date: day, visibility: 'group' }).select('id').single()).data.id; },
      { gid, title: uniqueTitle('Loud party'), day: inDays(5) });
    // Olive's report on Mo's event: Mo owns the group, so it skips the group's inbox (it goes to All reports)
    await openIdea(W, id);
    const WP = W.locator('[data-screen-label="Plan page"]');
    await WP.locator('[data-ev-menu]').click();
    await expect(WP.locator('[data-ev-menu-list]')).toContainText('Share link');
    await WP.locator('[data-report-event]').click();
    const rep = W.getByRole('dialog', { name: 'What’s wrong?' });
    await expect(rep).toContainText('This event');
    await rep.locator('[data-sf-reason="Unsafe"]').click();
    await rep.locator('[data-sf-send]').click();
    await W.getByRole('dialog', { name: 'Thanks for telling us' }).locator('[data-sf-done]').click();
    expect(await asUser(W, async (c, _C, id) => (await c.rpc('my_safety')).data.reports.some(r => r.kind === 'event' && r.target === id), id)).toBe(true);
    // A report about a member's comment does reach the group's inbox (made directly: the comment's own UI is tested above)
    const cid = await asUser(W, async (c, _C, id) => {
      await c.from('rsvps').upsert({ spark_id: id, user_id: (await c.auth.getUser()).data.user.id, status: 'going' });   // Going, to comment
      const r = await c.from('event_comments').insert({ spark_id: id, body: 'Party at my place, bring cash' }).select('id').single();
      return r.error ? r.error.message : r.data.id; }, id);
    expect(cid).toMatch(/^[0-9a-f-]{36}$/);
    await asUser(M, async (c, _C, cid) => c.rpc('report_content', { p_kind: 'comment', p_target: cid, p_reason: 'Spam' }), cid);

    // Mo owns the group: Group ⋯ → Reports (1, red) → Dismiss
    await M.goto('/'); await M.reload();
    await M.getByRole('button', { name: 'Groups', exact: true }).click();
    await M.locator('[data-screen-label=Groups]').getByRole('button', { name, exact: true }).click();
    await M.locator('[data-screen-label=Browse]').getByRole('button', { name: 'Group options' }).click();
    const gm = M.getByRole('dialog', { name: 'Group options' });
    await expect(gm.locator('[data-reports-count]')).toHaveText('1');
    await gm.locator('[data-group-reports]').click();
    const inbox = M.getByRole('dialog', { name: 'Reports · ' + name });
    const row = inbox.locator('[data-report-row="comment"]');
    await expect(row).toContainText(/Comment by .+ on .*Loud party/);
    await expect(row).toContainText('“Party at my place, bring cash”');
    await expect(row).toContainText('Spam');
    await expect(inbox.locator('[data-report-row="event"]')).toHaveCount(0);   // the one about Mo isn't his to judge
    await expect(row.locator('[data-report-act]')).toHaveText(['Dismiss', 'Remove content', 'Remove member', 'Block']);
    await row.locator('[data-report-act="remove"]').click();
    await expect(M.getByText('Removed. We told the person who posted it.')).toBeVisible();
    expect(await asUser(M, async (c, _C, cid) => (await c.from('event_comments').select('id').eq('id', cid)).data.length, cid)).toBe(0);
    await expect(inbox.locator('[data-reports-none]')).toHaveText('Nothing to look at. Nice.');
    expect(owner.errors).toEqual([]);
    expect(member.errors).toEqual([]);
  } finally {
    if (id) await asUser(W, async (c, _C, id) => c.rpc('withdraw_report', { p_kind: 'event', p_target: id }), id).catch(() => {});
    if (id) await asUser(M, async (c, _C, id) => c.rpc('delete_event', { p_spark: id, p_quiet: true }), id).catch(() => {});
    if (gid) await asUser(M, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), gid).catch(() => {});
    await owner.context.close();
    await member.context.close();
  }
});

test('Delete my account: hand on the group, cancel an event, enter the emailed code, done', async ({ browser }) => {
  test.skip(process.env.E2E_DB !== 'local', 'needs the local Supabase (a throwaway account and its email code)');
  test.setTimeout(150000);
  const leaver = await newAccount(browser, 'Lee');
  const heir = await newLead(browser, 2, 'Hal');
  const L = leaver.page, H = heir.page;
  const name = '[E2E] Leaving ' + Date.now().toString(36);
  let gid;
  try {
    const g = await asUser(L, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], name);
    gid = g.id;
    await asUser(H, async (c, _C, code) => c.rpc('join_group', { p_code: code }), g.code);
    const evId = await asUser(L, async (c, _C, { gid, title, day }) => { const me = (await c.auth.getUser()).data.user.id; return (await c.from('sparks').insert({ lead_id: me, created_by: me, group_id: gid, text: title, author_name: 'Lee', lead_name: 'Lee', planned: true, day_date: day, visibility: 'group' }).select('id').single()).data.id; },
      { gid, title: uniqueTitle('Lee’s walk'), day: inDays(4) });
    // The app asks Auth to email a code; there's no inbox here, so the request is answered and the code read from the admin API
    await L.route('**/auth/v1/otp*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await L.reload();
    await openProfile(L);
    await L.locator('[data-me-settings]').click();
    await L.getByRole('dialog', { name: 'Settings' }).locator('[data-delete-account]').click();
    await L.getByRole('dialog', { name: 'Delete account' }).locator('[data-del-continue]').click();
    // The group Lee owns alone: Hal is the one to hand it to
    const gp = L.getByRole('dialog', { name });
    await expect(gp).toContainText('You’re the only owner of ' + name + '. Who should have it?');
    await expect(gp.locator('[data-hand-to="Hal"]')).toHaveAttribute('aria-checked', 'true');
    await gp.locator('[data-hand-go]').click();
    // The event Lee leads: Cancel it
    const ev = L.getByRole('dialog', { name: 'Your events' });
    await expect(ev.locator('[data-del-event]')).toContainText('Lee’s walk');
    await ev.locator('[data-ev-cancel]').click();
    await ev.locator('[data-del-events-next]').click();
    const code = L.getByRole('dialog', { name: 'Check your email' });
    await expect(code).toContainText('We sent a 6-digit code to e•••@example.com');
    await expect(code.locator('[data-del-go]')).toHaveAttribute('aria-disabled', 'true');
    await code.getByLabel('6-digit code').fill(await emailCode(leaver.email));
    await code.locator('[data-del-go]').click();
    await expect(L.locator('[data-del-done]')).toContainText('Your account is deleted');
    await L.locator('[data-del-close]').click();
    // Hal owns the group now, and the event was cancelled
    expect(await asUser(H, async (c, _C, gid) => (await c.rpc('group_people', { p_group: gid })).data.map(p => p.role), gid)).toEqual(['owner']);
    expect(await asUser(H, async (c, _C, id) => !!(await c.from('sparks').select('cancelled_at').eq('id', id).single()).data.cancelled_at, evId)).toBe(true);
    // (signing out of an account that no longer exists: Auth answers the sign-out with 403)
    expect(leaver.errors.filter(e => !/status of 403/.test(e))).toEqual([]);
  } finally {
    if (gid) await asUser(H, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), gid).catch(() => {});
    await leaver.context.close();
    await heir.context.close();
  }
});

test('a guest takes their sign-ups back off with Remove my sign-ups', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Hope');
  const H = host.page;
  let id;
  const visitor = await newMember(browser);
  try {
    id = await postEvent(H, { title: uniqueTitle('Guest walk'), date: inDays(7), time: '09:00' });
    const V = visitor.page;
    await V.goto('/#/idea/' + id);
    await rsvpTap(V.locator('[data-screen-label="Plan page"] [data-rsvp]'), 'Going');
    await answerGuestPrompt(V, 'Vic');
    const listed = V.getByRole('dialog', { name: 'You’re on the list' });
    await listed.locator('[data-remove-signups]').click();
    const sure = V.getByRole('alertdialog');
    await expect(sure).toContainText('Remove your sign-ups?');
    await expect(sure).toContainText('We’ll take your name off the RSVP and any spots, and delete your name and contact.');
    await sure.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(V.getByText('Removed. The hosts no longer see your name or contact.')).toBeVisible();
    expect(await asUser(H, async (c, _C, id) => (await c.from('guest_contacts').select('name').eq('spark_id', id)).data.length, id)).toBe(0);
    expect(await asUser(H, async (c, _C, id) => (await c.from('rsvps').select('user_id').eq('spark_id', id)).data.length, id)).toBe(1);   // the lead only
    expect(visitor.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await visitor.context.close();
    await host.context.close();
  }
});
