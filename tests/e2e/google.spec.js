// "Continue with Google". Google itself can't be automated, so these fake the
// two ends of the round trip: leaving (Supabase hands back Google's URL) and
// coming back (the page reloads with ?error=… or a signed-in session).
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, deleteIdea } = require('./helpers');

const RESUME_KEY = 'spark-hub-google-resume';
const readResume = (page) => page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)), RESUME_KEY);

test('Welcome → Continue with Google: the trip is saved; cancelling comes back with a note', async ({ browser }) => {
  const { page, context } = await newMember(browser);
  try {
    // Supabase is asked for a Google link for this visitor; we stop the trip there
    let authorize = null;
    await page.route('**/auth/v1/user/identities/authorize**', (route) => {
      authorize = new URL(route.request().url());
      route.fulfill({ json: { url: 'http://localhost:4173/fake-google' } });
    });
    await page.route('http://localhost:4173/fake-google', (route) => route.fulfill({ contentType: 'text/html', body: '<p>Google</p>' }));
    await page.locator('[data-screen-label=Welcome]').getByRole('button', { name: 'Continue with Google' }).click();
    await page.waitForURL('**/fake-google');
    expect(authorize.searchParams.get('provider')).toBe('google');
    expect(authorize.searchParams.get('redirect_to')).toBe('http://localhost:4173/');

    const saved = await readResume(page);
    expect(saved.stage).toBe('link');
    expect(saved.from).toBe('default');
    expect(saved.draft).toBeNull();
    expect(saved.mergeToken).toMatch(/^[0-9a-f-]{36}$/);

    // They cancel at Google: back on Welcome with sign-in open and a note
    await page.goto('/?error=access_denied&error_description=cancelled');
    const login = page.getByRole('dialog', { name: 'Sign in' });
    await expect(login.getByRole('alert')).toHaveText('!Google sign-in didn’t finish. Try again, or use your email.');
    await login.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('[data-screen-label=Welcome]')).toBeVisible();
    expect(new URL(page.url()).search).toBe('');
    expect(await readResume(page)).toBeNull();
  } finally {
    await context.close();
  }
});

test('coming back signed in posts the saved draft', async ({ browser }) => {
  // A signed-in account stands in for "Google said yes"
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  const title = uniqueTitle('Paddle');
  let id;
  try {
    await page.evaluate(({ k, title }) => sessionStorage.setItem(k, JSON.stringify({
      at: Date.now(), stage: 'link', from: 'post', anonId: null, name: 'Tester', mergeToken: null, screen: 'compose',
      draft: { activity: title, hopes: ['bring snacks', '', ''], locMode: 'open', locText: '', locPlace: null, whenMode: 'one', dateOne: '', timeOne: '', timeOn: false, photos: [] }
    })), { k: RESUME_KEY, title });
    await page.goto('/?code=returned-from-google');
    await expect(page.getByText('It’s up')).toBeVisible();
    const detail = page.locator('[data-screen-label="Idea page"]');
    await expect(detail).toContainText(title.charAt(0).toUpperCase() + title.slice(1));
    await expect(detail).toContainText('Bring snacks');
    id = page.url().match(/#\/idea\/([0-9a-f-]{36})$/)[1];
    expect(new URL(page.url()).search).toBe('');
    expect(await readResume(page)).toBeNull();
    expect(errors.filter(e => !/code|pkce|verifier/i.test(e))).toEqual([]);
  } finally {
    if (id) await deleteIdea(page, id).catch(() => {});
    await context.close();
  }
});

test('Google account that already has an account: sign in to it instead', async ({ browser }) => {
  const { page, context } = await newMember(browser);
  try {
    await page.evaluate((k) => sessionStorage.setItem(k, JSON.stringify({
      at: Date.now(), stage: 'link', from: 'default', anonId: 'someone', name: '', mergeToken: '00000000-0000-0000-0000-000000000000', draft: null
    })), RESUME_KEY);
    // Record what the app saves as it leaves (the page itself is gone afterwards)
    const writes = [];
    await page.exposeFunction('__resumeWritten', (v) => writes.push(JSON.parse(v)));
    await page.addInitScript((k) => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) { if (key === k) window.__resumeWritten(value); return set.call(this, key, value); };
    }, RESUME_KEY);
    let authorize = null;
    await context.route('**/auth/v1/authorize**', (route) => {
      authorize = new URL(route.request().url());
      route.abort();
    });
    await page.goto('/?error=server_error&error_code=identity_already_exists');
    await expect.poll(() => authorize && authorize.searchParams.get('provider')).toBe('google');
    expect(authorize.searchParams.get('redirect_to')).toBe('http://localhost:4173/');
    const saved = writes[writes.length - 1];
    expect(saved.stage).toBe('signin');
    expect(saved.mergeToken).toBe('00000000-0000-0000-0000-000000000000');
  } finally {
    await context.close();
  }
});
