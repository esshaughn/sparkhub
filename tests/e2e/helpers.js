// Shared helpers for driving Spark Hub the way a member would.
const { expect, devices, test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// The TEST project's address and public key, the way js/config.js gives them to a page on localhost
const CONFIG = (() => {
  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', 'location', fs.readFileSync(path.join(__dirname, '../../js/config.js'), 'utf8'))(window, { hostname: 'localhost' });
  return window.SPARKS_CONFIG;
})();
const SESSION_KEY = 'sb-' + new URL(CONFIG.supabaseUrl).host.split('.')[0] + '-auth-token';   // where supabase-js keeps the session

// A request to the TEST project from Node (not from a page). Answers within 20 seconds or throws:
// a stalled project then fails the test with a clear message, not a 90-second hang.
async function api(method, url, token, body) {
  const r = await fetch(CONFIG.supabaseUrl + url, {
    method, signal: AbortSignal.timeout(20000),
    headers: Object.assign({ apikey: CONFIG.supabaseKey, 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error((data && (data.msg || data.message || data.error_description)) || 'HTTP ' + r.status);
  return data;
}

// A 64×48 solid PNG. Enough for the app's resize-and-upload path.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAAZElEQVR4nO3PUQkAIBTAwBfE/lYzhiH8OITBAtzm7PV1wwUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY8dgFOWQUt++DHBwAAAABJRU5ErkJggg==',
  'base64'
);

// Everything a test creates starts with this, so a failed run's leftovers are easy to sweep
const TAG = '[E2E]';
const uniqueTitle = (label) => `${TAG} ${label} ${Date.now().toString(36)}`;
const TORREZ = 'TORREZ';   // the Torrez Fitness group's join code (test leads are members)

// Location suggestions come from Geoapify. Tests never call the real service
// (it has a daily limit); they get these two Austin places for any search.
const FAKE_PLACES = [
  { name: 'Zilker Metropolitan Park', address_line1: 'Zilker Metropolitan Park', address_line2: '2100 Barton Springs Road, Austin, TX 78746, United States of America', formatted: 'Zilker Metropolitan Park, 2100 Barton Springs Road, Austin, TX 78746, United States of America', lat: 30.2669, lon: -97.7729 },
  { address_line1: '1100 Congress Avenue', address_line2: 'Austin, TX 78701, United States of America', formatted: '1100 Congress Avenue, Austin, TX 78701, United States of America', lat: 30.2747, lon: -97.7404 }
];
async function mockPlaces(target) {
  const seen = [];
  await target.route('https://api.geoapify.com/**', (route) => {
    seen.push(route.request().url());
    route.fulfill({ json: { results: FAKE_PLACES } });
  });
  return seen;
}

// Collects console errors, uncaught exceptions and failed requests so a test can assert "no errors".
function trackErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push('request failed: ' + r.url().slice(0, 100) + ' ' + ((r.failure() || {}).errorText || '')));
  return errors;
}

// The app has loaded its data from the TEST database, with no error banner
async function expectConnected(page, errors) {
  try {
    await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
  } catch (e) {
    // The TEST project is a small free instance and has stalled for minutes under a full run (2026-10-01/02).
    // Say so, so a stall isn't read as an app bug.
    const up = await api('GET', '/auth/v1/health').then(() => true, () => false);
    throw new Error((up ? '' : 'The TEST Supabase project is not answering (its health check failed), so the app could not load. Not an app bug.\n') +
      (errors && errors.length ? 'Page errors: ' + errors.join(' | ') + '\n' : '') + e.message);
  }
  if (errors && errors.length) throw new Error('Page errors while loading: ' + errors.join(' | '));
  await expect(page.locator('[data-load-failed]')).toHaveCount(0);
  expect(await page.evaluate(() => !!window.supabase && window.SPARKS_CONFIG.env)).toBe('test');
}

// Photos from Supabase Storage are answered with the tiny PNG instead of downloaded.
// Every test browser starts with an empty cache, so real photos were fetched again on
// every run and used up the free plan's cached egress. Uploads and deletes still go through.
async function stubPhotos(target) {
  await target.route('**/storage/v1/object/public/**', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
      : route.continue());
}

const livePages = new Set();
async function othersSaved(page) {
  for (const p of livePages) {
    if (p === page || p.isClosed()) continue;
    await p.waitForFunction(() => !document.documentElement.hasAttribute('data-saving'), null, { timeout: 20000 }).catch(() => {});
  }
}
// Fresh visitor: new browser context = new localStorage = new anonymous identity
// (`stored`: localStorage entries the browser starts with; newLead passes a signed-in session)
async function newMember(browser, path, stored) {
  const origin = new URL(test.info().project.use.baseURL).origin;
  const context = await browser.newContext({ ...devices['Pixel 7'], ...(stored ? { storageState: { cookies: [], origins: [{ origin, localStorage: stored }] } } : {}) });
  // The Add to Home Screen pop-up counts as already shown, so it never covers what a test clicks (smoke.spec.js tests it)
  await context.addInitScript(() => {
    if (localStorage.getItem('e2e-install')) return;
    localStorage.setItem('sparkhub-a2hs', String(Date.now() + 864e5));   // hidden for a day
  });
  context.placeRequests = await mockPlaces(context);
  await stubPhotos(context);
  const page = await context.newPage();
  const errors = trackErrors(page);
  // Taps show at once and save behind the screen (RSVP, votes, sign-ups…), so before anyone reloads or opens a page,
  // every other person's saves have to land, or they'd read the database too early
  livePages.add(page);
  page.on('close', () => livePages.delete(page));
  for (const m of ['goto', 'reload']) {
    const orig = page[m].bind(page);
    page[m] = async (...a) => { await othersSaved(page); return orig(...a); };
  }
  await page.goto(path || '/');
  await expectConnected(page, errors);
  return { context, page, errors };
}

// Signed-in lead. The test project has two password accounts for this (the app
// itself only offers email codes and Google; tests can't read an inbox).
// Password comes from tests/.env or the CI secret. Both are Torrez Fitness members.
// Each parallel worker signs in as its own pair of leads, so tests running side by side never share an account:
// worker 0 → e2e-lead-1/2, worker 1 → 3/4, worker 2 → 5/6 (all on TEST; made by scripts/test-leads.py)
const leadEmail = (n) => `e2e-lead-${n + 2 * test.info().parallelIndex}@example.com`;

let torrezId;   // Torrez Fitness, the group every test lead belongs to (looked up once per worker)
async function newLead(browser, n, name, path) {
  const password = process.env.E2E_LEAD_PASSWORD;
  if (!password) throw new Error('E2E_LEAD_PASSWORD is not set (tests/.env locally, a repo secret on CI)');
  // Sign in from Node and hand the browser the session, so the app loads once, already signed in and in
  // Torrez Fitness. Signing in inside the page took three full loads (~24 requests each) and an anonymous
  // account per lead: about a quarter of a full run's requests to the TEST project (2026-10-02).
  let session;
  try {
    session = await api('POST', '/auth/v1/token?grant_type=password', null, { email: leadEmail(n), password });
    session.user = await api('PUT', '/auth/v1/user', session.access_token, { data: { name, display_name: name } });
    await api('POST', '/rest/v1/rpc/rename_me', session.access_token, { p_name: name });
    if (!torrezId) torrezId = (await api('GET', '/rest/v1/groups?select=id&name=eq.' + encodeURIComponent('Torrez Fitness'), session.access_token))[0].id;
  } catch (e) {
    throw new Error('Lead sign-in failed: ' + e.message);
  }
  if (!session.expires_at) session.expires_at = Math.floor(Date.now() / 1000) + session.expires_in;
  return newMember(browser, path, [
    { name: SESSION_KEY, value: JSON.stringify(session) },
    { name: 'spark-hub-prefs', value: JSON.stringify({ groupId: torrezId }) }
  ]);
}

const button = (page, name) => page.getByRole('button', { name, exact: true });

// v6: posting starts from the Calendar's + button (the Create event flow); Profile is the last tab (a sheet)
async function startPost(page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.locator('[data-screen-label=Calendar] [data-new-event]').click();
}
// Create event opens with the Real or test? pop-up (owner, 2026-10-01)
async function pickKind(page, test = false) {
  const ask = page.getByRole('dialog', { name: 'Real or test?' });
  await ask.getByRole('button', { name: test ? /^Just testing/ : /^Real event/ }).click();
  await expect(ask).toHaveCount(0);
}
// Tiles · List · Grid: the picker on the first month row
async function pickView(scope, name) {
  await scope.getByRole('button', { name: /^View: / }).click();
  await scope.page().getByRole('menu', { name: 'View' }).getByRole('button', { name, exact: true }).click();
  await expect(scope.getByRole('button', { name: 'View: ' + name })).toBeVisible();
}
// Taps (RSVP, votes, Interested, sign-ups…) show at once and save behind the screen: wait for them to land before
// another person looks
async function saved(page) { await expect(page.locator('html[data-saving]')).toHaveCount(0, { timeout: 20000 }); }
async function openProfile(page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Profile', exact: true })).toBeVisible();
}

// An idea (not yet a plan) in the current group. v6 Update 6 retired the idea-posting flow (everything
// posted is an event now), so older ideas are made directly, the way the demo data has them. Returns its id.
async function postIdea(page, { title, location, date, time, basics = [] }) {
  const id = await asUser(page, async (c, _C, { title, location, date, time, basics }) => {
    const me = (await c.auth.getUser()).data.user.id;
    const g = JSON.parse(localStorage.getItem('spark-hub-prefs') || '{}').groupId || (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
    const name = (await c.from('profiles').select('name').eq('id', me).single()).data.name || 'Tester';
    const r = await c.from('sparks').insert({ group_id: g, author_name: name, lead_name: name, lead_id: me, created_by: me, text: title.charAt(0).toUpperCase() + title.slice(1),
      hopes: basics.map(b => b.charAt(0).toUpperCase() + b.slice(1)), spot: location || null, spot_open: !location, day_date: date || null, day_time: date && time ? time : null }).select('id').single();
    return r.error ? r.error.message : r.data.id;
  }, { title, location, date, time, basics });
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Couldn’t make the idea: ' + id);
  await openIdea(page, id);
  return id;
}

async function answerNamePrompt(page, name) {
  await expect(page.getByRole('heading', { name: 'Your name' })).toBeVisible();
  await page.getByLabel('First name').fill(name);
  await button(page, 'Continue').click();
}

// Guests (no account) RSVP with just a name (owner, 2026-10-01); everything else asks them to make an account
async function answerGuestPrompt(page, name) {
  const d = page.getByRole('dialog', { name: 'RSVP as a guest' });
  await expect(d).toBeVisible();
  await expect(d.getByRole('button', { name: 'Continue', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await d.getByLabel('Your name').fill(name);
  await d.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(d).toBeHidden();
}

function ideaIdFromUrl(page) {
  const m = page.url().match(/#\/idea\/([0-9a-f-]{36})$/);
  if (!m) throw new Error('Not on an idea page: ' + page.url());
  return m[1];
}

// The date picker is our own calendar (owner, 2026-10-01): open the field, page to the month, tap the day ('' clears it)
async function pickDate(scope, iso, label = 'Date') {
  await scope.getByRole('button', { name: label, exact: true }).click();
  const cal = scope.locator('[data-calendar]');
  if (!iso) { await cal.getByRole('button', { name: 'Clear the date' }).click(); return; }
  for (let i = 0; i < 24 && (await cal.getAttribute('data-calendar')) < iso.slice(0, 7); i++) await cal.getByRole('button', { name: 'Next month' }).click();
  await cal.locator('[data-day="' + iso + '"]').click();
  await expect(cal).toHaveCount(0);
}
async function openIdea(page, id) {
  await page.goto('/#/idea/' + id);
  await expect(page.locator('[data-screen-label="Idea page"], [data-screen-label="Plan page"], [data-screen-label="It happened"]')).toBeVisible();
}

// Start an event with the 5-step Create event flow (v6 Update 6). Anything left out is decided later.
// Returns its id.
async function postEvent(page, { title, date, time, where, pick, details = [], jobs = [], inviteOnly = false, photo = false, test = false }) {
  await startPost(page);
  const flow = page.locator('[data-screen-label="New spark"]');
  const next = () => flow.getByRole('button', { name: /^(Next|Review)$/ }).click();
  const later = () => flow.getByText('Decide later', { exact: true }).click();
  await pickKind(page, test);
  await expect(flow).toContainText('1 of 5');
  await flow.getByLabel('Event title').fill(title);
  if (photo) await flow.getByLabel('Upload a cover photo').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG });
  await next();

  await expect(flow).toContainText('2 of 5');
  if (date) {
    await pickDate(flow, date);
    if (time) {
      await flow.getByRole('button', { name: 'Add a start time (optional)' }).click();
      await flow.getByRole('option', { name: timeWord(time), exact: true }).click();
    }
    await next();
  } else await later();

  await expect(flow).toContainText('3 of 5');
  if (where) {
    await flow.getByLabel('Location').fill(where);
    if (pick) await page.getByRole('group', { name: 'Suggested places' }).getByRole('button', { name: new RegExp(pick) }).click();
    await next();
  } else await later();

  await expect(flow).toContainText('4 of 5');
  if (details.length) {
    for (let i = 0; i < details.length; i++) await flow.getByLabel('Details, line ' + (i + 1)).fill(details[i]);
    await next();
  } else await later();

  await expect(flow).toContainText('5 of 5');
  if (jobs.length) {
    for (const j of jobs) {
      await flow.getByRole('button', { name: /Something else$/ }).click();
      const sheet = page.getByRole('dialog', { name: 'Add a job' });
      await sheet.getByLabel('Job name').fill(j.item);
      for (let n = 1; n < (j.need || 1); n++) await sheet.getByRole('button', { name: 'More for how many people' }).click();
      await sheet.getByRole('button', { name: 'Save', exact: true }).click();
    }
    await next();
  } else await later();

  await expect(flow).toContainText('LOOKS GOOD');
  if (inviteOnly) await flow.getByRole('radio', { name: /^Private/ }).click();
  await flow.getByRole('button', { name: /^Post (it|as an idea)$/ }).click();
  await expect(page.locator('[data-screen-label="Plan page"]')).toBeVisible();
  await expect(page.getByText('It’s on the books')).toHaveCount(0);   // no chip over a new plan (owner, 2026-10-01)
  if (!test) await closeAskFirst(page);
  return ideaIdFromUrl(page);
}
// Posting a real event opens the invite sheet as "Ask two people first" (research review, 2026-10-01)
async function closeAskFirst(page) {
  const ask = page.getByRole('dialog', { name: 'Ask two people first' });
  await expect(ask.locator('[data-ask-first]')).toContainText('a friend or two');
  await expect(ask.locator('[data-invitees]')).toBeVisible();   // friends and the event's groups to invite (owner's mock, 2026-10-01)
  await ask.getByRole('button', { name: 'Close' }).click();
  await expect(ask).toHaveCount(0);
}
// The host adds a job in Edit what you need (v6 Update 6): name, how many, an optional time
async function addJob(page, { item, need = 1, time }) {
  await page.locator('[data-screen-label="Plan page"]').getByRole('button', { name: 'Edit what you need' }).click();
  const sheet = page.getByRole('dialog', { name: 'Edit what you need' });
  const n = await sheet.locator('[data-need-row]').count() + 1;
  await sheet.getByText('Add a job or item').click();
  await sheet.getByLabel('Job name ' + n).fill(item);
  const row = sheet.locator('[data-need-row]').nth(n - 1);
  for (let k = 1; k < need; k++) await row.getByRole('button', { name: 'More for how many people' }).click();
  if (time) {   // the app's own time list, not a browser menu
    await row.getByRole('button', { name: 'Time ' + n, exact: true }).click();
    await row.getByRole('option', { name: timeWord(time), exact: true }).click();
  }
  await sheet.getByRole('button', { name: 'Save changes' }).click();
  await expect(sheet).toHaveCount(0);
}
// "17:30" → "5:30pm", as the time list shows it
const timeWord = (t) => { const [h, m] = t.split(':').map(Number); return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? 'am' : 'pm'); };

// Confirm dialogs: click the action, then the confirm button in the dialog.
async function confirm(page, cta) {
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: cta, exact: true }).click();
  await expect(dialog).toBeHidden();
}

// Delete an idea as its lead (cleanup). With other people in it the button reads "Cancel or delete this event" and
// opens the Cancel or delete sheet. Until 2026-10-02 this only knew the plain "Delete this event" + confirm, so every
// event someone had joined stayed on TEST after a 10-second wait (222 of them by the afternoon, in the group every
// lead loads: each load took three times as long and full runs timed out).
async function deleteIdea(page, id) {
  try {
    await openIdea(page, id);
    await page.getByRole('button', { name: /^(Cancel or delete|Delete) this (event|idea)$/ }).click({ timeout: 10000 });
    const takeDown = page.getByRole('dialog', { name: 'Cancel or delete' });
    const sure = page.getByRole('alertdialog');
    await expect(takeDown.or(sure)).toBeVisible();
    if (await takeDown.count()) await takeDown.getByRole('button', { name: 'Delete without telling anyone' }).click();
    else await sure.getByRole('button', { name: 'Delete it', exact: true }).click();
    await expect(page.locator('[data-screen-label=Browse]')).toBeVisible();
  } catch (e) {
    // A failed test can leave the page anywhere: ask the database, and say so if the event is still there
    const left = await asUser(page, async (c, _C, id) => {
      await c.rpc('delete_event', { p_spark: id, p_quiet: true });
      const r = await c.from('sparks').select('id').eq('id', id);
      return r.error ? r.error.message : r.data.length ? 'still there' : '';
    }, id).catch((e2) => e2.message);
    if (left) console.warn(`${TAG} event ${id} was not deleted (${String(left).split('\n')[0]}); the hourly e2e-cleanup will remove it`);
  }
}

// Run supabase-js inside the page as the page's own signed-in identity.
// `fn` receives (client, config, args) and must return JSON-serialisable data.
async function asUser(page, fn, args) {
  // Read the database only once every open page's taps have finished saving
  await othersSaved(null);
  return page.evaluate(async ({ src, args }) => {
    const C = window.SPARKS_CONFIG;
    const key = 'sb-' + new URL(C.supabaseUrl).host.split('.')[0] + '-auth-token';
    const client = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
      auth: { storageKey: key, autoRefreshToken: false, persistSession: true }
    });
    // eslint-disable-next-line no-new-func
    const f = new Function('return (' + src + ')')();
    return f(client, C, args);
  }, { src: fn.toString(), args });
}

module.exports = {
  TAG, TORREZ, PNG, leadEmail, uniqueTitle, startPost, openProfile, saved, pickView, mockPlaces, stubPhotos, trackErrors, expectConnected, newMember, newLead, button,
  postIdea, postEvent, closeAskFirst, pickDate, pickKind, addJob, answerNamePrompt, answerGuestPrompt, ideaIdFromUrl, openIdea, confirm, deleteIdea, asUser
};
