// v6: Your tasks (Leading / Helping, to-dos, stats strip, View all), Your schedule (strips that expand),
// the community Calendar (filters, search, Could use a hand, Month), the "You're on it" banner,
// and Profile / Notifications as sheets.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, postEvent, openIdea, deleteIdea, pickView, asUser, addJob, openAllGroups, openTasks, rsvpTap, rsvpBar } = require('./helpers');

// Local dates, like the app (toISOString would be UTC, a day ahead in the evening)
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// SHOTS=dir saves screenshots of each state (for design reviews); off in CI
const shot = async (page, name) => { if (process.env.SHOTS) await page.screenshot({ path: require('path').join(process.env.SHOTS, name + '.png') }); };

test('v6: Your tasks, Your schedule, the community Calendar and the RSVP ask', async ({ browser }) => {
  test.setTimeout(180000);
  const host = await newLead(browser, 1, 'Hope');
  const helper = await newLead(browser, 2, 'Hal');
  const H = host.page, O = helper.page;
  const nav = (p) => p.getByRole('navigation', { name: 'Main' });
  const title = uniqueTitle('Porch jam');
  let id;
  try {
    // Signed in, the app opens on Your calendar; the tab bar is Update 16's five (owner, 2026-10-03)
    await expect(H.locator('[data-screen-label="Your calendar"]')).toBeVisible();
    await expect(H.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav(H).getByRole('button')).toHaveCount(5);
    // (Ideas may read "Ideas, new ideas" with its gold dot, Design v8 prototype)
    for (const name of ['Groups', 'Friends', 'Calendar', /^Ideas/, 'Me']) await expect(nav(H).getByRole('button', typeof name === 'string' ? { name, exact: true } : { name })).toBeVisible();
    // Every tab has its word under the icon (Design pick 2a, 2026-10-04)
    await expect(nav(H)).toHaveText(/Groups\s*Friends\s*Calendar\s*Ideas\s*Me/);   // Tasks moved under Me (v8-4)
    // The floating + (v8-5, 17d) turns into a dark × with Create a plan and Float an idea; the scrim closes it
    const fab = H.locator('[data-add-fab]');
    await fab.click();
    await expect(fab).toHaveAttribute('aria-expanded', 'true');
    await expect(H.locator('[data-plus-plan]')).toHaveText('Create a Plan');
    await expect(H.locator('[data-plus-float]')).toHaveText('Float an Idea');
    await H.locator('[data-screen-label="Plus menu"]').click({ position: { x: 20, y: 200 } });
    await expect(H.locator('[data-plus-plan]')).toHaveCount(0);
    await fab.click();
    await H.locator('[data-plus-plan]').click();   // Plan an event; nothing typed, so X just leaves
    await H.locator('[data-screen-label="New spark"]').getByRole('button', { name: 'Close' }).click();
    await expect(H.locator('[data-screen-label="Your calendar"]')).toBeVisible();

    // Hope posts an event for today with no location, then adds sign-ups (one with a time)
    id = await postEvent(H, { title, date: inDays(0), time: '23:30' });
    const HP = H.locator('[data-screen-label="Plan page"]');
    for (const [item, need, time] of [['Folding chairs', '2', '23:00'], ['Ice', '1', '']]) {
      await addJob(H, { item, need: +need, time });
      await expect(HP.locator('[data-signup="' + item + '"]')).toBeVisible();
    }

    // Her My tasks (v8 6h): grouped by event, a date line, the event with its purple bar, then its rows. A job to fill
    // reads NEED, the job and its open spots, with Ask right there; Location TBD is a row with Add it
    await openTasks(H);
    const tasks = H.locator('[data-screen-label="Your tasks"]');
    const lead = tasks.locator('[data-task="' + title + '"]');
    await expect(lead).toContainText('Today');
    await expect(tasks.getByRole('heading', { name: 'My tasks' })).toBeVisible();
    await expect(tasks.locator('[data-tk-chip]')).toHaveText([/^All\d+$/, /^Leading\d+$/, /^Helping\d+$/, /^Ideas\d+$/]);
    // My tasks has Search beside the bell (the events search sheet, over the screen)
    await tasks.getByRole('button', { name: 'Search events' }).click();
    const hSearch = H.getByRole('dialog', { name: 'Search' });
    await hSearch.getByLabel('Search events').fill(title.slice(-12));
    await expect(hSearch.locator('[data-result="' + title + '"]')).toBeVisible();
    await hSearch.getByRole('button', { name: 'Cancel' }).click();
    await expect(hSearch).toHaveCount(0);
    await expect(lead).not.toContainText('Post an update');
    await expect(lead).toContainText('Location TBD');
    await expect(lead).toContainText('NEED  Folding chairs (2)');
    await expect(lead).toContainText('NEED  Ice (1)');
    await lead.locator('[data-todo-cta]', { hasText: 'Ask' }).first().click();
    const askSheet = H.getByRole('dialog', { name: 'Ask someone to take it' });
    await expect(askSheet).toContainText('Ask someone to take “Folding chairs”');
    await askSheet.getByRole('button', { name: 'Close' }).click();
    await expect(tasks).toBeVisible();   // the ask opens right on My tasks
    await shot(H, '01-your-tasks-lead');
    await expect(H.getByRole('dialog', { name: 'My tasks' }).getByRole('button', { name: 'Close' })).toBeVisible();   // a slide-up over Me since v8-9
    // Condensed (6j): one card, the event as a small header, the same rows; the switch is remembered
    await tasks.getByRole('tab', { name: 'Condensed' }).click();
    await expect(tasks.locator('[data-task="' + title + '"]')).toBeVisible();
    await expect(tasks).toContainText('Folding chairs');
    await H.reload();
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    await openTasks(H);   // the slide-up doesn't survive a reload; the view does
    await expect(tasks.getByRole('tab', { name: 'Condensed' })).toHaveAttribute('aria-selected', 'true');
    await tasks.getByRole('tab', { name: 'Timeline' }).click();
    // Each chip narrows the list; Ideas has its own empty card
    await tasks.locator('[data-tk-chip="Ideas"]').click();
    await expect(lead).toHaveCount(0);
    await tasks.locator('[data-tk-chip="All"]').click();
    await expect(lead).toBeVisible();

    // Hal finds it on the Calendar: not joined, so RSVP (no going count, and a job isn't a spot: Design v8-17)
    await O.reload();
    await openAllGroups(O);
    const cal = O.locator('[data-screen-label="All groups"]');
    await expect(cal.getByRole('heading', { name: 'All groups' })).toBeVisible();
    const card = cal.locator('[data-plan="' + title + '"]');
    await expect(card).not.toContainText('spots left');
    await expect(card).toContainText('RSVP');
    await shot(O, '03-calendar');
    // Tapping it opens its page (v8-7: no event preview any more), and Back comes back here
    await card.click();
    await expect(O.getByRole('dialog', { name: 'Event preview' })).toHaveCount(0);
    await O.locator('[data-screen-label="Plan page"]').getByRole('button', { name: 'Back to All groups' }).click();
    await expect(cal.getByRole('heading', { name: 'All groups' })).toBeVisible();

    // No Type filter (owner, 2026-10-02: nothing sets an event's type any more)
    await expect(cal.getByRole('button', { name: /^Type of event:/ })).toHaveCount(0);

    // Search finds it; a result opens the plan
    await cal.getByRole('button', { name: 'Search events' }).click();
    const search = O.getByRole('dialog', { name: 'Search' });
    // Before typing: Try chips and "Or something unexpected" (Update 2)
    await expect(search.getByText('Try', { exact: true })).toBeVisible();
    await expect(search.getByText('Or something unexpected')).toBeVisible();
    await expect(search.locator('[data-magic]')).toHaveCount(3);   // three real ones (owner, 2026-09-30)
    await search.getByRole('button', { name: 'Needs help', exact: true }).click();
    await expect(search.locator('[data-result="' + title + '"]')).toBeVisible();   // it has open sign-ups
    await search.getByRole('button', { name: 'Clear Needs help' }).click();
    await expect(search.locator('[data-magic]')).toHaveCount(3);   // three real ones (owner, 2026-09-30)
    await search.getByLabel('Search events').fill(title.slice(-12));
    await expect(search.locator('[data-result="' + title + '"]')).toBeVisible();
    await shot(O, '04-search');
    await search.locator('[data-result="' + title + '"]').click();
    const OP = O.locator('[data-screen-label="Plan page"]');
    await expect(OP).toBeVisible();

    // v6 Update 5: signing up is one tap and a "You're on it" banner, no RSVP question; he says Maybe himself
    await OP.locator('[data-signup="Ice"]').getByRole('button', { name: 'Sign up' }).click();
    await expect(O.locator('[data-banner="on"]')).toContainText('You’re signed up!');
    await expect(rsvpBar(OP.locator('[data-rsvp]'), 'going')).toBeVisible();   // taking a job marks you Going
    await expect(O.getByRole('dialog', { name: 'Will you be there?' })).toHaveCount(0);
    await shot(O, '05-on-it');
    await O.locator('[data-onit-done]').click();
    await rsvpTap(OP.locator('[data-rsvp]'), 'Maybe');
    await expect(O.getByText('Marked as maybe')).toBeVisible();

    // His Your tasks: a Helping card with just "You said Maybe" (it's in the last 3 days) and his sign-up
    await openTasks(O);
    const help = O.locator('[data-screen-label="Your tasks"] [data-task="' + title + '"]');
    await expect(help).toContainText('You said Maybe');
    await expect(help).toContainText('Update RSVP');
    await expect(help).toContainText('Ice');
    await expect(help).not.toContainText('more');
    await expect(help).not.toContainText('Location');
    await shot(O, '06-your-tasks-help');

    // Your schedule (Tiles): Helping strip, "2 tasks" expands in place; Up next has the same strip
    await O.getByRole('dialog', { name: 'My tasks' }).getByRole('button', { name: 'Close' }).click();   // the slide-up covers the tab bar (v8-9)
    await nav(O).getByRole('button', { name: 'Calendar', exact: true }).click();
    const sched = O.locator('[data-screen-label="Your calendar"]');
    await pickView(sched, 'Tiles');
    const tile = sched.locator('[data-plan="' + title + '"]');
    await expect(tile).toContainText('Helping');
    await tile.getByText('2 tasks').click();
    await expect(tile).toContainText('You said Maybe');
    await expect(tile).toContainText('Ice');
    await pickView(sched, 'Up next');
    await expect(tile).toContainText('Helping');
    // Up next's strip folds the same way (Design 27): open here (it's today, and he opened it above), a tap shows the count
    await expect(tile).toContainText('Ice');
    await tile.getByText('Helping', { exact: true }).click();
    await expect(tile).toContainText('2 tasks');
    await expect(tile).not.toContainText('Ice');
    await shot(O, '07-your-schedule-up-next');

    // Could use a hand: claim the chairs; "You're on it", and no RSVP question
    await openAllGroups(O);
    await cal.getByRole('button', { name: /^\d+ events? needs? help$/ }).click();
    const hand = O.getByRole('dialog', { name: 'Needs help' });
    const row = hand.locator('[data-hand="' + title + '"] [data-signup="Folding chairs"]');
    await expect(row).toContainText('2 of 2 open');
    await shot(O, '08-could-use-a-hand');
    await row.getByRole('button', { name: 'Sign up' }).click();
    await expect(O.locator('[data-banner="on"]')).toContainText('You’re signed up!');
    await O.locator('[data-onit-done]').click();
    await expect(row).toContainText('Yours');
    await expect(O.getByRole('dialog', { name: 'Confirm your RSVP' })).toHaveCount(0);
    await hand.getByRole('button', { name: 'Close' }).click();

    // Month view: the day's events under the grid
    await pickView(cal, 'Month');
    await expect(cal.getByRole('button', { name: 'Next month' })).toBeVisible();
    await expect(cal.locator('[data-plan="' + title + '"]')).toBeVisible();
    await shot(O, '09-month');
    await pickView(cal, 'List');
    // The group page has a Month view too (owner, 2026-09-30)
    await nav(O).getByRole('button', { name: 'Groups', exact: true }).click();
    await O.locator('[data-screen-label=Groups]').getByRole('button', { name: 'Torrez Fitness', exact: true }).click();
    const gp = O.locator('[data-screen-label=Browse]');
    await pickView(gp, 'Month');
    await expect(gp.getByRole('button', { name: 'Next month' })).toBeVisible();
    await expect(gp.locator('[data-plan="' + title + '"]')).toBeVisible();
    await pickView(gp, 'Tiles');
    await openAllGroups(O);

    // Me is a tab (v8); Notifications is a sheet
    await nav(O).getByRole('button', { name: 'Me', exact: true }).click();
    const prof = O.locator('[data-screen-label="Me"]');
    await expect(prof.getByRole('button', { name: 'Edit profile' })).toBeVisible();
    await expect(prof.locator('[data-impact]')).toContainText(/[1-9]\d* helped/);
    await shot(O, '10-me');
    await openAllGroups(O);
    await cal.getByRole('button', { name: /^Notifications/ }).click();
    const notifs = O.getByRole('dialog', { name: 'Notifications' });
    await expect(notifs.getByRole('radio', { name: 'All' })).toBeVisible();
    await shot(O, '11-notifications-sheet');
    await notifs.getByRole('button', { name: 'Close' }).click();
    await expect(notifs).toHaveCount(0);

    // Hope's card: claiming the chairs made Hal Going again, though he'd said Maybe (taking a job means you're coming,
    // whatever you'd said: owner, 2026-09-30, confirmed 2026-10-03), and the chairs are half covered
    await H.reload();
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    await openTasks(H);
    await expect(lead).toContainText('NEED  Folding chairs (1)');   // Hal took Ice and one of the chairs
    await expect(lead).not.toContainText('Ice (');

    expect(host.errors).toEqual([]);
    expect(helper.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await helper.context.close();
  }
});

// v6 Update 2: a group's Past scrapbook — the recap, a memory card, reactions and "Let's do it again!"
test('v6 update 2: the Past scrapbook and reactions', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await newLead(browser, 1, 'Hope');
  const guest = await newLead(browser, 2, 'Hal');
  const H = host.page, O = guest.page;
  const title = uniqueTitle('Porch supper');
  let id;
  try {
    // Hope's plan, moved to yesterday so it's in the past
    id = await postEvent(H, { title, date: inDays(3), time: '18:00' });
    const moved = await asUser(H, async (c, _C, { id, day }) => { const r = await c.from('sparks').update({ day_date: day }).eq('id', id); return r.error ? r.error.message : 'ok'; }, { id, day: inDays(-1) });
    expect(moved).toBe('ok');

    // Hal: Groups → Torrez Fitness → Past
    await O.reload();
    await O.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
    await O.locator('[data-screen-label=Groups]').getByRole('button', { name: 'Torrez Fitness', exact: true }).click();
    const browse = O.locator('[data-screen-label=Browse]');
    await browse.getByRole('tab', { name: /^Past/ }).click();
    await expect(browse).toContainText('TORREZ FITNESS · SO FAR');
    const card = browse.locator('[data-card="' + title + '"]');
    await expect(card).toContainText('said yes!');   // Going RSVPs, not a head count
    await expect(browse).toContainText('said yes');
    await expect(browse.locator('[data-sticker]').first()).toBeVisible();      // the date sticker above each memory
    await expect(card).toContainText('MADE IT HAPPEN');
    await expect(card).toContainText('Hope');

    // A reaction counts and shows as his; tapping again takes it back
    await card.getByRole('button', { name: 'Love it, 0' }).click();
    await expect(card.getByRole('button', { name: 'Love it, 1' })).toHaveAttribute('aria-pressed', 'true');
    await shot(O, '05-past-scrapbook');
    await card.getByRole('button', { name: 'Love it, 1' }).click();
    await expect(card.getByRole('button', { name: 'Love it, 0' })).toHaveAttribute('aria-pressed', 'false');

    // "Let's do it again!" counts once
    await card.getByRole('button', { name: 'Let’s do it again, 0' }).click();
    await expect(O.getByText('Counted! Hope will see you want it again.')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Let’s do it again, 1' })).toBeVisible();
    await card.getByRole('button', { name: 'Let’s do it again, 1' }).click();
    await expect(card.getByRole('button', { name: 'Let’s do it again, 1' })).toBeVisible();

    // The "So far" card can be put away (per group)
    await browse.getByRole('button', { name: 'Hide this' }).click();
    await expect(browse).not.toContainText('TORREZ FITNESS · SO FAR');

    // The It happened page: a public thank-you, which Hope sees
    await card.getByRole('button', { name: /^Made it happen/ }).click();
    const done = O.locator('[data-screen-label="It happened"]');
    await done.getByRole('button', { name: 'Say thanks, 0' }).click();
    await expect(done.getByRole('button', { name: 'Say thanks, 1' })).toHaveAttribute('aria-pressed', 'true');
    await expect(done).toContainText('Thanks from Hal');
    await expect(O.locator('html[data-saving]')).toHaveCount(0);   // the tap shows at once; wait for it to be saved before Hope looks
    await openIdea(H, id);
    await expect(H.locator('[data-screen-label="It happened"]')).toContainText('Thanks from Hal');
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await guest.context.close();
  }
});

