// Multi-day events (Design v8-7, 20261108000000_multi_day.sql): How long is it? on Plan an event's Date & time, typed
// times, Separate days with People RSVP for Each day, Review's range, the event page's fanned pages and timeline, When
// will you attend?, a job on one day (WHICH DAY) that adds that day to your RSVP, Who's coming's day tags, and a
// recurring event set from the event's Edit.
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, startPost, pickDate, timeBox, closeAskFirst, ideaIdFromUrl, openIdea, deleteIdea, asUser } = require('./helpers');

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
    // How long is it? One day to start; Separate days adds a Day 2 the day after Day 1
    await expect(flow.locator('[data-day-type]')).toContainText('One day');
    await pickDate(flow, d1);
    await flow.locator('[data-day-type]').click();
    const how = H.getByRole('dialog', { name: 'How long is it?' });
    await expect(how.getByRole('radio')).toHaveCount(4);
    await expect(how.getByRole('radio', { name: /One day/ })).toHaveAttribute('aria-checked', 'true');
    await how.getByRole('radio', { name: /Separate days/ }).click();
    await how.getByRole('button', { name: 'Done' }).click();
    await expect(how).toHaveCount(0);
    await expect(flow.locator('[data-day-type]')).toContainText('Separate days');
    // Times are typed: "10am", "4p", and something unreadable says how to write it
    await timeBox(flow, 'Day 1 start').fill('abc');
    await timeBox(flow, 'Day 1 start').press('Enter');
    await expect(H.getByText('Try a time like 10am or 4:30pm')).toBeVisible();
    await timeBox(flow, 'Day 1 start').fill('10am');
    await timeBox(flow, 'Day 1 start').press('Enter');
    await expect(timeBox(flow, 'Day 1 start')).toHaveValue('10:00am');
    await timeBox(flow, 'Day 1 end').fill('4p');
    await timeBox(flow, 'Day 1 end').press('Enter');
    await expect(timeBox(flow, 'Day 1 end')).toHaveValue('4:00pm');
    await expect(flow.getByRole('button', { name: 'Day 2 date', exact: true })).toBeVisible();
    await timeBox(flow, 'Day 2 start').fill('12');   // a bare 12 is noon
    await timeBox(flow, 'Day 2 start').press('Enter');
    await expect(timeBox(flow, 'Day 2 start')).toHaveValue('12:00pm');
    await timeBox(flow, 'Day 2 end').fill('5');      // a bare hour up to 6 is pm
    await timeBox(flow, 'Day 2 end').press('Enter');
    await expect(timeBox(flow, 'Day 2 end')).toHaveValue('5:00pm');
    await flow.getByRole('radio', { name: 'Each day' }).click();
    await expect(flow).toContainText('People pick which days they’re coming.');
    await flow.getByRole('button', { name: 'Next', exact: true }).click();
    await flow.getByText('Add later', { exact: true }).click();
    await flow.getByText('None needed', { exact: true }).click();
    await expect(flow.locator('[data-ready-count]')).toBeVisible();
    await expect(flow).toContainText('· 2 days');
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
    const needs = H.getByRole('dialog', { name: 'Edit what you need' });
    await needs.getByText('Add a job or item').click();
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
    await MP.locator('[data-rsvp]').getByRole('button', { name: /^Going/ }).click();
    const pick = M.getByRole('dialog', { name: 'When will you attend?' });
    await expect(pick.locator('[data-day-card]')).toHaveCount(2);
    await expect(pick.locator('[data-day-pick-go]')).toHaveText('Pick at least one day');
    await pick.locator('[data-day-card="' + d1 + '"]').getByRole('button', { name: 'Going' }).click();
    await pick.locator('[data-day-card="' + d2 + '"]').getByRole('button', { name: 'Maybe' }).click();
    await expect(pick.locator('[data-day-pick-go]')).toHaveText('Going ' + wk(d1) + ' · Maybe ' + wk(d2));
    await pick.locator('[data-day-pick-go]').click();
    await expect(pick).toHaveCount(0);
    await expect(MP.locator('[data-my-days]')).toContainText('You’re going ' + wk(d1) + ' · maybe ' + wk(d2));
    // Holding the Day 2 job adds Day 2 to the RSVP
    await MP.locator('[data-signup="Pack up leftovers"]').getByRole('button', { name: 'Sign up' }).click();
    await expect(M.getByText('Added ' + wk(d2, true) + ' to your RSVP')).toBeVisible();
    await expect(MP.locator('[data-my-days]')).toContainText('You’re going both days');
    const reply = await asUser(M, async (c, _C, id) => (await c.from('rsvps').select('status, days, maybe_days').eq('spark_id', id).eq('user_id', (await c.auth.getUser()).data.user.id).single()).data, id);
    expect(reply).toEqual({ status: 'going', days: [d1, d2], maybe_days: [] });

    // Who's coming: the member's day tag
    await H.reload();
    await HP.locator('[data-going]').click();
    const who = H.getByRole('dialog', { name: 'Who’s coming' });
    await expect(who.locator('[data-guest-part="going"] [data-day-tag]').first()).toBeVisible();
    await expect(who.locator('[data-guest-part="going"]')).toContainText('Both days');
    await who.getByRole('button', { name: 'Close' }).click();

    // Recurring and Runs across days are Coming soon (Design v8-8): dimmed, an amber toast, nothing changes
    await HP.getByRole('button', { name: 'Edit date, time and location' }).click();
    const when = H.getByRole('dialog', { name: 'Date, time & location' });
    await when.locator('[data-day-type]').click();
    const types = H.getByRole('dialog', { name: 'How long is it?' });
    await expect(types.locator('[data-soon]')).toHaveCount(2);
    await expect(types.locator('[data-day-type-opt="repeat"]')).toContainText('Coming soon');
    await types.getByRole('radio', { name: /Recurring event/ }).click();
    await expect(H.getByRole('status')).toContainText('Recurring event is coming soon');
    await expect(types.locator('[data-day-type-opt="days"]')).toHaveAttribute('aria-checked', 'true');
    await types.getByRole('button', { name: 'Done' }).click();

    expect(host.errors).toEqual([]);
    expect(member.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(H, id);
    await host.context.close();
    await member.context.close();
  }
});
