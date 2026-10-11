// Design round v8-21 (2026-10-10): the Get started banner and the Join a group pop-up, Anything to change for next time?
// on a past event (and LAST TIME in Plan an event), the Privacy slide-up, Me without the About line or the feedback card,
// Delete it for good on an Idea, and the lead's job rows on My tasks.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, newAccount, openIdea, deleteIdea, asUser, startPost, openProfile, saved } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('Get started: join with a code, the four steps tick, × hides it everywhere', async ({ browser }) => {
  test.skip(process.env.E2E_DB !== 'local', 'needs the local Supabase (a brand-new account)');
  test.setTimeout(120000);
  const gia = await newAccount(browser, 'Gia');
  const page = gia.page;
  try {
    // Not in a group yet: no banner. Join a group (8b) checks the code as it's typed and names the group
    await expect(page.locator('[data-get-started]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Join with a code' }).click();
    const join = page.getByRole('dialog', { name: 'Join a group' });
    await expect(join).toContainText('Paste the invite link or code someone sent you.');
    await expect(join.getByRole('button', { name: 'Join', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await join.getByLabel('Invite link or code').fill('https://sparkhub.wereallneighbors.org/join/TORREZ');
    await expect(join.locator('[data-join-found]')).toContainText('Torrez Fitness');
    await expect(join.locator('[data-join-found]')).toContainText('members');
    await join.getByRole('button', { name: 'Join Torrez Fitness' }).click();
    await expect(join).toHaveCount(0);
    await saved(page);
    // Welcome to Torrez Fitness, Gia (v8-22 4a)
    await page.locator('[data-screen-label="Welcome to the group"]').getByRole('button', { name: 'Go to My calendar' }).click();

    // In a group now: the banner, with Join a group already ticked (1 of 4: Install Spark Hub app first, no profile step, v8-23)
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
    const gs = page.locator('[data-screen-label="Your calendar"] [data-get-started]');
    await expect(gs).toContainText('Get started');
    await expect(gs.locator('[data-gs-count]')).toHaveText('1 of 4');
    await expect(gs.locator('[data-gs-step]')).toHaveCount(0);   // closed
    await gs.locator('[data-gs-toggle]').click();
    await expect(gs.locator('[data-gs-step]')).toHaveCount(4);
    await expect(gs.locator('[data-gs-step]').first()).toHaveAttribute('data-gs-step', 'app');
    await expect(gs.locator('[data-gs-step="join"]')).toHaveAttribute('data-done', '');

    // Install Spark Hub app (v8-23 1c, Android Chrome on the Pixel): one Install button; Chrome's appinstalled ticks it
    await gs.locator('[data-gs-step="app"]').click();
    const a2 = page.getByRole('dialog', { name: 'Install Spark Hub' });
    await expect(a2).toContainText('Install Spark Hub on your phone’s home screen');
    await expect(a2.locator('[data-a2hs="android-chrome"]')).toHaveCount(1);
    await expect(a2.getByRole('button', { name: 'Install' })).toBeVisible();
    await a2.getByRole('button', { name: 'Close' }).click();
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await expect(gs.locator('[data-gs-count]')).toHaveText('2 of 4');
    await expect(gs.locator('[data-gs-step="app"]')).toHaveAttribute('data-done', '');

    // A new account's first opens: the short line under My calendar's title (v8-24 item 1); × hides it for good
    const calDesc = page.locator('[data-head-desc="cal"]');
    await expect(calDesc).toContainText('Everything you’re going to, leading or helping with.');
    await calDesc.getByRole('button', { name: 'Hide this' }).click();
    await expect(calDesc).toHaveCount(0);

    // Float your first Idea goes to the Ideas tab and opens the Float sheet
    await gs.locator('[data-gs-step="idea"]').click();
    await expect(page.getByRole('dialog', { name: 'Float an Idea' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Float an Idea' }).getByRole('button', { name: 'Close' }).first().click();
    await expect(page.locator('[data-head-desc="ideas"]')).toContainText('Things people want to do. Pitch in to make them a Plan.');   // each page its own

    // Me: the banner above everything under the header, and Your impact hidden while it shows
    await openProfile(page);
    const me = page.locator('[data-screen-label="Me"]');
    await expect(me.locator('[data-get-started]')).toBeVisible();
    await expect(me.locator('[data-impact]')).toHaveCount(0);
    // × hides it for good, on every screen; Your impact stays hidden until Me is opened again
    await me.locator('[data-gs-x]').click();
    await expect(page.locator('[data-get-started]')).toHaveCount(0);
    await expect(me.locator('[data-impact]')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
    await expect(page.locator('[data-get-started]')).toHaveCount(0);
    expect(gia.errors).toEqual([]);
  } finally {
    await gia.context.close();
  }
});

test('Anything to change for next time: the lead saves a note, and Plan an event shows it as LAST TIME', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Hope');
  const H = host.page, title = uniqueTitle('Bocce evening');
  let past;
  try {
    past = await asUser(H, async (c, _C, { title, day }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert({ group_id: g, author_name: 'Hope', lead_name: 'Hope', lead_id: me, created_by: me, text: title, planned: true, day_date: day, day_time: '18:00', spot: 'Pease Park' }).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, { title, day: inDays(-4) });
    expect(past).toMatch(/^[0-9a-f-]{36}$/);
    await openIdea(H, past);
    const card = H.locator('[data-screen-label="It happened"] [data-next-time]');
    await expect(card).toContainText('Anything to change for next time?');
    await expect(card).toContainText('Only you see this. It shows again when you plan the next one.');
    await expect(card.locator('[data-nt-save]')).toHaveAttribute('aria-disabled', 'true');
    await card.locator('[data-nt-chip="More chairs"]').click();
    await card.locator('[data-nt-chip="Start earlier"]').click();
    await card.getByLabel('Something else').fill('Bring a speaker');
    await card.locator('[data-nt-save]').click();
    await expect(H.getByText('Saved for next time')).toBeVisible();
    await expect(card).toContainText('YOUR NOTE FOR NEXT TIME');
    await expect(card.locator('[data-next-time-note]')).toHaveText('More chairs · Start earlier · Bring a speaker');
    // It's on the account, not just the screen
    await H.reload();
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    await expect(H.locator('[data-next-time-note]')).toHaveText('More chairs · Start earlier · Bring a speaker');

    // Planning the next one: a title with the same word brings up LAST TIME and the note
    await startPost(H, { group: false });
    const flow = H.locator('[data-screen-label="New spark"]');
    await expect(flow.locator('[data-last-time]')).toHaveCount(0);
    await flow.getByLabel('Event title').fill('Bocce at the park');
    const last = flow.locator('[data-last-time]');
    await expect(last).toContainText('LAST TIME · ');
    await expect(last).toContainText(title + ', which you led.');
    await expect(last.locator('[data-last-time-note]')).toHaveText('Your note: More chairs · Start earlier · Bring a speaker');
    expect(host.errors).toEqual([]);
  } finally {
    if (past) await asUser(H, async (c, _C, id) => { await c.from('sparks').delete().eq('id', id); }, past).catch(() => {});
    await host.context.close();
  }
});

test('Settings → Privacy, and Me without the About line or the feedback card', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Hope');
  const page = host.page;
  try {
    await openProfile(page);
    const me = page.locator('[data-screen-label="Me"]');
    await expect(me).not.toContainText('Give Eric feedback');
    await expect(me.locator('[data-me-about]')).toHaveCount(0);
    await expect(me.locator('[data-me-row="Feedback & questions"]')).toBeVisible();
    await page.locator('[data-me-settings]').click();
    const set = page.getByRole('dialog', { name: 'Settings' });
    await set.locator('[data-me-row="Privacy"]').click();
    const priv = page.getByRole('dialog', { name: 'Privacy' });
    await expect(priv).toContainText('Groups are private. Only members see a group’s plans, ideas and people.');
    await expect(priv).toContainText('People see your first name and last initial (Hana M.).');
    await expect(priv.locator('[data-priv-download] [data-request-chip]')).toBeVisible();
    await expect(priv.locator('[data-privacy-policy]')).toHaveAttribute('href', '/privacy');
    // ‹ goes back to Settings; Blocked people opens the existing list
    await priv.getByRole('button', { name: 'Back to Settings' }).click();
    await expect(priv).toHaveCount(0);
    await expect(set).toBeVisible();
    await set.locator('[data-me-row="Privacy"]').click();
    await priv.locator('[data-priv-blocked]').click();
    await expect(priv).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Blocked people' })).toBeVisible();
    expect(host.errors).toEqual([]);
  } finally {
    await host.context.close();
  }
});
