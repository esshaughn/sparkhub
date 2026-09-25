// "Continue with Google". Google itself can't be automated, so these fake the
// two ends of the round trip: leaving (Supabase hands back Google's URL) and
// coming back (the page reloads with ?error=… or a signed-in session).
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, button, deleteIdea, PNG } = require('./helpers');

const RESUME_KEY = 'spark-hub-google-resume';
const readResume = (page) => page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)), RESUME_KEY);

// Fill the post flow up to "Look good?" with a title and one photo
async function draftUpToReview(page, title) {
  await page.getByRole('button', { name: 'Post an idea' }).click();
  await page.getByLabel('The event').fill(title);
  await button(page, 'Next').click();
  await button(page, 'Decide location later').click();
  await button(page, 'Decide date later').click();
  await button(page, 'Next').click();
  await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('button', { name: 'Remove photo' })).toHaveCount(1);
  await button(page, 'Next').click();
  await expect(page.getByRole('heading', { name: 'Look good?' })).toBeVisible();
}

test('leaving for Google saves the draft; cancelling brings it back with a note', async ({ browser }) => {
  const { page, context } = await newMember(browser);
  const title = uniqueTitle('Kayak');
  try {
    await draftUpToReview(page, title);
    await button(page, 'Put it up').click();

    // Supabase is asked for a Google link for this identity; we stop the trip there
    let authorize = null;
    await page.route('**/auth/v1/user/identities/authorize**', (route) => {
      authorize = new URL(route.request().url());
      route.fulfill({ json: { url: 'http://localhost:4173/fake-google' } });
    });
    await page.route('http://localhost:4173/fake-google', (route) => route.fulfill({ contentType: 'text/html', body: '<p>Google</p>' }));
    await page.getByRole('dialog', { name: 'Sign in' }).getByRole('button', { name: 'Continue with Google' }).click();
    await page.waitForURL('**/fake-google');
    expect(authorize.searchParams.get('provider')).toBe('google');
    expect(authorize.searchParams.get('redirect_to')).toBe('http://localhost:4173/');

    const saved = await readResume(page);
    expect(saved.stage).toBe('link');
    expect(saved.from).toBe('post');
    expect(saved.draft.activity).toBe(title);
    expect(saved.draft.photos).toHaveLength(1);
    expect(saved.draft.photos[0]).toMatch(/^data:image\/jpeg;base64,/);
    expect(saved.mergeToken).toMatch(/^[0-9a-f-]{36}$/);

    // They cancel at Google: back to "Look good?" with the draft and photo, sign-in still open
    await page.goto('/?error=access_denied&error_description=cancelled');
    const login = page.getByRole('dialog', { name: 'Sign in' });
    await expect(login.getByRole('alert')).toHaveText('!Google sign-in didn’t finish. Try again, or use your email.');
    await login.getByRole('button', { name: 'Close' }).click();
    const review = page.locator('[data-screen-label="New spark"]');
    await expect(review).toContainText(title);
    await expect(review.locator('div[style*="blob:"]')).toHaveCount(1);
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
