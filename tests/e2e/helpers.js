// Shared helpers for driving Sparks the way a member would.
const { expect } = require('@playwright/test');

// A 64×48 solid PNG, generated once. Enough for the app's resize-and-upload path.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAAZElEQVR4nO3PUQkAIBTAwBfE/lYzhiH8OITBAtzm7PV1wwUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY8dgFOWQUt++DHBwAAAABJRU5ErkJggg==',
  'base64'
);

// Every idea a test creates starts with this, so a failed run's leftovers are easy to spot and sweep.
const TAG = '[E2E]';
const uniqueTitle = (label) => `${TAG} ${label} ${Date.now().toString(36)}`;

// Fresh member: new browser context = new localStorage = new anonymous identity.
async function newMember(browser) {
  const context = await browser.newContext({ ...require('@playwright/test').devices['Pixel 7'] });
  const page = await context.newPage();
  const errors = trackErrors(page);
  await page.goto('/');
  await expectConnected(page, errors);
  return { context, page, errors };
}

// Collects console errors, uncaught exceptions and failed requests so a test can assert "no errors".
// (security.spec.js makes forbidden calls on purpose, so it doesn't assert on these.)
function trackErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push('request failed: ' + r.url().slice(0, 100) + ' ' + ((r.failure() || {}).errorText || '')));
  return errors;
}

// The app is up and talking to the TEST database (not just showing "0 ideas so far" offline).
async function expectConnected(page, errors) {
  await expect(page.getByText(/\d+ ideas? so far/).first()).toBeVisible();
  if (errors && errors.length) throw new Error('Page errors while loading: ' + errors.join(' | '));
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => !!window.supabase && window.SPARKS_CONFIG.env)).toBe('test');
}

const button = (page, name) => page.getByRole('button', { name, exact: true });

// Post an idea through the whole flow. Returns the new idea's id (from the URL).
async function postIdea(page, { title, location, date, time, hopes = [], photo = false, name }) {
  await button(page, 'Post an idea').click();
  await expect(page.getByRole('heading', { name: 'What’s the event?' })).toBeVisible();
  await page.getByLabel('The event').fill(title);
  await button(page, 'Next').click();

  await expect(page.getByRole('heading', { name: 'Location' })).toBeVisible();
  if (location) {
    await page.getByLabel('Location').fill(location);
    await button(page, 'Next').click();
  } else {
    await button(page, 'Decide location later').click();
  }

  await expect(page.getByRole('heading', { name: 'Date' })).toBeVisible();
  if (date) {
    await page.getByLabel('Date', { exact: true }).fill(date);
    if (time) {
      await button(page, 'Add time').click();
      await page.getByLabel('Time', { exact: true }).selectOption(time);
    }
    await button(page, 'Next').click();
  } else {
    await button(page, 'Decide date later').click();
  }

  await expect(page.getByRole('heading', { name: 'Paint the picture' })).toBeVisible();
  for (let i = 0; i < hopes.length; i++) {
    await page.getByLabel(`Dream version, line ${i + 1}`).fill(hopes[i]);
  }
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

  await expect(page.locator('[data-screen-label=Detail]')).toBeVisible();
  await expect(page.getByText('It’s up')).toBeVisible();
  return ideaIdFromUrl(page);
}

async function answerNamePrompt(page, name) {
  await expect(page.getByRole('heading', { name: 'Your name' })).toBeVisible();
  await page.getByLabel('First name').fill(name);
  await button(page, 'Continue').click();
}

function ideaIdFromUrl(page) {
  const m = page.url().match(/#\/idea\/([0-9a-f-]{36})$/);
  if (!m) throw new Error('Not on an idea page: ' + page.url());
  return m[1];
}

async function openIdea(page, id) {
  await page.goto('/#/idea/' + id);
  await expect(page.locator('[data-screen-label=Detail]')).toBeVisible();
}

// Confirm dialogs: click the action, then the confirm button in the dialog.
async function confirm(page, cta) {
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: cta, exact: true }).click();
  await expect(dialog).toBeHidden();
}

// Delete an idea as its lead (cleanup).
async function deleteIdea(page, id) {
  await openIdea(page, id);
  await button(page, 'Edit').click();
  await button(page, 'Delete this idea').click();
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

module.exports = { TAG, expectConnected, uniqueTitle, newMember, trackErrors, button, postIdea, answerNamePrompt, ideaIdFromUrl, openIdea, confirm, deleteIdea, asUser, PNG };
