// Shared helpers for driving Spark Hub the way a member would.
const { expect, devices } = require('@playwright/test');

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
  await expect(page.locator('html[data-loaded=true]')).toHaveCount(1);
  if (errors && errors.length) throw new Error('Page errors while loading: ' + errors.join(' | '));
  await expect(page.getByText('Couldn’t load ideas')).toHaveCount(0);
  expect(await page.evaluate(() => !!window.supabase && window.SPARKS_CONFIG.env)).toBe('test');
}

// Fresh visitor: new browser context = new localStorage = new anonymous identity
async function newMember(browser, path) {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  context.placeRequests = await mockPlaces(context);
  const page = await context.newPage();
  const errors = trackErrors(page);
  await page.goto(path || '/');
  await expectConnected(page, errors);
  return { context, page, errors };
}

// Signed-in lead. The test project has two password accounts for this (the app
// itself only offers email codes and Google; tests can't read an inbox).
// Password comes from tests/.env or the CI secret. Both are Torrez Fitness members.
async function newLead(browser, n, name, path) {
  const password = process.env.E2E_LEAD_PASSWORD;
  if (!password) throw new Error('E2E_LEAD_PASSWORD is not set (tests/.env locally, a repo secret on CI)');
  const m = await newMember(browser);
  const err = await asUser(m.page, async (c, _C, { email, password, name }) => {
    const r = await c.auth.signInWithPassword({ email, password });
    if (r.error) return r.error.message;
    const me = r.data.user.id;
    const u = await c.auth.updateUser({ data: { name, display_name: name } });
    if (u.error) return u.error.message;
    const p = await c.rpc('rename_me', { p_name: name });
    return p.error ? p.error.message : null;
  }, { email: `e2e-lead-${n}@example.com`, password, name });
  if (err) throw new Error('Lead sign-in failed: ' + err);
  // Start each test in Torrez Fitness, the group every test lead belongs to
  const torrez = await asUser(m.page, async (c) => (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id);
  await m.page.evaluate((id) => localStorage.setItem('spark-hub-prefs', JSON.stringify({ groupId: id })), torrez);
  await m.page.goto(path || '/');
  await m.page.reload();   // a hash-only goto doesn't reload, and the group choice is read at start-up
  await expectConnected(m.page, m.errors);
  return m;
}

const button = (page, name) => page.getByRole('button', { name, exact: true });

// Post an idea through the whole flow into the current group. Returns its id.
async function postIdea(page, { title, location, pick, date, time, basics = [], photo = false, name }) {
  await page.getByRole('button', { name: 'Post an idea' }).click();
  // The + opens the event form; ideas are behind "Don't have it all figured out?"
  await page.getByRole('button', { name: /Don’t have it all figured out/ }).click();
  await expect(page.getByRole('heading', { name: 'What’s the event?' })).toBeVisible();
  await page.getByLabel('The event').fill(title);
  await button(page, 'Next').click();

  await expect(page.getByRole('heading', { name: 'Location' })).toBeVisible();
  if (location) {
    await page.getByLabel('Location').fill(location);
    if (pick) await page.getByRole('group', { name: 'Suggested places' }).getByRole('button', { name: new RegExp(pick) }).click();
    await button(page, 'Next').click();
  } else {
    await button(page, 'Decide location later').click();
  }

  await expect(page.getByRole('heading', { name: 'Date' })).toBeVisible();
  if (date) {
    await page.getByLabel('Date', { exact: true }).fill(date);
    if (time) {
      await page.getByRole('button', { name: 'Add time' }).click();
      await page.getByLabel('Time', { exact: true }).selectOption(time);
    }
    await button(page, 'Next').click();
  } else {
    await button(page, 'Decide date later').click();
  }

  await expect(page.getByRole('heading', { name: 'Paint the picture' })).toBeVisible();
  for (let i = 0; i < basics.length; i++) await page.getByLabel(`The basics, line ${i + 1}`).fill(basics[i]);
  await button(page, 'Next').click();

  await expect(page.getByRole('heading', { name: 'Add a photo' })).toBeVisible();
  if (photo) {
    await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByRole('button', { name: 'Remove photo' })).toHaveCount(1);
    await button(page, 'Next').click();
  } else {
    await button(page, 'Skip photos').click();
  }

  await expect(page.getByRole('heading', { name: 'Look good?' })).toBeVisible();
  await button(page, 'Put it up').click();
  if (name) await answerNamePrompt(page, name);

  await expect(page.locator('[data-screen-label="Idea page"]')).toBeVisible();
  await expect(page.getByText('It’s up')).toBeVisible();
  return ideaIdFromUrl(page);
}

async function answerNamePrompt(page, name) {
  await expect(page.getByRole('heading', { name: 'Your name' })).toBeVisible();
  await page.getByLabel('First name').fill(name);
  await button(page, 'Continue').click();
}

async function answerGuestPrompt(page, name, phone) {
  const d = page.getByRole('dialog', { name: 'Your info' });
  await expect(d).toBeVisible();
  await d.getByLabel('Your name').fill(name);
  await d.getByLabel('Phone number').fill(phone);
  await d.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(d).toBeHidden();
}

function ideaIdFromUrl(page) {
  const m = page.url().match(/#\/idea\/([0-9a-f-]{36})$/);
  if (!m) throw new Error('Not on an idea page: ' + page.url());
  return m[1];
}

async function openIdea(page, id) {
  await page.goto('/#/idea/' + id);
  await expect(page.locator('[data-screen-label="Idea page"], [data-screen-label="Plan page"], [data-screen-label="It happened"]')).toBeVisible();
}

// Post an event (a plan) with the event form. Returns its id.
async function postEvent(page, { title, date, time = '18:00', where, details, inviteOnly = false }) {
  await page.getByRole('button', { name: 'Post an idea' }).click();
  const form = page.locator('[data-screen-label="New spark"]');
  await expect(form.getByText('Post an event')).toBeVisible();
  await form.getByLabel('What', { exact: true }).fill(title);
  await form.getByLabel('When', { exact: true }).fill(date);
  await form.getByLabel('Time', { exact: true }).selectOption(time);
  if (where) await form.getByLabel('Location').fill(where);
  if (details) await form.getByLabel('Good to know').fill(details);
  if (inviteOnly) await form.getByRole('radio', { name: 'Invite only' }).click();
  await form.getByRole('button', { name: 'Post it' }).click();
  await expect(page.locator('[data-screen-label="Plan page"]')).toBeVisible();
  await expect(page.getByText('It’s on the books')).toBeVisible();
  return ideaIdFromUrl(page);
}

// Confirm dialogs: click the action, then the confirm button in the dialog.
async function confirm(page, cta) {
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: cta, exact: true }).click();
  await expect(dialog).toBeHidden();
}

// Delete an idea as its lead (cleanup)
async function deleteIdea(page, id) {
  await openIdea(page, id);
  await page.locator('[data-screen-label="Idea page"], [data-screen-label="Plan page"], [data-screen-label="It happened"]').getByRole('button', { name: 'Edit' }).first().click({ timeout: 10000 });
  await button(page, 'Delete this idea').click({ timeout: 10000 });
  await confirm(page, 'Delete it');
  await expect(page.locator('[data-screen-label=Browse]')).toBeVisible();
}

// Run supabase-js inside the page as the page's own signed-in identity.
// `fn` receives (client, config, args) and must return JSON-serialisable data.
async function asUser(page, fn, args) {
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
  TAG, TORREZ, PNG, uniqueTitle, mockPlaces, trackErrors, expectConnected, newMember, newLead, button,
  postIdea, postEvent, answerNamePrompt, answerGuestPrompt, ideaIdFromUrl, openIdea, confirm, deleteIdea, asUser
};
