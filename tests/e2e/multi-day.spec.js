// Multi-day events (Design v8-7, 20261108000000_multi_day.sql): How long is it? on Plan an event's Date & time, typed
// times, Separate days with People RSVP for Each day, Review's range, the event page's fanned pages and timeline, When
// will you attend?, a job on one day (WHICH DAY) that adds that day to your RSVP, Who's coming's day tags, and a
// recurring event set from the event's Edit.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, startPost, pickDate, timeBox, closeAskFirst, ideaIdFromUrl, openIdea, deleteIdea, asUser, donePlus, newMember, rsvpTap } = require('./helpers');

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const wk = (iso, long) => new Date(iso + 'T12:00').toLocaleDateString('en-US', { weekday: long ? 'long' : 'short' });

test('multi-day: separate days, each-day RSVP, a job on one day, and a weekly event', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Marisol');
  const member = await newLead(browser, 2, 'Dee');
  const H = host.page, M = member.page;
  const title = uniqueTitle('Garage sale weekend'), d1 = inDays(12), d2 = inDays(13);
  let id;
  try {
    await startPost(H);
    const flow = H.locator('[data-screen-label="New spark"]');
    await flow.getByLabel('Event title').fill(title);
    // Date & time is a pop-up on the one page (v8-14)
    await flow.locator('[data-cp-row="when"]').click();
    const wp = H.locator('[data-ev-pop="when"]');
    // How long is it? One day to start; Separate days adds a Day 2 the day after Day 1
    await expect(wp.locator('[data-day-type]')).toContainText('One day');
    await pickDate(wp, d1);
    await wp.locator('[data-day-type]').click();
    const how = H.getByRole('dialog', { name: 'How long is it?' });
    await expect(how.getByRole('radio')).toHaveCount(4);
    await expect(how.getByRole('radio', { name: /One day/ })).toHaveAttribute('aria-checked', 'true');
    await how.getByRole('radio', { name: /Separate days/ }).click();
    await how.getByRole('button', { name: 'Done' }).click();
    await expect(how).toHaveCount(0);
    await expect(wp.locator('[data-day-type]')).toContainText('Separate days');
    // Times are typed: "10am", "4p", and something unreadable says how to write it
    await timeBox(wp, 'Day 1 start').fill('abc');
    await timeBox(wp, 'Day 1 start').press('Enter');
    await expect(H.getByText('Try a time like 10am or 4:30pm')).toBeVisible();
    await timeBox(wp, 'Day 1 start').fill('10am');
    await timeBox(wp, 'Day 1 start').press('Enter');
    await expect(timeBox(wp, 'Day 1 start')).toHaveValue('10am');
    await timeBox(wp, 'Day 1 end').fill('4p');
    await timeBox(wp, 'Day 1 end').press('Enter');
    await expect(timeBox(wp, 'Day 1 end')).toHaveValue('4pm');
    await expect(wp.getByRole('button', { name: 'Day 2 date', exact: true })).toBeVisible();
    await timeBox(wp, 'Day 2 start').fill('12');   // a bare 12 is noon
    await timeBox(wp, 'Day 2 start').press('Enter');
    await expect(timeBox(wp, 'Day 2 start')).toHaveValue('12pm');
    await timeBox(wp, 'Day 2 end').fill('5');      // a bare hour up to 6 is pm
    await timeBox(wp, 'Day 2 end').press('Enter');
    await expect(timeBox(wp, 'Day 2 end')).toHaveValue('5pm');
    await wp.getByRole('radio', { name: 'Each day' }).click();
    await expect(wp.getByRole('radio', { name: 'Each day' })).toHaveAttribute('aria-checked', 'true');
    await wp.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(flow.locator('[data-cp-row="when"]')).toContainText('2 days');
    await flow.locator('[data-post]').click();
    await expect(H.locator('[data-screen-label="Plan page"]')).toBeVisible();
    await closeAskFirst(H);
    id = ideaIdFromUrl(H);
    const saved = await asUser(H, async (c, _C, id) => (await c.from('sparks').select('day_date, day_time, schedule').eq('id', id).single()).data, id);
    expect(saved.day_date).toBe(d1);
    expect(saved.schedule.kind).toBe('days');
    expect(saved.schedule.each).toBe(true);
    expect(saved.schedule.days.map(r => [r.d, r.t, r.e])).toEqual([[d1, '10:00', '16:00'], [d2, '12:00', '17:00']]);

    // The event page: two fanned calendar pages, and the date card's timeline
    const HP = H.locator('[data-screen-label="Plan page"]');
    await expect(HP.locator('[data-date-pages]')).toBeVisible();
    await expect(HP.locator('[data-day-timeline]')).toContainText(new Date(d1 + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }));
    await expect(HP.locator('[data-day-timeline]')).toContainText('12pm–5pm');
    // The host adds a job on Day 2 (WHICH DAY)
    await HP.locator('[data-help-empty], [data-help-edit]').first().click();
    const needs = H.getByRole('dialog', { name: 'Edit sign-ups' });
    await needs.locator('[data-needs-add]').click();
    await needs.getByLabel('Job name 1').fill('Pack up leftovers');
    const which = needs.getByRole('radiogroup', { name: 'Which day 1' });
    await expect(which.getByRole('radio', { name: 'Any day' })).toHaveAttribute('aria-checked', 'true');
    await which.getByRole('radio', { name: new RegExp('^' + wk(d2)) }).click();
    await needs.getByRole('button', { name: 'Save changes' }).click();
    await expect(needs).toHaveCount(0);
    await expect(HP.locator('[data-signup="Pack up leftovers"]')).toContainText('Pack up leftovers' + wk(d2));   // the job's day (it has no time)

    // A member taps Going: When will you attend?, one card per day, nothing picked
    await openIdea(M, id);
    const MP = M.locator('[data-screen-label="Plan page"]');
    await rsvpTap(MP.locator('[data-rsvp]'), 'Going');
    const pick = M.getByRole('dialog', { name: 'When will you attend?' });
    await expect(pick.locator('[data-day-card]')).toHaveCount(2);
    await expect(pick.locator('[data-day-pick-go]')).toHaveText('Pick at least one day');
    await pick.locator('[data-day-card="' + d1 + '"]').getByRole('button', { name: 'Going' }).click();
    await pick.locator('[data-day-card="' + d2 + '"]').getByRole('button', { name: 'Maybe' }).click();
    await expect(pick.locator('[data-day-pick-go]')).toHaveText('Going ' + wk(d1) + ' · Maybe ' + wk(d2));
    await pick.locator('[data-day-pick-go]').click();
    await expect(pick).toHaveCount(0);
    await donePlus(M);   // You're going! (v8-11), then the days toast
    await expect(MP.locator('[data-my-days]')).toContainText('You’re going ' + wk(d1) + ' · maybe ' + wk(d2));
    // Holding the Day 2 job adds Day 2 to the RSVP
    await MP.locator('[data-signup="Pack up leftovers"]').getByRole('button', { name: 'Sign up' }).click();
    await expect(M.getByText('Added ' + wk(d2, true) + ' to your RSVP')).toBeVisible();
    await M.locator('[data-onit-done]').click();   // You're signed up! (owner, 2026-10-07)
    await expect(MP.locator('[data-my-days]')).toContainText('You’re going both days');
    const reply = await asUser(M, async (c, _C, id) => (await c.from('rsvps').select('status, days, maybe_days').eq('spark_id', id).eq('user_id', (await c.auth.getUser()).data.user.id).single()).data, id);
    expect(reply).toEqual({ status: 'going', days: [d1, d2], maybe_days: [] });

    // A guest (signed out, v8-11 1d + 2b): When will you attend? asks for a name and Bringing anyone?, then You're on the list
    const visitor = await newMember(browser);
    try {
      const V = visitor.page;
      await V.goto('/#/idea/' + id);
      await rsvpTap(V.locator('[data-screen-label="Plan page"] [data-rsvp]'), 'Going');
      const gp = V.getByRole('dialog', { name: 'When will you attend?' });
      await gp.locator('[data-day-card="' + d1 + '"]').getByRole('button', { name: 'Going' }).click();
      await expect(gp.locator('[data-day-pick-go]')).toHaveText('Add your name');
      await expect(gp.locator('[data-guest-email] button')).toHaveText(['Sign in', 'Create account']);
      await gp.getByLabel('Your name').fill('Gia');
      await gp.getByRole('button', { name: 'One more' }).click();
      await expect(gp.locator('[data-day-pick-go]')).toHaveText('RSVP as a guest');
      await gp.locator('[data-day-pick-go]').click();
      const listed = V.getByRole('dialog', { name: 'You’re on the list' });
      await expect(listed).toContainText('You’re on the list, Gia!');
      await expect(listed.locator('[data-plus-summary]')).toContainText('Going · ' + wk(d1, true).slice(0, 3));
      await expect(listed.locator('[data-plus-summary]')).toContainText('You + 1');
      await listed.locator('[data-plus-x]').click();
      await expect(listed).toHaveCount(0);
    } finally { await visitor.context.close(); }

    // Who's coming: the member's day tag
    await H.reload();
    await HP.locator('[data-going]').click();
    const who = H.getByRole('dialog', { name: 'Who’s coming' });
    await expect(who.locator('[data-guest-part="going"] [data-day-tag]').first()).toBeVisible();
    await expect(who.locator('[data-guest-part="going"]')).toContainText('Both days');
    await who.getByRole('button', { name: 'Close' }).click();

    // Recurring is a request (owner, 2026-10-07); Runs across days works (owner, 2026-10-07)
    await HP.getByRole('button', { name: 'Edit date, time and location' }).click();
    const when = H.getByRole('dialog', { name: 'Date, time & location' });
    await when.locator('[data-day-type]').click();
    const types = H.getByRole('dialog', { name: 'How long is it?' });
    await expect(types.locator('[data-soon]')).toHaveCount(1);
    await types.getByRole('radio', { name: /Runs across days/ }).click();
    await expect(types.locator('[data-day-type-opt="span"]')).toHaveAttribute('aria-checked', 'true');
    await types.getByRole('radio', { name: /Separate days/ }).click();
    await expect(types.locator('[data-day-type-opt="days"]')).toHaveAttribute('aria-checked', 'true');
    // Recurring carries a REQUEST chip; a tap offers Request it (owner, 2026-10-07; it was Coming soon)
    await expect(types.locator('[data-day-type-opt="repeat"] [data-request-chip]')).toHaveText('REQUEST');
    await types.getByRole('radio', { name: /Recurring event/ }).click();
    const req = H.getByRole('alertdialog', { name: 'Recurring events aren’t here yet' });
    await req.getByRole('button', { name: 'Not now' }).click();
    await expect(req).toHaveCount(0);

    expect(host.errors).toEqual([]);
    expect(member.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id);
    await host.context.close();
    await member.context.close();
  }
});

// The multi-day audit (owner, 2026-10-07): lists show a row per upcoming day (B1, only your days on an Each day event),
// dates when two days share a weekday (U1), past days dimmed and today marked, past days can't be picked (M3), and an
// unfinished span can't be saved (B6)
test('multi-day: a row per upcoming day, dates for repeated weekdays, past days, unfinished spans', async ({ browser }) => {
  const host = await newLead(browser, 1, 'Marisol');
  const member = await newLead(browser, 2, 'Dee');
  const H = host.page, M = member.page;
  const title = uniqueTitle('Wednesday build days'), dp = inDays(-7), d0 = inDays(0), d7 = inDays(7);
  const fmt = (iso) => new Date(iso + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  let id;
  try {
    // Three of the same weekday: last week, today (late, so it isn't over) and next week; People RSVP for Each day
    id = await asUser(H, async (c, _C, f) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      const r = await c.from('sparks').insert(Object.assign({ group_id: g, author_name: 'Marisol', lead_name: 'Marisol', lead_id: me, created_by: me, planned: true }, f)).select('id').single();
      return r.error ? r.error.message : r.data.id;
    }, { text: title, day_date: dp, day_time: '23:00', day_end: '23:45', schedule: { kind: 'days', each: true, days: [{ d: dp, t: '23:00', e: '23:45' }, { d: d0, t: '23:00', e: '23:45' }, { d: d7, t: '23:00', e: '23:45' }] } });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    // The host's My calendar (Up next): today's day and next week's, not last week's
    await H.goto('/#/');
    await expect(H.locator('html[data-loaded=true]')).toHaveCount(1);
    const yc = H.locator('[data-screen-label="Your calendar"]');
    await expect(yc.locator('[data-plan="' + title + '"]')).toHaveCount(2);
    await expect(yc.locator('[data-plan="' + title + '"][data-day="' + d0 + '"]')).toHaveCount(1);
    await expect(yc.locator('[data-plan="' + title + '"][data-day="' + d7 + '"]')).toContainText('Day 3 of 3');
    await expect(yc.locator('[data-plan="' + title + '"][data-day="' + dp + '"]')).toHaveCount(0);

    // The event page: last week dimmed, today tagged
    await openIdea(H, id);
    const HP = H.locator('[data-screen-label="Plan page"]');
    await expect(HP.locator('[data-day-timeline] [data-day-past]')).toHaveCount(1);
    await expect(HP.locator('[data-day-timeline] [data-day-today]')).toContainText('Today');
    // Add to calendar skips the day that's over and names the two Wednesdays by date
    await HP.getByText('Add to calendar').first().click();
    await expect(H.getByText('Added ' + fmt(d0) + ' & ' + fmt(d7) + ' to your calendar (2 entries)')).toBeVisible();

    // B6: Runs across days with the end before the start can't be saved, and says why
    await HP.getByRole('button', { name: 'Edit date, time and location' }).click();
    const when = H.getByRole('dialog', { name: 'Date, time & location' });
    await when.locator('[data-day-type]').click();
    const types = H.getByRole('dialog', { name: 'How long is it?' });
    await types.getByRole('radio', { name: /Runs across days/ }).click();
    await types.getByRole('button', { name: 'Done' }).click();
    await pickDate(when, inDays(10));   // the start, after the end date (a day after the old start)
    await expect(when.locator('[data-when-err]')).toHaveText('Pick a later end date');
    await expect(when.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await pickDate(when, inDays(12), 'End date');
    await expect(when.locator('[data-when-err]')).toHaveCount(0);
    await expect(when.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-disabled', 'false');
    await when.getByRole('button', { name: 'Close' }).first().click();
    await expect(when).toHaveCount(0);

    // A member: When will you attend? can't pick last week; Going next week only says which Wednesday
    await openIdea(M, id);
    const MP = M.locator('[data-screen-label="Plan page"]');
    await rsvpTap(MP.locator('[data-rsvp]'), 'Going');
    const pick = M.getByRole('dialog', { name: 'When will you attend?' });
    await expect(pick.locator('[data-day-card="' + dp + '"]')).toHaveAttribute('aria-disabled', 'true');
    await expect(pick.locator('[data-day-card="' + dp + '"]')).toContainText('Past');
    await expect(pick.locator('[data-day-card="' + dp + '"]').getByRole('button', { name: 'Going' })).toHaveCount(0);
    await pick.locator('[data-day-card="' + d7 + '"]').getByRole('button', { name: 'Going' }).click();
    await expect(pick.locator('[data-day-pick-go]')).toHaveText('I’m going ' + fmt(d7));
    await pick.locator('[data-day-pick-go]').click();
    await expect(pick).toHaveCount(0);
    await donePlus(M);
    await expect(MP.locator('[data-my-days]')).toContainText('You’re going ' + fmt(d7));
    // The member's My calendar: only the day they picked
    await M.goto('/#/');
    await expect(M.locator('html[data-loaded=true]')).toHaveCount(1);
    const mc = M.locator('[data-screen-label="Your calendar"]');
    await expect(mc.locator('[data-plan="' + title + '"][data-day="' + d7 + '"]')).toHaveCount(1);
    await expect(mc.locator('[data-plan="' + title + '"]')).toHaveCount(1);

    expect(host.errors).toEqual([]);
    expect(member.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id);
    await host.context.close();
    await member.context.close();
  }
});
