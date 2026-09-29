// v6: Your tasks (Leading / Helping, to-dos, stats strip, View all), Your schedule (strips that expand),
// the community Calendar (filters, search, Could use a hand, Month), the "You're on it" banner,
// and Profile / Notifications as sheets.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, postEvent, openIdea, deleteIdea, pickView, asUser, addJob } = require('./helpers');

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
    // Signed in, the app opens on the Calendar (the home screen); the tab bar is the v6 five
    await expect(H.locator('[data-screen-label=Calendar]')).toBeVisible();
    await expect(H.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(nav(H).getByRole('button')).toHaveCount(5);
    for (const name of [/^Your tasks/, 'Your schedule', 'Calendar', 'Groups', 'Profile']) await expect(nav(H).getByRole('button', { name, exact: typeof name === 'string' })).toBeVisible();

    // Hope posts an event for today with no location, then adds sign-ups (one with a time)
    id = await postEvent(H, { title, date: inDays(0), time: '23:30' });
    const HP = H.locator('[data-screen-label="Plan page"]');
    for (const [item, need, time] of [['Folding chairs', '2', '23:00'], ['Ice', '1', '']]) {
      await addJob(H, { item, need: +need, time });
      await expect(HP.locator('[data-signup="' + item + '"]')).toBeVisible();
    }

    // Her Your tasks: a Leading card with the stats strip and three to-dos (two, then "+1 more")
    await nav(H).getByRole('button', { name: /^Your tasks/ }).click();
    const lead = H.locator('[data-screen-label="Your tasks"] section[aria-label=Leading] [data-task="' + title + '"]');
    await expect(lead).toContainText('Today');
    // Your tasks and Your schedule have Search beside the bell (the Calendar's search sheet)
    await H.locator('[data-screen-label="Your tasks"]').getByRole('button', { name: 'Search events' }).click();
    const hSearch = H.getByRole('dialog', { name: 'Search' });
    await hSearch.getByLabel('Search events').fill(title.slice(-12));
    await expect(hSearch.locator('[data-result="' + title + '"]')).toBeVisible();
    await hSearch.getByRole('button', { name: 'Cancel' }).click();
    await expect(hSearch).toHaveCount(0);
    await expect(lead.getByLabel('Going: 0')).toBeVisible();
    await expect(lead.getByLabel('Sign-ups: 0/3')).toBeVisible();
    await expect(lead.getByLabel('Reminder: Sent')).toBeVisible();
    await expect(lead).toContainText('Post an update');
    await expect(lead).toContainText('Location TBD');
    await expect(lead).toContainText('+1 more');
    await lead.getByText('+1 more').click();
    await expect(lead).toContainText('3 spots open');
    await expect(lead).toContainText('Show less');
    await shot(H, '01-your-tasks-lead');
    await expect(nav(H).getByRole('button', { name: /^Your tasks, \d+$/ })).toBeVisible();   // the badge counts events with to-dos

    // View all: every to-do listed, the stats strip too
    await H.locator('[data-screen-label="Your tasks"]').getByRole('button', { name: 'View all leading' }).click();
    const all = H.getByRole('dialog', { name: 'Leading' });
    await expect(all.locator('[data-task="' + title + '"]')).toContainText('3 spots open');
    await shot(H, '02-view-all');
    await all.getByRole('button', { name: 'Close' }).click();
    await expect(all).toHaveCount(0);

    // Hal finds it on the Calendar: not joined, so "3 spots left · 0 going" and RSVP
    await O.reload();
    await nav(O).getByRole('button', { name: 'Calendar', exact: true }).click();
    const cal = O.locator('[data-screen-label=Calendar]');
    await expect(cal.getByRole('heading', { name: 'Calendar' })).toBeVisible();
    await expect(cal).toContainText(/All events from your \d+ groups?/);
    const card = cal.locator('[data-plan="' + title + '"]');
    await expect(card).toContainText('3 spots left');
    await expect(card).toContainText('RSVP');
    await shot(O, '03-calendar');

    // Type filter: it's a Social event (nothing else in the title matches); Games hides it
    await cal.getByRole('button', { name: /^Type of event:/ }).click();
    await O.getByRole('menu', { name: 'Type of event' }).getByRole('menuitemcheckbox', { name: /^Games/ }).click();
    await expect(card).toHaveCount(0);
    await expect(cal.getByText('Clear filters')).toBeVisible();
    await cal.getByText('Clear filters').click();
    await expect(card).toBeVisible();

    // Search finds it; a result opens the plan
    await cal.getByRole('button', { name: 'Search events' }).click();
    const search = O.getByRole('dialog', { name: 'Search' });
    // Before typing: Try chips and "Or something unexpected" (Update 2)
    await expect(search.getByText('Try', { exact: true })).toBeVisible();
    await expect(search.getByText('Or something unexpected')).toBeVisible();
    await expect(search.locator('[data-magic]')).toHaveCount(6);
    await search.getByRole('button', { name: 'Needs helpers', exact: true }).click();
    await expect(search.locator('[data-result="' + title + '"]')).toBeVisible();   // it has open sign-ups
    await search.getByRole('button', { name: 'Clear Needs helpers' }).click();
    await expect(search.locator('[data-magic]')).toHaveCount(6);
    await search.getByLabel('Search events').fill(title.slice(-12));
    await expect(search.locator('[data-result="' + title + '"]')).toBeVisible();
    await shot(O, '04-search');
    await search.locator('[data-result="' + title + '"]').click();
    const OP = O.locator('[data-screen-label="Plan page"]');
    await expect(OP).toBeVisible();

    // v6 Update 5: signing up is one tap and a "You're on it" banner, no RSVP question; he says Maybe himself
    await OP.locator('[data-signup="Ice"]').getByRole('button', { name: 'Sign up' }).click();
    await expect(O.locator('[data-banner="on"]')).toContainText('You’re on it');
    await expect(O.getByRole('dialog', { name: 'Will you be there?' })).toHaveCount(0);
    await shot(O, '05-on-it');
    await OP.locator('[data-rsvp]').getByRole('button', { name: /^Maybe/ }).click();
    await expect(O.getByText('Marked as maybe')).toBeVisible();

    // His Your tasks: a Helping card with "You said maybe", his sign-up and the day
    await nav(O).getByRole('button', { name: /^Your tasks/ }).click();
    const help = O.locator('[data-screen-label="Your tasks"] section[aria-label=Helping] [data-task="' + title + '"]');
    await expect(help).toContainText('You said maybe');
    await expect(help).toContainText('Update RSVP');
    await expect(help).toContainText('+2 more');
    await help.getByText('+2 more').click();
    await expect(help).toContainText('Ice');
    await expect(help).toContainText('Today · 11:30pm');
    await shot(O, '06-your-tasks-help');

    // Your schedule: Helping strip, "1 task" expands in place; the List view has the same strip
    await nav(O).getByRole('button', { name: 'Your schedule', exact: true }).click();
    const sched = O.locator('[data-screen-label="Your schedule"]');
    const tile = sched.locator('[data-plan="' + title + '"]');
    await expect(tile).toContainText('Helping');
    await tile.getByText('1 task').click();
    await expect(tile).toContainText('Ice');
    await pickView(sched, 'List');
    await expect(tile).toContainText('Helping');
    await shot(O, '07-your-schedule-list');
    await pickView(sched, 'Tiles');

    // Could use a hand: claim the chairs; "You're on it", and no RSVP question
    await nav(O).getByRole('button', { name: 'Calendar', exact: true }).click();
    await cal.getByRole('button', { name: /^\d+ events? could use a hand$/ }).click();
    const hand = O.getByRole('dialog', { name: 'Could use a hand' });
    const row = hand.locator('[data-hand="' + title + '"] [data-signup="Folding chairs"]');
    await expect(row).toContainText('2 of 2 open');
    await shot(O, '08-could-use-a-hand');
    await row.getByRole('button', { name: 'Claim' }).click();
    await expect(O.locator('[data-banner="on"]')).toContainText('You’re on it');
    await expect(row).toContainText('Yours');
    await expect(O.getByRole('dialog', { name: 'Confirm your RSVP' })).toHaveCount(0);
    await hand.getByRole('button', { name: 'Close' }).click();

    // Month view: the day's events under the grid
    await pickView(cal, 'Month');
    await expect(cal.getByRole('button', { name: 'Next month' })).toBeVisible();
    await expect(cal.locator('[data-plan="' + title + '"]')).toBeVisible();
    await shot(O, '09-month');
    await pickView(cal, 'List');

    // Profile and Notifications are sheets
    await nav(O).getByRole('button', { name: 'Profile', exact: true }).click();
    const prof = O.getByRole('dialog', { name: 'Profile', exact: true });
    await expect(prof.getByRole('button', { name: 'Edit profile' })).toBeVisible();
    await shot(O, '10-profile-sheet');
    await prof.getByRole('button', { name: 'Close' }).click();
    await expect(prof).toHaveCount(0);
    await cal.getByRole('button', { name: /^Notifications/ }).click();
    const notifs = O.getByRole('dialog', { name: 'Notifications' });
    await expect(notifs.getByRole('radio', { name: 'All' })).toBeVisible();
    await shot(O, '11-notifications-sheet');
    await notifs.getByRole('button', { name: 'Close' }).click();
    await expect(notifs).toHaveCount(0);

    // Hope's card: he's a maybe (so not going), and the chairs are half covered
    await H.reload();
    await expect(lead.getByLabel('Going: 0')).toBeVisible();
    await expect(lead.getByLabel('Sign-ups: 2/3')).toBeVisible();

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
    await expect(card).toContainText('went!');
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
    await openIdea(H, id);
    await expect(H.locator('[data-screen-label="It happened"]')).toContainText('Thanks from Hal');
  } finally {
    if (id) await deleteIdea(H, id).catch(() => {});
    await host.context.close();
    await guest.context.close();
  }
});

