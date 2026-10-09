// Shared helpers for driving Spark Hub the way a member would.
const { expect, devices, test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// The test database's address and public key, the way js/config.js gives them to the test page
// (TEST on localhost; the Supabase on this computer on 127.0.0.1, with E2E_DB=local)
const HOST = process.env.E2E_DB === 'local' ? '127.0.0.1' : 'localhost';
const CONFIG = (() => {
  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', 'location', fs.readFileSync(path.join(__dirname, '../../js/config.js'), 'utf8'))(window, { hostname: HOST });
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
// The same two places as Google Places (New) answers them, for when js/config.js has a Google key (owner, 2026-10-09)
const FAKE_GOOGLE = {
  suggestions: [
    { placePrediction: { placeId: 'ChIJzilkerPark00000000', types: ['park', 'point_of_interest', 'establishment'], text: { text: 'Zilker Metropolitan Park, 2100 Barton Springs Road, Austin, TX, USA' },
      structuredFormat: { mainText: { text: 'Zilker Metropolitan Park' }, secondaryText: { text: '2100 Barton Springs Road, Austin, TX 78746, USA' } } } },
    { placePrediction: { placeId: 'ChIJcongress110000000', types: ['street_address', 'geocode'], text: { text: '1100 Congress Avenue, Austin, TX, USA' },
      structuredFormat: { mainText: { text: '1100 Congress Avenue' }, secondaryText: { text: 'Austin, TX 78701, USA' } } } }
  ],
  ChIJzilkerPark00000000: { displayName: { text: 'Zilker Metropolitan Park' }, formattedAddress: '2100 Barton Springs Road, Austin, TX 78746, USA' },
  ChIJcongress110000000: { displayName: { text: '1100 Congress Avenue' }, formattedAddress: '1100 Congress Avenue, Austin, TX 78701, USA' }
};
async function mockPlaces(target) {
  const seen = [];
  seen.masks = [];   // the field mask of each Place Details call (never asks for the location: Google's terms)
  await target.route('https://api.geoapify.com/**', (route) => {
    seen.push(route.request().url());
    route.fulfill({ json: { results: FAKE_PLACES } });
  });
  // Google: the search (counted with Geoapify's, its text in the body) and a picked place's details (not counted)
  await target.route('https://places.googleapis.com/**', (route) => {
    const req = route.request(), id = new URL(req.url()).pathname.split('/').pop();
    if (req.method() === 'POST') {
      const u = new URL('https://places.googleapis.com/v1/places:autocomplete');
      u.searchParams.set('text', (req.postDataJSON() || {}).input || '');
      seen.push(u.toString());
      return route.fulfill({ json: { suggestions: FAKE_GOOGLE.suggestions } });
    }
    seen.masks.push(req.headers()['x-goog-fieldmask'] || '');
    route.fulfill({ json: FAKE_GOOGLE[id] || {} });
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
    // Every notification topic on: a run that stopped between the notifications test's switch off and back on left
    // one lead with Updates off, so that test failed on every later run on that worker (2026-10-02)
    // …and no "already seen" flags: they follow the account since 20261112000000_seen_on_account.sql, so one run's
    // swipe or welcome hid it from every later run on TEST (the swipe arrows, full run 37632115917)
    await api('PATCH', '/rest/v1/notif_state?user_id=eq.' + session.user.id, session.access_token, { topics: {}, seen: {} });
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

// v8-5: the floating + on any tab (here My calendar) opens two pills; Create a plan starts Plan an event
async function startPost(page, { group = true } = {}) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.locator('[data-add-fab]').click();
  await page.locator('[data-plus-plan]').click();
  await expect(page.locator('[data-screen-label="New spark"]')).toBeVisible();
  if (group) await pickPostTo(page);
}
// No group is picked for you (owner, 2026-10-08): the leads post to Torrez Fitness
async function pickPostTo(page) {
  await page.locator('[data-post-to]').click();
  const to = page.getByRole('dialog', { name: 'Post to' });
  await to.getByRole('checkbox', { name: /Torrez Fitness/ }).click();
  await to.getByRole('button', { name: 'Done' }).click();
}
// …and Float an idea opens the Float sheet (v8-4 §5)
async function startFloat(page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.locator('[data-add-fab]').click();
  await page.locator('[data-plus-float]').click();
  await expect(page.locator('[data-screen-label="Float an Idea"]')).toBeVisible();
}
// My tasks lives under Me since v8-4 (YOUR STUFF's first row)
async function openTasks(page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Me', exact: true }).click();
  await page.locator('[data-stuff="My tasks"]').click();   // a slide-up over Me since v8-9
  await expect(page.getByRole('dialog', { name: 'My tasks' }).locator('[data-screen-label="Your tasks"]')).toBeVisible();
}
// All groups (v8; the old Discover tab): My groups' gradient card
async function openAllGroups(page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Groups', exact: true }).click();
  await page.locator('[data-all-groups]').click();
  const all = page.locator('[data-screen-label="All groups"]');
  await expect(all).toBeVisible();
  // it opens on Month (owner, 2026-10-07); the specs read the list
  await expect(all.getByRole('button', { name: 'View: Month' })).toBeVisible();
  await pickView(all, 'List');
}
// Real or test? is gone (v8, owner 2026-10-05): kept so older specs still read, it does nothing
async function pickKind() {}
// Tiles · List · Grid: the picker on the first month row
async function pickView(scope, name) {
  await scope.getByRole('button', { name: /^View: / }).click();
  await scope.page().getByRole('menu', { name: 'View' }).getByRole('button', { name, exact: true }).click();
  await expect(scope.getByRole('button', { name: 'View: ' + name })).toBeVisible();
}
// Taps (RSVP, votes, Interested, sign-ups…) show at once and save behind the screen: wait for them to land before
// another person looks
async function saved(page) { await expect(page.locator('html[data-saving]')).toHaveCount(0, { timeout: 20000 }); }
// Me is a tab (v8; it was the Profile sheet behind Settings)
async function openProfile(page) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Me', exact: true }).click();
  await expect(page.locator('[data-screen-label="Me"]')).toBeVisible();
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
  await expect(d.locator('[data-guest-rsvp]')).toHaveAttribute('aria-disabled', 'true');   // RSVP without an account (v8-8 1c)
  await d.getByLabel('Your name').fill(name);
  await d.locator('[data-guest-rsvp]').click();
  await expect(d).toBeHidden();
}

// A member's Going opens "You're going!" with Bringing anyone? (Design v8-11 6a); Done closes it (and brings the banner)
async function donePlus(page) {
  const d = page.getByRole('dialog', { name: 'You’re going' });
  await d.locator('[data-plus-done]').click();
  await expect(d).toHaveCount(0);
}

function ideaIdFromUrl(page) {
  const m = page.url().match(/#\/idea\/([0-9a-f-]{36})$/);
  if (!m) throw new Error('Not on an idea page: ' + page.url());
  return m[1];
}

// The date picker is our own calendar (owner, 2026-10-01): open the field, page to the month, tap the day ('' clears it)
async function pickDate(scope, iso, label = 'Date') {
  await scope.getByRole('button', { name: label, exact: true }).click();
  // the calendar and the time list float over the whole app, outside any pop-up (create flow audit, 2026-10-07)
  const cal = (scope.page ? scope.page() : scope).locator('[data-calendar]');
  if (!iso) { await cal.getByRole('button', { name: 'Clear the date' }).click(); return; }
  for (let i = 0; i < 24 && (await cal.getAttribute('data-calendar')) < iso.slice(0, 7); i++) await cal.getByRole('button', { name: 'Next month' }).click();
  await cal.locator('[data-day="' + iso + '"]').click();
  await expect(cal).toHaveCount(0);
}
async function openIdea(page, id) {
  await page.goto('/#/idea/' + id);
  await expect(page.locator('[data-screen-label="Idea page"], [data-screen-label="Idea page (8b)"], [data-screen-label="Plan page"], [data-screen-label="It happened"]')).toBeVisible();   // (8b): a floated idea (v8-4)
}

// Plan an event (v8-14): one page. The title in the header, Date & time and Location in their pop-ups, the description,
// + Add a job (its kinds pop-up, then the job pop-up), Public / Private, Post it. Whoever posts it leads it. Returns its id.
// `details` go into the description as sentences.
async function postEvent(page, { title, date, time, where, pick, details = [], jobs = [], inviteOnly = false, photo = false }) {
  await startPost(page);
  const flow = page.locator('[data-screen-label="New spark"]');
  await expect(flow.locator('[data-screen-label="Create event (1a)"]')).toBeVisible();
  if (photo) await flow.getByLabel('Add a cover photo').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG });
  await flow.getByLabel('Event title').fill(title);
  // Date & time and Address are right in the WHEN & WHERE card (owner, 2026-10-09; were pop-ups)
  const when = flow.locator('[data-cp-row="when"]');
  await pickDate(when, date);
  if (time) {
    await when.getByRole('button', { name: 'Start time' }).click();
    await pickTime(when, time);
  }
  if (where) {
    const at = flow.locator('[data-cp-row="where"]');
    await at.getByLabel('Address').fill(where);   // with no name, the location is the address
    if (pick) await page.getByRole('group', { name: 'Suggested places' }).getByRole('button', { name: new RegExp(pick) }).click();
  }
  if (details.length) await flow.getByLabel('Event description').fill(details.map(d => /[.!?]$/.test(d) ? d : d + '.').join(' '));
  for (const j of jobs) await addJob1a(page, j);
  if (inviteOnly) await flow.getByRole('radio', { name: /^Private/ }).click();
  await flow.locator('[data-post]').click();
  await expect(page.locator('[data-screen-label="Plan page"]')).toBeVisible();
  await expect(page.getByText('It’s on the books')).toHaveCount(0);   // no chip over a new plan (owner, 2026-10-01)
  await closeAskFirst(page);
  return ideaIdFromUrl(page);
}
// + Add on the one page (v8-14; one kind of sign-up 2026-10-07): Write your own, then the item pop-up
async function addJob1a(page, { item, need = 1 }) {
  await page.locator('[data-cp-add-job]').click();
  await page.getByRole('dialog', { name: 'Add a sign-up' }).locator('[data-job-chip="Other"]').click();
  const sheet = page.getByRole('dialog', { name: 'Add a sign-up' });
  await sheet.getByLabel('Job name').fill(item);
  for (let n = 1; n < need; n++) await sheet.getByRole('button', { name: 'More for how many people' }).click();
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(sheet).toHaveCount(0);
}
// Posting a real event opens Invite people with "Events with a friend or two in…" (research review, 2026-10-01; v8-7 title)
async function closeAskFirst(page) {
  const ask = page.getByRole('dialog', { name: 'Invite people' });
  await expect(ask.locator('[data-ask-first]')).toContainText('a friend or two');
  await expect(ask.locator('[data-invitees]')).toBeVisible();   // friends and the event's groups to invite (owner's mock, 2026-10-01)
  await ask.getByRole('button', { name: 'Close' }).click();
  await expect(ask).toHaveCount(0);
}
// The host adds a job in Edit what you need (v6 Update 6): name, how many, an optional time
async function addJob(page, { item, need = 1, time }) {
  // No jobs yet: the empty box; otherwise the section's Edit pill (a job's ✎ opens Edit job, that job only: Design v8-8)
  await page.locator('[data-screen-label="Plan page"]').locator('[data-help-empty], [data-help-edit]').first().click();
  const sheet = page.getByRole('dialog', { name: 'Edit sign-ups' });
  const n = await sheet.locator('[data-need-row]').count() + 1;
  await sheet.locator('[data-needs-add]').click();
  await sheet.getByLabel('Job name ' + n).fill(item);
  const row = sheet.locator('[data-need-row]').nth(n - 1);
  for (let k = 1; k < need; k++) await row.getByRole('button', { name: 'More for how many people' }).click();
  if (time) {   // the app's own time list, not a browser menu
    await row.getByRole('button', { name: 'Time ' + n, exact: true }).click();
    await pickTime(row, time);
  }
  await sheet.getByRole('button', { name: 'Save changes' }).click();
  await expect(sheet).toHaveCount(0);
}
// "17:30" → "5:30pm", as the time list shows it
// The time list (owner, 2026-10-06: a scrolling list every 30 minutes; it was a tap grid): tapping a time picks it. t is "17:30"
async function pickTime(scope, t) {
  await (scope.page ? scope.page() : scope).locator('[data-time-list] [data-time="' + t + '"]').click();
}
// A time field's typeable box (v8-7): its value is the time as shown ("5:00pm"); type into it and press Enter
const timeBox = (scope, label) => scope.getByRole('textbox', { name: label + ', type a time', exact: true });
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
    await page.getByRole('button', { name: /^(Cancel or delete|Delete) this (event|[Ii]dea)$/ }).click({ timeout: 10000 });
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

// RSVP (owner, 2026-10-06): once you've replied, the card shows one bar (You're going · Change) instead of the three
// buttons; Change brings them back. rsvpTap answers either way; rsvpBar is the bar for an answer
async function rsvpTap(scope, label) {
  const change = scope.locator('[data-rsvp-change]'), btn = scope.getByRole('button', { name: new RegExp('^' + label) });
  await expect(btn.or(change).first()).toBeVisible();   // wait for the card (a reload draws it a moment later)
  if (await change.count()) await change.click();
  await btn.click();
}
const rsvpBar = (scope, k) => scope.locator('[data-rsvp-bar="' + k + '"]');

module.exports = { pickPostTo,
  addJob1a,
  rsvpTap, rsvpBar,
  TAG, TORREZ, PNG, leadEmail, uniqueTitle, startPost, startFloat, openTasks, openAllGroups, openProfile, saved, pickView, mockPlaces, stubPhotos, trackErrors, expectConnected, newMember, newLead, button,
  postIdea, postEvent, closeAskFirst, pickDate, pickTime, timeBox, pickKind, addJob, answerNamePrompt, answerGuestPrompt, donePlus, ideaIdFromUrl, openIdea, confirm, deleteIdea, asUser
};
