// Link previews: api/preview.js fills in the page's preview tags for /e/<code> (old /i/<id> links redirect there) and /join/<code>
// links (what iMessage, WhatsApp… show). The local test server can't run Vercel functions, so this
// calls the function directly, against the TEST database (any host that isn't live).
const { test, expect } = require('@playwright/test');
const { uniqueTitle, newLead, newMember, postIdea, deleteIdea, asUser, rsvpTap } = require('./helpers');
const preview = require('../../api/preview.js');

const serve = async (query) => {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } };
  await preview({ headers: { host: process.env.E2E_DB === 'local' ? '127.0.0.1' : 'localhost' }, query, url: '/' }, res);
  return res;
};
const og = (html, prop) => ((html.match(new RegExp('<meta property="og:' + prop + '" content="([^"]*)"')) || [])[1]) || null;

test('shared links preview the idea or group (invite-only plans and unknown links stay generic)', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Tester');
  const title = uniqueTitle('Preview picnic');
  let ideaId, group;
  try {
    ideaId = await postIdea(page, { title });

    // The short link (v8-8): the event only, "{time} · {location}" or On Spark Hub, no group name
    const code = await asUser(page, async (c, _C, id) => (await c.from('sparks').select('link_code').eq('id', id).single()).data.link_code, ideaId);
    expect(code).toMatch(/^[a-z0-9]{8}$/);
    expect(ideaId).not.toContain(code);
    let r = await serve({ e: code });
    expect(r.headers['Content-Type']).toMatch(/text\/html/);
    expect(og(r.body, 'title')).toBe(title);
    expect(r.body).toContain('<title>' + title + ' · Spark Hub</title>');
    expect(og(r.body, 'description')).toBe('On Spark Hub');
    expect(og(r.body, 'description')).not.toContain('Torrez');
    // no cover or mood photo: its home group's photo (owner, 2026-10-07; 20261115000000_multi_day_fixes.sql), else the Spark Hub card
    expect(og(r.body, 'image')).toMatch(/^https:\/\/.+\.(jpg|png)$/);
    expect(og(r.body, 'url')).toMatch(new RegExp('/e/' + code + '$'));
    expect(r.body).toContain('<script src="/js/sparks.js');   // still the app page
    // An old /i/{id} link redirects to the short link
    r = await serve({ i: ideaId });
    expect(r.statusCode).toBe(301);
    expect(r.headers.Location).toMatch(new RegExp('/e/' + code + '$'));

    // Invite-only: the generic Spark Hub preview, no title
    await asUser(page, async (c, _C, id) => { await c.from('sparks').update({ visibility: 'invite' }).eq('id', id); }, ideaId);
    r = await serve({ e: code });
    expect(og(r.body, 'title')).toBe('Spark Hub');
    expect(r.body).not.toContain(title);

    // Unknown or malformed links: generic
    expect(og((await serve({ e: 'zzzzzzzz' })).body, 'title')).toBe('Spark Hub');
    expect(og((await serve({ e: '<script>' })).body, 'title')).toBe('Spark Hub');
    expect(og((await serve({ i: '00000000-0000-0000-0000-000000000000' })).body, 'title')).toBe('Spark Hub');

    // A group invite: "Join <group> on Spark Hub"
    const name = uniqueTitle('preview club');
    group = await asUser(page, async (c, _C, n) => (await c.rpc('create_group', { p_name: n })).data[0], name);
    r = await serve({ join: group.code.toLowerCase() });
    expect(og(r.body, 'title')).toBe('Join ' + name + ' on Spark Hub');
    expect(og(r.body, 'image')).toMatch(/^https:\/\//);   // its photo, or the default Spark Hub card
    expect(og((await serve({ join: 'ZZZZZZ' })).body, 'title')).toBe('Spark Hub');
    // Torrez Fitness and Hub on Hunters have their own card and title (owner, 2026-10-01)
    r = await serve({ join: 'torrez' });
    expect(og(r.body, 'title')).toBe('Join Torrez Fitness | Spark Hub | Plans with your people');
    expect(r.body).toContain('<title>Join Torrez Fitness | Spark Hub | Plans with your people</title>');
    expect(og(r.body, 'image')).toBe('https://sparkhub.wereallneighbors.org/photos/share-torrez.jpg');
    r = await serve({ join: 'HUNTER' });
    expect(og(r.body, 'title')).toBe('Join Hub on Hunters | Spark Hub | Plans with your people');
    expect(og(r.body, 'image')).toBe('https://sparkhub.wereallneighbors.org/photos/share-hub.jpg');
  } finally {
    if (ideaId) await deleteIdea(page, ideaId).catch(() => {});
    if (group) await asUser(page, async (c, _C, id) => { await c.rpc('e2e_delete_group', { p_group: id }); }, group.id).catch(() => {});
    await context.close();
  }
});

// The app at /e/{code} (v8-8): a member who isn't in the group opens the event from its code; a wrong code says the
// link isn't working (never whether anything exists). The static test server can't rewrite, so it's served here
test('a short link opens the event; a wrong one says it isn’t working', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Tester');
  const visitor = await newMember(browser);
  let ideaId;
  try {
    ideaId = await postIdea(page, { title: uniqueTitle('Short link') });
    const code = await asUser(page, async (c, _C, id) => (await c.from('sparks').select('link_code').eq('id', id).single()).data.link_code, ideaId);
    const V = visitor.page;
    await V.route(/\/e\/[^/]+$/, (route) => route.continue({ url: new URL('/index.html', route.request().url()).href }));
    await V.goto('/e/' + code);
    await expect(V.locator('[data-screen-label="Idea page (8b)"]')).toBeVisible();
    await expect(V).toHaveURL(new RegExp('/e/' + code + '$'));   // the short link stays in the address bar (2026-10-07)
    await V.goto('/e/zzzzzzzz');
    await expect(V.locator('[data-gone]')).toHaveText('This link isn’t working');
    expect(visitor.errors.filter(e => !/404/.test(e))).toEqual([]);
  } finally {
    if (ideaId) await deleteIdea(page, ideaId).catch(() => {});
    await context.close();
    await visitor.context.close();
  }
});

// What a signed-out visitor sees on an event (v8-8 short links spec): a count, not who; See all asks them to RSVP; the
// lead's first name with no profile; no Visibility card or group name; Discussion behind sign-in. The guest sheet (1c)
// leads with an account; after a guest RSVP the names show
test('a signed-out visitor sees the event only, and names once they RSVP', async ({ browser }) => {
  const { page, context } = await newLead(browser, 1, 'Lena Lead');
  const visitor = await newMember(browser);
  let id;
  try {
    id = await asUser(page, async (c, _C, { title, day }) => {
      const me = (await c.auth.getUser()).data.user.id;
      const g = (await c.from('groups').select('id').eq('name', 'Torrez Fitness').single()).data.id;
      return (await c.from('sparks').insert({ group_id: g, author_name: 'Lena Lead', lead_name: 'Lena Lead', lead_id: me, created_by: me, text: title, planned: true, day_date: day }).select('id').single()).data.id;
    }, { title: uniqueTitle('Visitor walk'), day: new Date(Date.now() + 8 * 864e5).toISOString().slice(0, 10) });
    const V = visitor.page;
    await V.goto('/#/idea/' + id);
    const P = V.locator('[data-screen-label="Plan page"]');
    await expect(P).toBeVisible();
    // v8-11: no faces or See all for a visitor who hasn't replied, just the locked line
    await expect(P.locator('[data-who-locked]')).toHaveText('RSVP to view guest list');
    await expect(P.locator('[data-going]')).toHaveCount(0);
    await expect(P.locator('[data-lead-names]')).toHaveText('Lena');
    await expect(P.locator('[data-lead-contact]')).toHaveText('Contact');   // asks for the feature (owner, 2026-10-07)
    await expect(P).not.toContainText('Visibility');
    await expect(P).not.toContainText('Torrez Fitness');
    await expect(P.locator('[data-disc-signin]')).toBeVisible();
    // Who's this from? (first-encounter item 9): one card above the RSVP, and What's Spark Hub? opens the About sheet
    await expect(P.locator('[data-visitor-line]')).toContainText('Shared with you on Spark Hub, where people turn ideas into plans.');
    await expect(P.locator('[data-visitor-x]')).toBeVisible();   // a temporary card: closing it hides it on this device
    await P.locator('[data-about-link]').click();
    const about = V.getByRole('dialog', { name: 'What’s Spark Hub?' });
    await expect(about.locator('[data-about-panel="1"]')).toContainText('Where your group’s ideas turn into plans');
    await about.locator('[data-about-next]').click();
    await expect(about.locator('[data-about-panel="2"]')).toContainText('Anyone can start something');
    // Back and close sit at the top (layout A): ‹ goes back a panel; panel 1 has no ‹
    await about.locator('[data-about-back]').click();
    await expect(about.locator('[data-about-panel="1"]')).toBeVisible();
    await expect(about.locator('[data-about-back]')).toHaveCount(0);
    await expect(about.locator('[data-about-logo]')).toBeVisible();
    await expect(about.locator('[data-about-beta]')).toHaveText('BETA');
    await expect(about.locator('[data-about-close]')).toBeVisible();
    // Two panels (owner, 2026-10-07): the last button is Try it out, which takes a guest to sign-in
    await about.locator('[data-about-next]').click();
    await expect(about.locator('[data-about-panel="3"]')).toHaveCount(0);
    await expect(about.locator('[data-about-try]')).toHaveText('Try it out');
    await about.locator('[data-about-try]').click();
    await expect(about).toHaveCount(0);
    const signIn = V.getByRole('dialog', { name: 'Sign in' });
    await expect(signIn).toBeVisible();
    await signIn.getByLabel('Close').click();
    await expect(signIn).toHaveCount(0);
    // The photo's Share icon goes straight to the Share link pop-up (no one-button sheet for a guest, owner 2026-10-06)
    await V.getByRole('button', { name: 'Share', exact: true }).first().click();
    const pop = V.getByRole('dialog', { name: 'Share link' });
    await expect(pop.getByRole('link', { name: 'Messages' })).toHaveAttribute('href', /^sms:/);
    await expect(V.getByRole('dialog', { name: 'Share this event' })).toHaveCount(0);
    await pop.getByRole('button', { name: 'Close' }).click();
    await expect(pop).toHaveCount(0);
    // Going → the guest sheet (first-encounter audit 3 + 5): RSVP first, nothing saved until I'm going, honest about names
    await rsvpTap(P.locator('[data-rsvp]'), 'Going');
    const d = V.getByRole('dialog', { name: 'RSVP as a guest' });
    await expect(d).toContainText('RSVP: Going');
    await expect(d).not.toContainText('You’re going!');
    await expect(d.locator('[data-guest-rsvp]')).toHaveText('I’m going');
    await expect(d.locator('[data-guest-note]')).toHaveText('No account needed. Your first name shows on the guest list.');
    await expect(d.locator('[data-guest-email]')).toHaveText('Have an account? Sign in');
    await d.getByLabel('Your name').fill('Jo');
    await d.locator('[data-guest-rsvp]').click();
    await V.getByRole('dialog', { name: 'You’re on the list' }).locator('[data-plus-done]').click();
    await expect(P.locator('[data-who-locked]')).toHaveCount(0);
    await expect(P.locator('[data-visitor-line]')).toHaveCount(0);   // gone once they've replied
    await expect(P.locator('[data-going]')).toContainText('See all');
    // Back goes to Welcome with the guest's plans on it, not only a sign-in wall (first-encounter audit 2, 2026-10-07)
    await V.getByLabel('Back to Spark Hub').click();
    const mine = V.locator('[data-guest-rsvps]');
    await expect(mine).toContainText('Visitor walk');
    await expect(mine).toContainText('You’re going');
    await mine.getByRole('button').first().click();
    await expect(P).toBeVisible();
    expect(visitor.errors).toEqual([]);
  } finally {
    if (id) await deleteIdea(page, id).catch(() => {});
    await context.close();
    await visitor.context.close();
  }
});
