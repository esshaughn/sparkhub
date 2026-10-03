// "Continue with Google". Google itself can't be automated, so these fake the
// two ends of the round trip: leaving (Supabase hands back Google's URL) and
// coming back (the page reloads with ?error=… or a signed-in session).
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newMember, newLead, deleteIdea, asUser, closeAskFirst } = require('./helpers');

const RESUME_KEY = 'spark-hub-google-resume';
const ORIGIN = 'http://' + (process.env.E2E_DB === 'local' ? '127.0.0.1' : 'localhost') + ':4173';   // playwright.config.js baseURL
const readResume = (page) => page.evaluate((k) => JSON.parse(sessionStorage.getItem(k)), RESUME_KEY);

test('Welcome → Continue with Google: the trip is saved; cancelling comes back with a note', async ({ browser }) => {
  const { page, context } = await newMember(browser);
  try {
    // Straight to signing in with Google, one trip (never a link to the guest first); we stop the trip there
    let authorize = null, link = false;
    await page.route('**/auth/v1/user/identities/authorize**', (route) => { link = true; route.abort(); });
    await context.route('**/auth/v1/authorize**', (route) => {
      authorize = new URL(route.request().url());
      route.fulfill({ status: 302, headers: { location: ORIGIN + '/fake-google' } });   // stays on our origin, so the saved trip can be read
    });
    await context.route(ORIGIN + '/fake-google', (route) => route.fulfill({ contentType: 'text/html', body: '<p>Google</p>' }));
    await page.locator('[data-screen-label=Welcome]').getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page.getByRole('dialog', { name: 'Sign in' })).toHaveCount(0);   // straight to Google, no pop-up first
    await page.waitForURL('**/fake-google');
    expect(authorize.searchParams.get('provider')).toBe('google');
    expect(authorize.searchParams.get('redirect_to')).toBe(ORIGIN + '/');
    expect(link).toBe(false);

    const saved = await readResume(page);
    expect(saved.stage).toBe('signin');
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
      at: Date.now(), stage: 'signin', from: 'post', anonId: null, name: 'Tester', mergeToken: null, screen: 'compose',
      draft: { activity: title, evTest: false, evStep: 'review', evBits: ['Bring snacks', '', ''], evNeeds: [], evLater: {}, locText: '', locPlace: null, photos: [] }   // evTest: the Real or test answer travels with the draft
    })), { k: RESUME_KEY, title });
    await page.goto('/?code=returned-from-google');
    await expect(page.locator('[data-screen-label="Idea page"]')).toBeVisible();   // no date: it goes up as an idea (no chip, owner 2026-10-01)
    await closeAskFirst(page);
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

test('an invite link through Google, for an account that already existed: the join finishes (not stuck on Joining)', async ({ browser }) => {
  // The owner (lead 2) starts an [E2E] group; lead 1 comes back from Google as their existing account
  const owner = await newLead(browser, 2, 'Olive');
  const { page, context, errors } = await newLead(browser, 1, 'Tester');
  const name = '[E2E] Invite ' + Date.now().toString(36);
  let gid;
  try {
    const g = await asUser(owner.page, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], name);
    gid = g.id;
    await page.evaluate(({ k, code }) => sessionStorage.setItem(k, JSON.stringify({
      at: Date.now(), stage: 'signin', from: 'invite', joinCode: code, anonId: 'someone-else', name: '', mergeToken: '00000000-0000-0000-0000-000000000000', draft: null
    })), { k: RESUME_KEY, code: g.code });
    await page.goto('/?code=returned-from-google');
    // Welcome to {group}, then its page; never left on Joining
    await expect(page.locator('[data-screen-label=Joining]')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: new RegExp(name.replace(/[[\]]/g, '\\$&')) }).first()).toBeVisible();
    expect(await asUser(page, async (c, _C, id) => (await c.from('memberships').select('group_id').eq('group_id', id)).data.length, gid)).toBe(1);
    expect(errors.filter(e => !/code|pkce|verifier/i.test(e))).toEqual([]);
  } finally {
    if (gid) await asUser(owner.page, async (c, _C, id) => c.rpc('e2e_delete_group', { p_group: id }), gid).catch(() => {});
    await context.close();
    await owner.context.close();
  }
});
